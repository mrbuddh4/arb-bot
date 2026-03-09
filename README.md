# Paxeer Arbitrage Bot

An automated Telegram bot that detects and executes arbitrage opportunities on the Paxeer Network / Sidiora Exchange using PostgreSQL for trade tracking.

## Features

- **Real-time Price Monitoring**: Continually monitors SID/USDC pair prices on AMM/DEX and exchange
- **Arbitrage Detection**: Identifies buy-low-on-AMM/sell-on-exchange and vice versa opportunities
- **Auto-Trade Execution**: Automatically executes profitable trades when opportunities exceed the 1% threshold
- **Telegram Notifications**: Real-time alerts with trade details and PnL updates
- **Portfolio Tracking**: Tracks all executed trades and cumulative PnL in PostgreSQL
- **Profit Threshold**: Configurable minimum profit percentage (default: 1%)
- **Advanced Analytics**: Daily stats, price history, win rate tracking

## Installation

1. **Set up PostgreSQL Database**
   - Install PostgreSQL 13+ on your system
   - Create database `arb_bot` and user `arb_bot_user`
   - See [POSTGRES_SETUP.md](POSTGRES_SETUP.md) for detailed instructions

2. **Clone and Install**
```bash
cd arb-bot
npm install
```

3. **Create a `.env` file** from the template:
```bash
cp .env.example .env
```

4. **Configure your `.env` file**
   - **Telegram**: Get your bot token from [@BotFather](https://t.me/botfather) and your chat ID
   - **Exchange API**: Add your Sidiora Exchange API credentials
   - **Paxeer Network**: Add your RPC URL and private key for transaction execution
   - **PostgreSQL**: Configure your database connection (see POSTGRES_SETUP.md)

5. **Start the bot**:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Configuration

Edit `.env` to customize:
- `PROFIT_THRESHOLD_PERCENT`: Minimum profit % to trigger trade (default: 1%)
- `CHECK_INTERVAL_MS`: How often to check for opportunities (default: 5000ms)
- `AUTO_EXECUTE_TRADES`: Enable/disable automatic execution (default: true)
- `MAX_TRADE_SIZE_USD`: Maximum USD value per trade (default: $1000)

## Project Structure

```
arb-bot/
├── src/
│   ├── index.js               # Main entry point
│   ├── config.js              # Configuration loader
│   ├── logger.js              # Logging setup
│   └── modules/
│       ├── telegram.js        # Telegram bot integration
│       ├── priceFetcher.js    # Price monitoring
│       ├── arbitrage.js       # Arbitrage detection logic
│       ├── trader.js          # Trade execution
│       ├── portfolio.js       # Portfolio tracking
│       └── database.js        # SQLite database
├── config/
│   └── database.sql           # Database schema
├── logs/                      # Bot logs
├── .env.example               # Environment variables template
└── package.json               # Dependencies

## How It Works

1. **Price Monitoring**: Continuously fetches prices from both AMM/DEX and Sidiora Exchange
2. **Opportunity Detection**: Calculates profit margin for buy-low/sell-high scenarios
3. **Trade Execution**: When profit > threshold, executes trades on both venues
4. **Telegram Alerts**: Sends real-time notifications with:
   - Profit opportunity details
   - Trade execution status
   - Profit/Loss results
   - Portfolio summary
5. **Database Tracking**: Stores all trades and cumulative performance metrics

## Risk Management

- **Profit Threshold**: Only executes trades with >1% profit margin
- **Max Trade Size**: Limits single trade to $1000 USD (configurable)
- **Error Handling**: Graceful failures with Telegram alerts
- **Rate Limiting**: Respects API rate limits from exchange and RPC

## Security

- Never commit `.env` with real credentials
- Use read-only API keys if possible
- Keep private key secure and use environment variables
- Regularly rotate API credentials

## Troubleshooting

Check `logs/app.log` for detailed error messages.

Common issues:
- **Bot not receiving messages**: Verify TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
- **Price fetching fails**: Check API credentials and RPC URL connectivity
- **Trades not executing**: Ensure private key has sufficient balance and gas

## License

MIT
