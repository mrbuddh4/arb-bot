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
      // Fetch from DEX/AMM using Paxeer RPC
      const rpcUrl = config.paxeer.rpcUrl;
      
      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: process.env.SIDIORA_ROUTER_ADDRESS || '0x0000000000000000000000000000000000000000',
            data: this.encodeGetAmountsOut(
              new Decimal(1).times(new Decimal(10).pow(18)).toString(),
              [process.env.SID_TOKEN_ADDRESS, process.env.USDC_TOKEN_ADDRESS]
            ),
          },
          'latest',
        ],
        id: 1,
      }, {
        timeout: 5000,
      });

      // Decode response to get price
      // For now, return a placeholder - in production, decode the ABI output
      const ammPrice = Math.random() * 12; // Placeholder

      this.prices.amm = {
        price: ammPrice,
        liquidity: Math.random() * 100000,
        timestamp: Date.now(),
      };

      database.recordPrice({
        tradingPair: config.trading.tradingPair,
        venue: 'AMM/DEX',
        price: ammPrice,
      });

      logger.debug(`✅ AMM price: $${ammPrice}`);
      return { price: ammPrice, liquidity: this.prices.amm.liquidity };
    } catch (error) {
      logger.error(`❌ Failed to fetch AMM price from RPC ${config.paxeer.rpcUrl}: ${error.message}`);
      return null;
    }
  }

  encodeGetAmountsOut(amountIn, path) {
    // Helper to encode getAmountsOut function call
    // This is a simplified version - in production, use ethers.js or web3.js
    return '0x'; // Placeholder
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
