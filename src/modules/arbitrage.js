const logger = require('../logger');
const config = require('../config');
const Decimal = require('decimal.js');

class ArbitrageDetector {
  constructor(priceFetcher) {
    this.priceFetcher = priceFetcher;
    this.opportunities = [];
  }

  async detectOpportunities() {
    try {
      const prices = await this.priceFetcher.fetchAllPrices();
      
      if (!prices) {
        logger.warn('Cannot detect opportunities - missing prices');
        return [];
      }

      const opportunities = [];
      const priceDiff = this.priceFetcher.getPriceDifference();

      if (!priceDiff) {
        return [];
      }

      // Check if profit threshold is met
      const profitPercent = Math.abs(priceDiff.percentDiff);
      if (profitPercent < config.trading.profitThresholdPercent) {
        return [];
      }

      // Scenario 1: Buy cheaper on AMM, sell on Sidiora exchange (if AMM is cheaper)
      if (prices.amm.price < prices.sidiora.price) {
        opportunities.push({
          type: 'buy_low_amm_sell_high_sidiora',
          buyVenue: 'AMM/DEX',
          sellVenue: 'Sidiora Exchange',
          buyPrice: prices.amm.price,
          sellPrice: prices.sidiora.price,
          profitPercent,
          maxQuantity: this.calculateMaxQuantity(prices.amm.liquidity),
          profitType: 'LONG',
          timestamp: Date.now(),
        });
      }
      // Scenario 2: Buy cheaper on Sidiora, sell on AMM (if Sidiora is cheaper)
      else if (prices.sidiora.price < prices.amm.price) {
        opportunities.push({
          type: 'buy_low_sidiora_sell_high_amm',
          buyVenue: 'Sidiora Exchange',
          sellVenue: 'AMM/DEX',
          buyPrice: prices.sidiora.price,
          sellPrice: prices.amm.price,
          profitPercent,
          maxQuantity: this.calculateMaxQuantity(prices.sidiora.liquidity),
          profitType: 'LONG',
          timestamp: Date.now(),
        });
      }

      // Log opportunities
      if (opportunities.length > 0) {
        logger.info(`Found ${opportunities.length} arbitrage opportunity(ies)`);
        opportunities.forEach(opp => {
          logger.info(`${opp.type}: ${opp.profitPercent.toFixed(2)}% profit`);
        });
      }

      this.opportunities = opportunities;
      return opportunities;
    } catch (error) {
      logger.error(`Error detecting opportunities: ${error.message}`);
      return [];
    }
  }

  calculateMaxQuantity(liquidity) {
    if (!liquidity || liquidity === 0) {
      return new Decimal(config.trading.maxTradeSizeUsd).dividedBy(10);
    }

    // Use 2% of available liquidity or max trade size, whichever is smaller
    const maxFromLiquidity = new Decimal(liquidity).times(0.02);
    const configMax = new Decimal(config.trading.maxTradeSizeUsd);

    return maxFromLiquidity.lessThan(configMax) ? maxFromLiquidity : configMax;
  }

  calculateProfitability(opportunity, quantity) {
    const qty = new Decimal(quantity);
    const buyPrice = new Decimal(opportunity.buyPrice);
    const sellPrice = new Decimal(opportunity.sellPrice);

    const buyAmount = qty.times(buyPrice);
    const sellAmount = qty.times(sellPrice);
    const grossProfit = sellAmount.minus(buyAmount);

    // Estimate fees (typically 0.25% - 0.5% per venue)
    const buyFee = buyAmount.times(0.003); // 0.3% buy fee
    const sellFee = sellAmount.times(0.003); // 0.3% sell fee
    const totalFees = buyFee.plus(sellFee);

    const netProfit = grossProfit.minus(totalFees);
    const profitPercent = netProfit.dividedBy(buyAmount).times(100);

    return {
      quantity: qty.toNumber(),
      buyAmount: buyAmount.toNumber(),
      sellAmount: sellAmount.toNumber(),
      grossProfit: grossProfit.toNumber(),
      fees: totalFees.toNumber(),
      netProfit: netProfit.toNumber(),
      profitPercent: profitPercent.toNumber(),
    };
  }

  selectBestOpportunity(opportunities) {
    if (opportunities.length === 0) return null;

    // Sort by profit percent, pick the highest
    return opportunities.sort((a, b) => b.profitPercent - a.profitPercent)[0];
  }

  getLastOpportunities(count = 10) {
    return this.opportunities.slice(-count);
  }
}

module.exports = ArbitrageDetector;
