const { Pool } = require('pg');
const logger = require('../logger');
const config = require('../config');

class DatabaseManager {
  constructor() {
    this.pool = new Pool(config.database);

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error(`Unexpected error on idle client: ${err.message}`);
    });

    this.connected = false;
    this.initializeConnection();
  }

  async initializeConnection() {
    try {
      const client = await this.pool.connect();
      client.release();
      this.connected = true;
      logger.info('PostgreSQL database connected');
      await this.initializeSchema();
    } catch (error) {
      logger.error(`Failed to connect to PostgreSQL: ${error.message}`);
      this.connected = false;
      // Retry connection after 5 seconds
      setTimeout(() => this.initializeConnection(), 5000);
    }
  }

  async initializeSchema() {
    try {
      const queries = [
        `CREATE TABLE IF NOT EXISTS trades (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          trading_pair VARCHAR(20) NOT NULL,
          buy_venue VARCHAR(50) NOT NULL,
          sell_venue VARCHAR(50) NOT NULL,
          buy_price NUMERIC(18,8) NOT NULL,
          sell_price NUMERIC(18,8) NOT NULL,
          quantity NUMERIC(18,8) NOT NULL,
          buy_amount_usd NUMERIC(18,2) NOT NULL,
          sell_amount_usd NUMERIC(18,2) NOT NULL,
          gross_profit_usd NUMERIC(18,2) NOT NULL,
          fees_usd NUMERIC(18,2) NOT NULL,
          net_profit_usd NUMERIC(18,2) NOT NULL,
          profit_percent NUMERIC(8,4) NOT NULL,
          status VARCHAR(20) DEFAULT 'completed',
          buy_tx_hash VARCHAR(100),
          sell_tx_hash VARCHAR(100),
          error_message TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS portfolio (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          total_trades INTEGER DEFAULT 0,
          total_profit_usd NUMERIC(18,2) DEFAULT 0,
          currency VARCHAR(10) DEFAULT 'USD'
        )`,
        `CREATE TABLE IF NOT EXISTS prices (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          trading_pair VARCHAR(20) NOT NULL,
          venue VARCHAR(50) NOT NULL,
          price NUMERIC(18,8) NOT NULL,
          volume NUMERIC(18,8),
          liquidity NUMERIC(18,2)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)`,
        `CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)`,
        `CREATE INDEX IF NOT EXISTS idx_prices_venue ON prices(venue, trading_pair)`,
        `CREATE INDEX IF NOT EXISTS idx_prices_timestamp ON prices(timestamp DESC)`,
      ];

      for (const query of queries) {
        try {
          await this.pool.query(query);
        } catch (err) {
          if (!err.message.includes('already exists')) {
            logger.error(`Schema creation error: ${err.message}`);
          }
        }
      }

      logger.info('PostgreSQL database schema initialized');
    } catch (error) {
      logger.error(`Failed to initialize schema: ${error.message}`);
    }
  }

  async recordTrade(tradeData) {
    try {
      const query = `
        INSERT INTO trades (
          trading_pair, buy_venue, sell_venue, 
          buy_price, sell_price, quantity,
          buy_amount_usd, sell_amount_usd,
          gross_profit_usd, fees_usd, net_profit_usd,
          profit_percent, status, buy_tx_hash, sell_tx_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `;

      const result = await this.pool.query(query, [
        tradeData.tradingPair,
        tradeData.buyVenue,
        tradeData.sellVenue,
        tradeData.buyPrice,
        tradeData.sellPrice,
        tradeData.quantity,
        tradeData.buyAmountUsd,
        tradeData.sellAmountUsd,
        tradeData.grossProfitUsd,
        tradeData.feesUsd,
        tradeData.netProfitUsd,
        tradeData.profitPercent,
        tradeData.status || 'completed',
        tradeData.buyTxHash || null,
        tradeData.sellTxHash || null,
      ]);

      logger.info(`Trade recorded: ID ${result.rows[0].id}`);
      return result.rows[0].id;
    } catch (error) {
      logger.error(`Failed to record trade: ${error.message}`);
      throw error;
    }
  }

  async recordPrice(priceData) {
    try {
      const query = `
        INSERT INTO prices (trading_pair, venue, price, volume, liquidity)
        VALUES ($1, $2, $3, $4, $5)
      `;

      await this.pool.query(query, [
        priceData.tradingPair,
        priceData.venue,
        priceData.price,
        priceData.volume || null,
        priceData.liquidity || null,
      ]);
    } catch (error) {
      logger.error(`Failed to record price: ${error.message}`);
      throw error;
    }
  }

  async getTotalProfitUsd() {
    try {
      const result = await this.pool.query(`
        SELECT COALESCE(SUM(net_profit_usd), 0) as total
        FROM trades
        WHERE status = 'completed'
      `);

      return result.rows[0]?.total || 0;
    } catch (error) {
      logger.error(`Failed to get total profit: ${error.message}`);
      throw error;
    }
  }

  async getTradeCount() {
    try {
      const result = await this.pool.query(`
        SELECT COUNT(*) as count FROM trades WHERE status = 'completed'
      `);

      return parseInt(result.rows[0]?.count) || 0;
    } catch (error) {
      logger.error(`Failed to get trade count: ${error.message}`);
      throw error;
    }
  }

  async getRecentTrades(limit = 10) {
    try {
      const result = await this.pool.query(`
        SELECT * FROM trades
        WHERE status = 'completed'
        ORDER BY timestamp DESC
        LIMIT $1
      `, [limit]);

      return result.rows || [];
    } catch (error) {
      logger.error(`Failed to get recent trades: ${error.message}`);
      throw error;
    }
  }

  async getTradesByDateRange(startDate, endDate) {
    try {
      const result = await this.pool.query(`
        SELECT * FROM trades
        WHERE status = 'completed'
        AND timestamp BETWEEN $1 AND $2
        ORDER BY timestamp DESC
      `, [startDate, endDate]);

      return result.rows || [];
    } catch (error) {
      logger.error(`Failed to get trades by date range: ${error.message}`);
      throw error;
    }
  }

  async getLatestPrices() {
    try {
      const result = await this.pool.query(`
        SELECT DISTINCT ON (venue) *
        FROM prices
        ORDER BY venue, timestamp DESC
      `);

      return result.rows || [];
    } catch (error) {
      logger.error(`Failed to get latest prices: ${error.message}`);
      throw error;
    }
  }

  async getPriceHistory(tradingPair, venue, hours = 24) {
    try {
      const result = await this.pool.query(`
        SELECT * FROM prices
        WHERE trading_pair = $1
        AND venue = $2
        AND timestamp > NOW() - INTERVAL '${hours} hours'
        ORDER BY timestamp ASC
      `, [tradingPair, venue]);

      return result.rows || [];
    } catch (error) {
      logger.error(`Failed to get price history: ${error.message}`);
      throw error;
    }
  }

  async getAveragePriceByVenue(tradingPair, hours = 1) {
    try {
      const result = await this.pool.query(`
        SELECT 
          venue,
          AVG(price) as avg_price,
          MIN(price) as min_price,
          MAX(price) as max_price,
          COUNT(*) as sample_count
        FROM prices
        WHERE trading_pair = $1
        AND timestamp > NOW() - INTERVAL '${hours} hours'
        GROUP BY venue
      `, [tradingPair]);

      return result.rows || [];
    } catch (error) {
      logger.error(`Failed to get average prices: ${error.message}`);
      throw error;
    }
  }

  async getDailyStats(date) {
    try {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as trade_count,
          SUM(net_profit_usd) as total_profit,
          AVG(net_profit_usd) as avg_profit,
          MAX(net_profit_usd) as best_trade,
          MIN(net_profit_usd) as worst_trade,
          AVG(profit_percent) as avg_profit_percent
        FROM trades
        WHERE status = 'completed'
        AND DATE(timestamp) = $1
      `, [date]);

      return result.rows[0] || {};
    } catch (error) {
      logger.error(`Failed to get daily stats: ${error.message}`);
      throw error;
    }
  }

  async close() {
    try {
      await this.pool.end();
      this.connected = false;
      logger.info('PostgreSQL database connection closed');
    } catch (error) {
      logger.error(`Failed to close database: ${error.message}`);
      throw error;
    }
  }

  isConnected() {
    return this.connected;
  }
}

module.exports = new DatabaseManager();
