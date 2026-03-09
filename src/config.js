require('dotenv').config();

module.exports = {
  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,

  // Exchange API
  sidiora: {
    apiKey: process.env.SIDIORA_API_KEY,
    apiSecret: process.env.SIDIORA_API_SECRET,
    apiUrl: process.env.SIDIORA_API_URL || 'https://api.sidiora.exchange',
  },

  // Paxeer Network
  paxeer: {
    rpcUrl: process.env.PAXEER_RPC_URL || 'https://rpc.paxeer.network',
    privateKey: process.env.PAXEER_PRIVATE_KEY,
  },

  // PostgreSQL Configuration
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT) || 5432,
    database: process.env.DATABASE_NAME || 'arb_bot',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.DATABASE_SSL === 'true',
  },

  // Trading Configuration
  trading: {
    profitThresholdPercent: parseFloat(process.env.PROFIT_THRESHOLD_PERCENT) || 1,
    checkIntervalMs: parseInt(process.env.CHECK_INTERVAL_MS) || 5000,
    autoExecuteTrades: process.env.AUTO_EXECUTE_TRADES !== 'false',
    tradingPair: process.env.TRADING_PAIR || 'SID/USDC',
    maxTradeSizeUsd: parseFloat(process.env.MAX_TRADE_SIZE_USD) || 1000,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
