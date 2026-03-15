# Deployment Guide: GitHub + Railway

Your arbitrage bot is now connected to GitHub and ready to deploy on Railway! 🚀

## GitHub Setup ✅

Your repository is live at: **[https://github.com/mrbuddh4/arb-bot](https://github.com/mrbuddh4/arb-bot)**

**Current Status:**
- ✅ Repository initialized locally
- ✅ All files committed
- ✅ Pushed to GitHub main branch
- ✅ Procfile configured for Railway

---

## Deploy to Railway

### Step 1: Connect GitHub to Railway

1. Go to [railway.app](https://railway.app)
2. Log in to your account
3. Click **"Create New Project"**
4. Select **"Deploy from GitHub repo"**
5. Click **"Install Railway GitHub App"** if not already installed
6. Select your GitHub account and authorize Railway
7. Choose the **arb-bot** repository

### Step 2: Configure Environment Variables

Railway will surface the deployment page. Add these variables:

```
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# Sidiora Exchange API
SIDIORA_API_KEY=your_api_key
SIDIORA_API_SECRET=your_api_secret
SIDIORA_API_URL=https://api.sidiora.exchange

# Paxeer Network
PAXEER_RPC_URL=https://rpc.paxeer.network
PAXEER_PRIVATE_KEY=your_private_key

# Token Addresses (Paxeer Network)
SID_TOKEN_ADDRESS=0x...
USDC_TOKEN_ADDRESS=0x...
SIDIORA_ROUTER_ADDRESS=0x...

# Database (PostgreSQL on Railway)
DATABASE_HOST=${{Postgres.PGHOST}}
DATABASE_PORT=${{Postgres.PGPORT}}
DATABASE_NAME=${{Postgres.PGDATABASE}}
DATABASE_USER=${{Postgres.PGUSER}}
DATABASE_PASSWORD=${{Postgres.PGPASSWORD}}

# Trading Configuration
PROFIT_THRESHOLD_PERCENT=1
CHECK_INTERVAL_MS=5000
AUTO_EXECUTE_TRADES=true
TRADING_PAIR=SID/USDC
MAX_TRADE_SIZE_USD=1000
LOG_LEVEL=info
DATABASE_SSL=true
```

### Step 3: Add PostgreSQL Database

1. In Railway dashboard, click **"Add Service"**
2. Search for **PostgreSQL** and select it
3. Railway automatically creates the database
4. Uses the variables above: `${{Postgres.PGHOST}}`, etc.

This is automatically connected to your app's environment variables!

### Step 4: Deploy

1. Click **"Deploy"** button
2. Railway builds and starts your app
3. Watch the deployment logs
4. Click to view app logs for real-time monitoring

---

## Environment Variable Reference

### Telegram Configuration
- `TELEGRAM_BOT_TOKEN` - Get from [@BotFather](https://t.me/botfather) on Telegram
- `TELEGRAM_CHAT_ID` - Your chat ID where alerts are sent

### Sidiora Exchange
- `SIDIORA_API_KEY` - From Sidiora dashboard
- `SIDIORA_API_SECRET` - From Sidiora dashboard
- `SIDIORA_API_URL` - Exchange API endpoint (default: https://api.sidiora.exchange)

### Paxeer Network
- `PAXEER_RPC_URL` - RPC endpoint (default: https://rpc.paxeer.network)
- `PAXEER_PRIVATE_KEY` - Private key for Paxeer account (hex format, 0x...)

### Token Addresses (Paxeer Network) - **REQUIRED FOR REAL TRADES**
- `SID_TOKEN_ADDRESS` - SID token contract address (0x...)
- `USDC_TOKEN_ADDRESS` - USDC token contract address (0x...)
- `SIDIORA_ROUTER_ADDRESS` - Sidiora DEX router address (0x...)

### Trading Parameters
- `PROFIT_THRESHOLD_PERCENT` - Minimum profit % to trigger trade (default: 1)
- `CHECK_INTERVAL_MS` - Price check frequency in ms (default: 5000)
- `AUTO_EXECUTE_TRADES` - Auto-execute trades (default: true)
- `MAX_TRADE_SIZE_USD` - Maximum trade size in USD (default: 1000)
- `TRADING_PAIR` - Trading pair (default: SID/USDC)
- `LOG_LEVEL` - Logging level (default: info)

---

## Continuous Deployment

Any push to `main` branch automatically triggers deployment:

```bash
git add .
git commit -m "Update configuration"
git push origin main
```

Railway detects the push and:
1. Pulls latest code
2. Installs dependencies (`npm install`)
3. Runs `npm start`
4. Restarts the app with new code

---

## Monitoring & Logs

### View Logs in Railway

1. Go to your project dashboard
2. Click **"Logs"** tab
3. Stream real-time logs from your bot

### Check Deployment Status

```bash
# View recent commits/deployments
git log --oneline
```

### Common Logs to Look For

✅ **Success:**
```
PostgreSQL database connected
Database schema initialized
Telegram bot initialized
Bot started - monitoring for opportunities
```

❌ **Errors:**
```
Error connecting to database - would indicate PostgreSQL connection issue
Missing TELEGRAM_BOT_TOKEN - would indicate missing env var
```

---

## Database Backups

Railway PostgreSQL includes automatic backups:

1. Dashboard → PostgreSQL addon
2. Click **"Backups"** tab
3. View automatic daily backups
4. Restore from backup if needed

For manual backup from Railway:

```bash
# Get connection details from Railway dashboard
pg_dump -h <host> -U <user> -d <dbname> -W > backup.sql
```

---

## Scaling & Troubleshooting

### If Bot Goes Down

1. Check Railway dashboard → **Logs**
2. Common issues:
   - Missing environment variables → Add in Railway dashboard
   - Database connection → Verify PostgreSQL addon is running
   - API rate limits → Check Sidiora/Paxeer API status

### Scale Your App

1. In Railway dashboard
2. Click **"Settings"**
3. Adjust **Container Size** (CPU/Memory)
4. Default small size usually sufficient for this bot

### View App Link

After deployment, Railway provides a URL like:
```
https://arb-bot-production-xxxx.railway.app
```

(Your bot runs as a background service, so this might show 404)

---

## Git Workflow

### Make Changes Locally

```bash
# Edit files
code src/modules/trader.js

# Test locally
npm start

# Commit and push
git add src/modules/trader.js
git commit -m "Improve trade execution logic"
git push origin main
```

### Railway Auto-Deploys

The push automatically triggers:
- ✅ New deployment starts
- ✅ Dependencies installed
- ✅ App restarted with latest code
- ✅ Logs available in dashboard

---

## Local Development vs Production

### Local (During Development)
```bash
.env file with:
DATABASE_HOST=localhost
NODE_ENV=development
```

### Production (On Railway)
```bash
DATABASE_HOST=${{Postgres.PGHOST}}
NODE_ENV=production
```

---

## Useful Commands

```bash
# View git status
git status

# See all commits
git log --oneline

# Check remote
git remote -v

# Create new branch for features
git checkout -b feature/better-arbitrage-detection

# Merge back to main
git checkout main
git merge feature/better-arbitrage-detection
git push origin main
```

---

## Security Best Practices

✅ **Do:**
- Store all secrets in Railway environment variables
- Use `.env.example` for template (never commit actual `.env`)
- Enable DATABASE_SSL=true for production
- Grant minimal permissions to database user

❌ **Don't:**
- Commit `.env` file (it's in `.gitignore`)
- Share private keys via repositories
- Use DATABASE_SSL=false in production
- Push sensitive data to GitHub

---

## Next Steps

1. ✅ Push code to GitHub - **DONE**
2. Visit [railway.app](https://railway.app) and connect GitHub repo
3. Add PostgreSQL addon
4. Configure environment variables
5. Deploy and monitor logs
6. Test arbitrage detection

Your bot is now set up for cloud deployment! 🎉
