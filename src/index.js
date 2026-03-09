const logger = require('./logger');
const config = require('./config');
const telegram = require('./modules/telegram');
const database = require('./modules/database');
const PriceFetcher = require('./modules/priceFetcher');
const ArbitrageDetector = require('./modules/arbitrage');
const Trader = require('./modules/trader');
const portfolio = require('./modules/portfolio');

class ArbitrageBot {
  constructor() {
    this.priceFetcher = new PriceFetcher();
    this.arbitrageDetector = new ArbitrageDetector(this.priceFetcher);
    this.trader = new Trader();
    this.isRunning = false;
    this.checkInterval = null;
  }

  async initialize() {
    try {
      logger.info('🚀 Initializing Paxeer Arbitrage Bot');
      logger.info(`⚙️  Config: ${JSON.stringify(config.trading, null, 2)}`);

      // Validate configuration
      if (!config.telegramBotToken) {
        throw new Error('TELEGRAM_BOT_TOKEN is required');
      }
      if (!config.sidiora.apiKey || !config.sidiora.apiSecret) {
        throw new Error('Sidiora Exchange API credentials are required');
      }
      if (!config.paxeer.privateKey) {
        throw new Error('PAXEER_PRIVATE_KEY is required');
      }

      // Start Telegram bot
      telegram.launch();
      logger.info('✅ Telegram bot started');

      // Send startup message
      await telegram.sendAlert(
        `🤖 <b>Paxeer Arbitrage Bot Started</b>\n\n` +
        `📊 Monitoring: <b>${config.trading.tradingPair}</b>\n` +
        `💰 Profit Threshold: <b>${config.trading.profitThresholdPercent}%</b>\n` +
        `⏱️ Check Interval: <b>${config.trading.checkIntervalMs}ms</b>\n` +
        `🔄 Auto-Trading: <b>${config.trading.autoExecuteTrades ? 'ENABLED' : 'DISABLED'}</b>\n\n` +
        `🎯 Ready to find arbitrage opportunities!`
      );

      this.isRunning = true;
    } catch (error) {
      logger.error(`Initialization failed: ${error.message}`);
      throw error;
    }
  }

  async start() {
    try {
      await this.initialize();

      // Start the main monitoring loop
      this.checkInterval = setInterval(async () => {
        await this.checkForOpportunities();
      }, config.trading.checkIntervalMs);

      logger.info(`✅ Bot started - checking every ${config.trading.checkIntervalMs}ms`);

      // Also run initial check immediately
      await this.checkForOpportunities();
    } catch (error) {
      logger.error(`Failed to start bot: ${error.message}`);
      await this.stop();
      throw error;
    }
  }

  async checkForOpportunities() {
    try {
      // Detect opportunities
      const opportunities = await this.arbitrageDetector.detectOpportunities();

      if (opportunities.length === 0) {
        logger.debug('No arbitrage opportunities found');
        return;
      }

      logger.info(`🎯 Found ${opportunities.length} opportunity(ies)`);

      // Process each opportunity
      for (const opportunity of opportunities) {
        await this.processOpportunity(opportunity);
      }
    } catch (error) {
      logger.error(`Error checking opportunities: ${error.message}`);
      await telegram.sendErrorAlert(error);
    }
  }

  async processOpportunity(opportunity) {
    try {
      logger.info(`Processing opportunity: ${opportunity.type}`);

      // Calculate profitability
      const quantity = opportunity.maxQuantity;
      const profitability = this.arbitrageDetector.calculateProfitability(
        opportunity,
        quantity
      );

      // Double-check profit meets threshold
      if (profitability.profitPercent < config.trading.profitThresholdPercent) {
        logger.info(`Profit ${profitability.profitPercent.toFixed(2)}% below threshold of ${config.trading.profitThresholdPercent}%`);
        return;
      }

      // Check if it meets max trade size
      if (profitability.buyAmount > config.trading.maxTradeSizeUsd) {
        logger.info(`Trade size $${profitability.buyAmount.toFixed(2)} exceeds max $${config.trading.maxTradeSizeUsd}`);
        return;
      }

      // Send opportunity alert
      await telegram.sendOpportunityAlert({
        tradingPair: config.trading.tradingPair,
        buyVenue: opportunity.buyVenue,
        sellVenue: opportunity.sellVenue,
        buyPrice: opportunity.buyPrice,
        sellPrice: opportunity.sellPrice,
        quantity: profitability.quantity,
        estimatedProfitUsd: profitability.netProfit,
        profitPercent: profitability.profitPercent,
        autoExecuting: config.trading.autoExecuteTrades,
      });

      // Execute trade
      if (config.trading.autoExecuteTrades) {
        const tradeResult = await this.trader.executeTrade(opportunity, profitability);

        if (tradeResult.success) {
          // Refresh portfolio
          portfolio.refresh();

          // Send execution alert
          await telegram.sendExecutionAlert({
            tradingPair: config.trading.tradingPair,
            buyVenue: opportunity.buyVenue,
            sellVenue: opportunity.sellVenue,
            grossProfitUsd: profitability.grossProfit,
            feesUsd: profitability.fees,
            netProfitUsd: profitability.netProfit,
            profitPercent: profitability.profitPercent,
            buyTxHash: tradeResult.buyTxHash,
            sellTxHash: tradeResult.sellTxHash,
            success: true,
          });

          // Send portfolio update
          const stats = portfolio.getStatistics();
          await telegram.sendPortfolioUpdate({
            totalProfitUsd: stats.totalProfit,
            tradeCount: stats.totalTrades,
            winRate: stats.winRate,
            avgProfitPerTrade: stats.averageProfit,
          });
        } else {
          logger.warn(`Trade execution failed: ${tradeResult.reason}`);
          await telegram.sendExecutionAlert({
            tradingPair: config.trading.tradingPair,
            buyVenue: opportunity.buyVenue,
            sellVenue: opportunity.sellVenue,
            success: false,
            errorMessage: tradeResult.reason || tradeResult.error,
          });
        }
      }
    } catch (error) {
      logger.error(`Error processing opportunity: ${error.message}`);
      await telegram.sendErrorAlert(error);
    }
  }

  async stop() {
    try {
      this.isRunning = false;

      if (this.checkInterval) {
        clearInterval(this.checkInterval);
      }

      // Close Telegram bot
      await telegram.stop();

      // Close database
      await database.close();

      logger.info('✅ Bot stopped');

      process.exit(0);
    } catch (error) {
      logger.error(`Error stopping bot: ${error.message}`);
      process.exit(1);
    }
  }
}

// Initialize and start the bot
const bot = new ArbitrageBot();

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down...');
  bot.stop();
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  bot.stop();
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  bot.stop();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at ${promise}: ${reason}`);
});

// Start the bot
bot.start().catch((error) => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
