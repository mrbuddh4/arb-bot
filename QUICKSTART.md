# ⚡ QUICKSTART - Get Running in 5 Minutes

## Step 1: Configure Credentials (2 minutes)

```bash
cp .env.example .env
```

Edit `.env` and add:
- `TELEGRAM_BOT_TOKEN` - Get from [@BotFather](https://t.me/botfather)
- `TELEGRAM_CHAT_ID` - Your Telegram user ID
- `SIDIORA_API_KEY` and `SIDIORA_API_SECRET` - From Sidiora Exchange
- `PAXEER_PRIVATE_KEY` - Your wallet private key

## Step 2: Start Bot (1 minute)

```bash
npm start
```

Or with auto-restart during development:
```bash
npm run dev
```

## Step 3: Verify It's Running (2 minutes)

- ✅ You'll see logs in terminal
- ✅ Check `logs/app.log` for detailed output
- ✅ You'll receive Telegram messages when opportunities are found

---

## That's It! 🎉

The bot will now:
1. Monitor SID/USDC prices every 5 seconds
2. Detect arbitrage opportunities (>1% profit)
3. Send Telegram alerts
4. Auto-execute profitable trades (if enabled)
5. Track all trades in database

---

## Key Files Reference

```
arb-bot/
├── .env                    ← Your credentials (edit this!)
├── src/
│   ├── index.js          ← Main bot logic
│   ├── config.js         ← Configuration loader
│   ├── logger.js         ← Logging setup
│   └── modules/
│       ├── telegram.js   ← Telegram integration
│       ├── priceFetcher.js ← Price monitoring
│       ├── arbitrage.js  ← Opportunity detection
│       ├── trader.js     ← Trade execution
│       ├── portfolio.js  ← Portfolio tracking
│       └── database.js   ← Trade history
├── data/
│   └── trades.db         ← SQLite database
├── logs/
│   ├── app.log          ← Daily logs
│   └── error.log        ← Error logs
├── README.md            ← Full documentation
└── SETUP.md             ← Detailed configuration
```

---

## Telegram Commands

Once bot is running, you can message it:
- `/start` - Get welcome message
- `/help` - Show available commands
- `/status` - Portfolio status (coming soon)
- `/stats` - Trading stats (coming soon)

---

## Stop the Bot

Press `Ctrl+C` in the terminal to gracefully shut down.

---

## Troubleshooting

**Bot won't start?**
- Check `.env` file exists and has values
- Check `logs/app.log` for error messages

**No Telegram messages?**
- Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`
- Make sure bot has permission to message you

**Price fetching fails?**
- Check RPC URL and API credentials
- Verify network connectivity

---

Read [SETUP.md](SETUP.md) for advanced configuration and optimization tips.

Good luck! 🚀
