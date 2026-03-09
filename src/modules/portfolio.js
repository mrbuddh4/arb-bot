const logger = require('../logger');
const database = require('./database');
const Decimal = require('decimal.js');

class Portfolio {
  constructor() {
    this.totalProfitUsd = 0;
    this.tradeCount = 0;
    this.recentTrades = [];
    this.lastUpdate = Date.now();
  }

  async refresh() {
    try {
      this.totalProfitUsd = await database.getTotalProfitUsd();
      this.tradeCount = await database.getTradeCount();
      this.recentTrades = await database.getRecentTrades(10);
      this.lastUpdate = Date.now();
    } catch (error) {
      logger.error(`Failed to refresh portfolio: ${error.message}`);
    }
  }

  getTotalProfitUsd() {
    return this.totalProfitUsd;
  }

  getTradeCount() {
    return this.tradeCount;
  }

  getAverageProfitPerTrade() {
    if (this.tradeCount === 0) return 0;
    return new Decimal(this.totalProfitUsd).dividedBy(this.tradeCount).toNumber();
  }

  getWinRate() {
    if (this.recentTrades.length === 0) return 0;
    const winners = this.recentTrades.filter(t => t.net_profit_usd > 0).length;
    return new Decimal(winners).dividedBy(this.recentTrades.length).times(100).toNumber();
  }

  getStatistics() {
    const trades = this.recentTrades;
    
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        totalProfit: 0,
        averageProfit: 0,
        winRate: 0,
        largestWin: 0,
        largestLoss: 0,
        bestProfitPercent: 0,
        worstProfitPercent: 0,
      };
    }

    const profits = trades.map(t => t.net_profit_usd);
    const profitPercents = trades.map(t => t.profit_percent);

    return {
      totalTrades: this.tradeCount,
      totalProfit: this.totalProfitUsd,
      averageProfit: this.getAverageProfitPerTrade(),
      winRate: this.getWinRate(),
      largestWin: Math.max(...profits),
      largestLoss: Math.min(...profits),
      bestProfitPercent: Math.max(...profitPercents),
      worstProfitPercent: Math.min(...profitPercents),
      medianProfit: this.getMedian(profits),
      profitStdDev: this.getStandardDeviation(profits),
    };
  }

  getRecentPerformance(days = 7) {
    const recentTrades = database.getRecentTrades(1000);
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    const tradesInPeriod = recentTrades.filter(t => 
      new Date(t.timestamp).getTime() > cutoffTime
    );

    if (tradesInPeriod.length === 0) {
      return {
        period: `Last ${days} days`,
        trades: 0,
        totalProfit: 0,
        averageProfit: 0,
      };
    }

    const totalProfit = tradesInPeriod.reduce((sum, t) => sum + t.net_profit_usd, 0);

    return {
      period: `Last ${days} days`,
      trades: tradesInPeriod.length,
      totalProfit,
      averageProfit: totalProfit / tradesInPeriod.length,
      bestTrade: Math.max(...tradesInPeriod.map(t => t.net_profit_usd)),
      worstTrade: Math.min(...tradesInPeriod.map(t => t.net_profit_usd)),
    };
  }

  getSummary() {
    const stats = this.getStatistics();
    const recentPerf = this.getRecentPerformance(7);

    return {
      ...stats,
      ...recentPerf,
      lastUpdate: new Date(this.lastUpdate).toLocaleString(),
    };
  }

  getMedian(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  getStandardDeviation(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }
}

module.exports = new Portfolio();
