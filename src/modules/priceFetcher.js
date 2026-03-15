const axios = require('axios');
const logger = require('../logger');
const config = require('../config');
const database = require('./database');
const Decimal = require('decimal.js');

class PriceFetcher {
  constructor() {
    this.prices = {};
    this.lastUpdate = {};
  }

  async fetchSidioraPrice() {
    try {
      // Fetch from Sidiora Exchange API
      const url = `${config.sidiora.apiUrl}/v1/prices`;
      const response = await axios.get(url, {
        params: {
          pair: config.trading.tradingPair,
        },
        headers: {
          'X-API-Key': config.sidiora.apiKey,
        },
        timeout: 5000,
      });

      const priceData = response.data[0];
      
      if (!priceData) {
        logger.warn('No price data from Sidiora Exchange');
        return null;
      }

      const price = parseFloat(priceData.price);
      const liquidity = parseFloat(priceData.quoteAsset?.total_value || 0);

      this.prices.sidiora = {
        price,
        liquidity,
        timestamp: Date.now(),
      };

      database.recordPrice({
        tradingPair: config.trading.tradingPair,
        venue: 'Sidiora',
        price,
        liquidity,
      });

      logger.debug(`✅ Sidiora price: $${price}`);
      return { price, liquidity };
    } catch (error) {
      logger.error(`❌ Failed to fetch Sidiora price from ${config.sidiora.apiUrl}: ${error.message}`);
      return null;
    }
  }

  async fetchAMMPrice() {
    try {
      // Fetch from DEX/AMM using GraphQL (DEX uses GraphQL, NOT JSON-RPC!)
      const graphqlEndpoint = process.env.GRAPHQL_ENDPOINT;
      
      if (!graphqlEndpoint) {
        throw new Error('GRAPHQL_ENDPOINT environment variable not set. Contact DevOps for DEX GraphQL endpoint.');
      }

      // GraphQL query for getting token pair prices
      // Structure depends on your specific DEX (could be subgraph-based or custom)
      const query = `
        query {
          pairs(first: 1, where: { token0: "${process.env.USDC_TOKEN_ADDRESS}", token1: "${process.env.SID_TOKEN_ADDRESS}" }) {
            id
            reserve0
            reserve1
            token0Price
            token1Price
          }
        }
      `;

      const response = await axios.post(graphqlEndpoint, {
        query,
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.data.errors) {
        throw new Error(`GraphQL error: ${response.data.errors.map(e => e.message).join(', ')}`);
      }

      const pairData = response.data?.data?.pairs?.[0];
      
      if (!pairData) {
        logger.warn('No pair data from DEX GraphQL');
        return null;
      }

      // Get the price (token1Price is SID/USDC rate)
      const ammPrice = parseFloat(pairData.token1Price || (pairData.reserve0 / pairData.reserve1));
      const liquidity = parseFloat(pairData.reserve0); // USDC liquidity

      this.prices.amm = {
        price: ammPrice,
        liquidity,
        timestamp: Date.now(),
      };

      database.recordPrice({
        tradingPair: config.trading.tradingPair,
        venue: 'AMM/DEX',
        price: ammPrice,
        liquidity,
      });

      logger.debug(`✅ AMM price from GraphQL: $${ammPrice}`);
      return { price: ammPrice, liquidity };
    } catch (error) {
      logger.error(`❌ Failed to fetch AMM price from GraphQL: ${error.message}`);
      return null;
    }
  }

  encodeGetAmountsOut(amountIn, path) {
    // This method is no longer used (DEX uses GraphQL, not RPC)
    // Kept for reference only
    return '0x';
  }

  async fetchAllPrices() {
    try {
      const [sidiora, amm] = await Promise.all([
        this.fetchSidioraPrice(),
        this.fetchAMMPrice(),
      ]);

      if (!sidiora || !amm) {
        logger.warn('Could not fetch all prices');
        return null;
      }

      return {
        sidiora,
        amm,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Error fetching prices: ${error.message}`);
      return null;
    }
  }

  getCurrentPrices() {
    return {
      sidiora: this.prices.sidiora?.price || null,
      amm: this.prices.amm?.price || null,
    };
  }

  getPriceDifference() {
    const sidiora = this.prices.sidiora?.price;
    const amm = this.prices.amm?.price;

    if (!sidiora || !amm) return null;

    const diff = new Decimal(sidiora).minus(amm);
    const diffPercent = diff.dividedBy(amm).times(100);

    return {
      absoluteDiff: diff.toNumber(),
      percentDiff: diffPercent.toNumber(),
      lowerPrice: amm < sidiora ? 'amm' : 'sidiora',
      higherPrice: amm > sidiora ? 'amm' : 'sidiora',
    };
  }
}

module.exports = new PriceFetcher();
