const { Telegraf } = require('telegraf');
const config = require('../config');
const logger = require('../logger');

class TelegramBot {
  constructor() {
    if (!config.telegramBotToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }
    
    this.bot = new Telegraf(config.telegramBotToken);
    this.chatId = config.telegramChatId;
    this.setupHandlers();
  }

  setupHandlers() {
    this.bot.start((ctx) => {
      logger.info(`Bot started by user ${ctx.from.id}`);
      ctx.reply('🤖 Paxeer Arbitrage Bot Started!\n\nMonitoring SID/USDC for arbitrage opportunities...');
    });

    this.bot.help((ctx) => {
      ctx.reply(`
📊 Paxeer Arbitrage Bot Commands:
/status - Current portfolio status
/stats - Trading statistics
/stop - Stop the bot
      `);
    });

    this.bot.on('message', (ctx) => {
      logger.info(`Message from ${ctx.from.id}: ${ctx.message.text}`);
    });
  }

  async sendAlert(message) {
    try {
      if (!this.chatId) {
        logger.warn('TELEGRAM_CHAT_ID not set, alert not sent');
        return;
      }
      
      await this.bot.telegram.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
      });
      logger.info('Telegram alert sent');
    } catch (error) {
      logger.error(`Failed to send Telegram alert: ${error.message}`);
    }
  }

  async sendOpportunityAlert(opportunity) {
    const message = `
🚨 <b>Arbitrage Opportunity Detected!</b>

💰 Pair: <b>${opportunity.tradingPair}</b>
📊 Buy Venue: <b>${opportunity.buyVenue}</b> @ ${opportunity.buyPrice.toFixed(6)}
📊 Sell Venue: <b>${opportunity.sellVenue}</b> @ ${opportunity.sellPrice.toFixed(6)}

💵 Estimated Profit: <b>$${opportunity.estimatedProfitUsd.toFixed(2)}</b>
📈 Profit %: <b>${opportunity.profitPercent.toFixed(2)}%</b>
💳 Volume: <b>${opportunity.quantity.toFixed(6)} ${opportunity.tradingPair.split('/')[0]}</b>

${opportunity.autoExecuting ? '⚡ <i>Auto-executing trade...</i>' : '⏳ <i>Awaiting execution...</i>'}
    `;

    await this.sendAlert(message);
  }

  async sendExecutionAlert(tradeResult) {
    const status = tradeResult.success ? '✅ SUCCESS' : '❌ FAILED';
    const message = `
${status} <b>Trade Executed</b>

💰 Pair: <b>${tradeResult.tradingPair}</b>
🏪 Buy: <b>${tradeResult.buyVenue}</b>
🏪 Sell: <b>${tradeResult.sellVenue}</b>

💵 Gross Profit: <b>$${tradeResult.grossProfitUsd.toFixed(2)}</b>
💳 Fees: <b>$${tradeResult.feesUsd.toFixed(2)}</b>
💰 Net Profit: <b>$${tradeResult.netProfitUsd.toFixed(2)}</b>
📈 Profit %: <b>${tradeResult.profitPercent.toFixed(2)}%</b>

🔗 Buy TX: <code>${tradeResult.buyTxHash?.substring(0, 16)}...</code>
🔗 Sell TX: <code>${tradeResult.sellTxHash?.substring(0, 16)}...</code>

${tradeResult.errorMessage ? `⚠️ Error: ${tradeResult.errorMessage}` : ''}
    `;

    await this.sendAlert(message);
  }

  async sendPortfolioUpdate(portfolio) {
    const message = `
📊 <b>Portfolio Update</b>

💰 Total Profit: <b>$${portfolio.totalProfitUsd.toFixed(2)}</b>
📈 Trades: <b>${portfolio.tradeCount}</b>
⏱️ Time: <b>${new Date().toLocaleString()}</b>

Recent Win Rate: <b>${portfolio.winRate.toFixed(1)}%</b>
Avg Profit/Trade: <b>$${portfolio.avgProfitPerTrade.toFixed(2)}</b>
    `;

    await this.sendAlert(message);
  }

  async sendErrorAlert(error) {
    const message = `
❌ <b>Error Alert</b>

⚠️ ${error.message}
⏱️ ${new Date().toLocaleString()}
    `;

    await this.sendAlert(message);
  }

  launch() {
    this.bot.launch();
    logger.info('Telegram bot launched');
  }

  async stop() {
    await this.bot.stop();
    logger.info('Telegram bot stopped');
  }
}

module.exports = new TelegramBot();
