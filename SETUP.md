# 🚀 Paxeer Arbitrage Bot - Setup & Configuration Guide

## ✅ Installation Complete!

Your arbitrage bot is ready to use. Follow these steps to configure and launch it.

---

## 1️⃣ Configure Environment Variables

Copy the example configuration and fill in your credentials:

```bash
cp .env.example .env
```

Then edit `.env` with your actual credentials:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_FROM_BOTFATHER
TELEGRAM_CHAT_ID=YOUR_CHAT_ID

# Exchange API Configuration  
SIDIORA_API_KEY=your_sidiora_api_key
SIDIORA_API_SECRET=your_sidiora_api_secret
SIDIORA_API_URL=https://api.sidiora.exchange

# Paxeer Network Configuration
PAXEER_RPC_URL=https://rpc.paxeer.network
PAXEER_PRIVATE_KEY=your_private_key_here

# Trading Configuration
PROFIT_THRESHOLD_PERCENT=1
CHECK_INTERVAL_MS=5000
AUTO_EXECUTE_TRADES=true
TRADING_PAIR=SID/USDC
MAX_TRADE_SIZE_USD=1000

# Logging
LOG_LEVEL=info
```

### Obtaining Required Credentials:

**Telegram Bot Token:**
1. Chat with [@BotFather](https://t.me/botfather) on Telegram
2. Send `/start` then `/newbot`
3. Follow the prompts to create a new bot
4. Copy the HTTP API token

**Telegram Chat ID:**
1. Chat your bot
2. Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Look for your chat ID in the JSON response

**Sidiora Exchange API Keys:**
- Log in to your Sidiora Exchange account
- Go to Settings → API Keys
- Create a new API key with trading permissions
- Copy your API Key and Secret

**Paxeer Private Key:**
- Use your Paxeer wallet private key (keep it secure!)
- Start with a small amount for testing

---

## 2️⃣ Start the Bot

### Development Mode (with auto-restart):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

The bot will:
1. Connect to Telegram
2. Initialize the database  
3. Start monitoring SID/USDC prices
4. Send you alerts whenever arbitrage opportunities are found
5. Auto-execute trades (if enabled)

---

## 📊 Monitoring Your Bot

### Check Logs:
```bash
# View real-time logs
cat logs/app.log

# View errors only
cat logs/error.log
```

### Telegram Commands (future):
- `/status` - Current portfolio status
- `/stats` - Trading statistics  
- `/stop` - Stop the bot gracefully

---

## ⚙️ Configuration Options Explained

| Option | Default | Description |
|--------|---------|-------------|
| `PROFIT_THRESHOLD_PERCENT` | 1 | Minimum profit % to execute trade |
| `CHECK_INTERVAL_MS` | 5000 | How often to check for opportunities (milliseconds) |
| `AUTO_EXECUTE_TRADES` | true | Automatically execute or just alert |
| `MAX_TRADE_SIZE_USD` | 1000 | Maximum USD per trade |
| `LOG_LEVEL` | info | Logging detail (debug/info/warn/error) |

### Tuning Settings:

**For Active Trading:**
- `CHECK_INTERVAL_MS=5000` - Check frequently
- `PROFIT_THRESHOLD_PERCENT=0.5` - Execute on smaller profits
- `MAX_TRADE_SIZE_USD=5000` - Larger trades

**For Conservative Trading:**
- `CHECK_INTERVAL_MS=30000` - Check every 30 seconds
- `PROFIT_THRESHOLD_PERCENT=2` - Only very profitable trades
- `AUTO_EXECUTE_TRADES=false` - Alert only, manual approval

**For Testing:**
- `AUTO_EXECUTE_TRADES=false` - Don't execute, just monitor
- `PROFIT_THRESHOLD_PERCENT=0.1` - See all opportunities
- `LOG_LEVEL=debug` - Detailed logging

---

## 📈 Understanding the Bot's Output

### Telegram Alerts:

**Opportunity Alert:**
```
🚨 Arbitrage Opportunity Detected!

💰 Pair: SID/USDC
📊 Buy Venue: AMM/DEX @ 10.5000
📊 Sell Venue: Sidiora Exchange @ 10.6500

💵 Estimated Profit: $15.50
📈 Profit %: 1.43%
💳 Volume: 10.000000 SID
```

**Trade Executed:**
```
✅ SUCCESS Trade Executed

💰 Pair: SID/USDC
🏪 Buy: AMM/DEX
🏪 Sell: Sidiora Exchange

💵 Gross Profit: $15.50
💳 Fees: $3.21
💰 Net Profit: $12.29
📈 Profit %: 1.23%
```

---

## 🔒 Security Best Practices

1. **Keep Private Key Secure:**
   - Never commit `.env` file to git
   - Use environment-specific keys
   - Rotate keys regularly

2. **Use Read-Only API Keys:**
   - If possible, create separate read-only keys for price monitoring
   - Only use trading keys for execution

3. **Start Small:**
   - Begin with `MAX_TRADE_SIZE_USD=100`
   - Test with `AUTO_EXECUTE_TRADES=false`
   - Monitor for a few days before auto-trading

4. **Monitor Actively:**
   - Check logs daily
   - Review trade history
   - Watch for errors or unusual activity

---

## 🐛 Troubleshooting

### Bot not receiving Telegram messages:
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Verify `TELEGRAM_CHAT_ID` is a valid number
- Test with: `curl https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=test`

### No Price Data / Price Fetching Fails:
- Check `PAXEER_RPC_URL` is accessible
- Verify `SIDIORA_API_KEY` and `SIDIORA_API_SECRET` are correct
- Check network connectivity

### Trades Not Executing:
- Verify wallet has sufficient balance
- Check gas fees/network status
- Review `logs/error.log` for specific errors
- Ensure `AUTO_EXECUTE_TRADES=true`

### Database Issues:
- Check `data/` directory exists and has write permissions
- Delete `data/trades.db` to reset if corrupted
- Check available disk space

---

## 📝 Database

Your trades are stored in SQLite at: `data/trades.db`

Query recent trades:
```bash
sqlite3 data/trades.db "SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10;"
```

View profit stats:
```bash
sqlite3 data/trades.db "SELECT SUM(net_profit_usd) as total_profit, COUNT(*) as trades FROM trades WHERE status='completed';"
```

---

## 📞 Support & Next Steps

### Useful Links:
- [Telegraf.js Documentation](https://telegraf.dev/)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [Paxeer Network Docs](https://docs.paxeer.network/)
- [Sidiora Exchange API Docs](https://docs.sidiora.exchange/)

### Next Improvements:
- [ ] Add support for more trading pairs
- [ ] Implement maker/taker fee optimization
- [ ] Add telegram commands for live stats
- [ ] Support for multiple wallets
- [ ] Advanced order types (stops, limits)
- [ ] Risk management features
- [ ] Performance analytics dashboard

---

Good luck with your arbitrage trading! 🚀💰
