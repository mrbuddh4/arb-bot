# 🏗️ Paxeer Arbitrage Bot - Architecture & Components

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Telegram Notifications                      │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              │ (Alerts, Updates)
                              │
┌─────────────────────────────────────────────────────────────┐
│                        Bot Main Loop                          │
│  (index.js - Orchestrates all components)                   │
└─────────────────────────────────────────────────────────────┘
    │              │              │              │
    ▼              ▼              ▼              ▼
┌─────────┐ ┌─────────────┐ ┌──────────┐ ┌────────────┐
│ Price   │ │ Arbitrage   │ │  Trader  │ │ Portfolio  │
│ Fetcher │ │ Detector    │ │          │ │            │
│         │ │             │ │          │ │            │
└─────────┘ └─────────────┘ └──────────┘ └────────────┘
    │              │              │              │
    ▼              ▼              ▼              ▼
  ┌────────────────────────────────────────────────┐
  │            Database (SQLite)                   │
  │                                                │
  │  - trades (history)                           │
  │  - prices (time-series)                       │
  │  - portfolio (snapshots)                      │
  └────────────────────────────────────────────────┘
    │              │              │
    ▼              ▼              ▼
┌─────────┐ ┌────────────────┐ ┌──────────────┐
│ Sidiora │ │  Paxeer Network│ │  AMM/DEX     │
│Exchange │ │     (RPC)      │ │              │
└─────────┘ └────────────────┘ └──────────────┘
```

---

## Core Components

### 1. **Price Fetcher** (`priceFetcher.js`)

Monitors real-time prices across venues:
- **Sidiora Exchange** - Centralized exchange prices via API
- **AMM/DEX** - Decentralized exchange via RPC calls

**Key Methods:**
- `fetchSidioraPrice()` - Get Sidiora spot price
- `fetchAMMPrice()` - Get DEX/AMM price via contract
- `fetchAllPrices()` - Fetch from both venues
- `getPriceDifference()` - Calculate spread

### 2. **Arbitrage Detector** (`arbitrage.js`)

Identifies profitable trading opportunities:
- Compares prices between venues
- Calculates potential profit/loss
- Applies profit threshold filter

**Key Methods:**
- `detectOpportunities()` - Scans for arbitrage
- `calculateProfitability()` - Computes exact profit
- `selectBestOpportunity()` - Ranks by profit %

**Opportunities:**
- **Type 1**: Buy low on AMM → Sell high on Sidiora
- **Type 2**: Buy low on Sidiora → Sell high on AMM

### 3. **Trader** (`trader.js`)

Executes trades on both venues:
- Buys on cheaper venue
- Sells on expensive venue
- Handles gas/fees

**Key Methods:**
- `executeTrade()` - Run complete arbitrage cycle
- `executeBuyOnAMM()` - Execute DEX purchase
- `executeSellOnExchange()` - Place sell order on Sidiora
- `estimateGasCost()` - Calculate transaction costs

### 4. **Portfolio Tracker** (`portfolio.js`)

Tracks trading performance:
- Total profit/loss
- Trade history
- Win rate calculation

**Key Methods:**
- `refresh()` - Update portfolio stats from DB
- `getStatistics()` - Aggregate performance metrics
- `getRecentPerformance()` - Period-based analytics
- `getSummary()` - Complete portfolio overview

### 5. **Database** (`database.js`)

Persistent storage using SQLite:

**Tables:**
- `trades` - Every executed trade with full details
- `prices` - Price history with timestamps
- `portfolio` - Daily portfolio snapshots

**Key Methods:**
- `recordTrade()` - Store trade results
- `recordPrice()` - Log price samples
- `getTotalProfitUsd()` - Cumulative profit
- `getRecentTrades()` - Trade history queries

### 6. **Telegram Bot** (`telegram.js`)

Real-time user notifications:
- Opportunity alerts
- Execution confirmations
- Error notifications
- Portfolio updates

**Alert Types:**
- 🚨 Opportunity Detection with profit %
- ✅ Trade Success with net profit
- ❌ Trade Failed with error details
- 📊 Portfolio Updates

---

## Trading Flow

```
1. INITIALIZATION
   └─ Load config
   └─ Connect Telegram
   └─ Initialize database
   └─ Listen to market

2. PRICE MONITORING (Every 5 seconds)
   ├─ Fetch Sidiora price
   ├─ Fetch AMM price
   ├─ Log prices to DB
   └─ Detect spread

3. OPPORTUNITY DETECTION
   ├─ Calculate price difference
   ├─ Check profit threshold (>1%)
   ├─ Estimate profitability
   ├─ Calculate max safe quantity
   └─ Filter unfeasible trades

4. TRADE EXECUTION
   ├─ IF auto-execute enabled:
   │   ├─ Execute buy on cheap venue
   │   ├─ Execute sell on expensive venue
   │   ├─ Record transaction hashes
   │   └─ Store results in DB
   └─ IF alert-only mode:
       └─ Send Telegram notification

5. NOTIFICATIONS
   ├─ Send opportunity alert
   ├─ Send execution result
   ├─ Send portfolio update
   └─ Log to file

6. REPEAT
   └─ Loop back to price monitoring
```

---

## Configuration Hierarchy

```
Environment Variables (.env)
        ↓
    ├─ config.js (parsed config)
    │   ├─ telegram settings
    │   ├─ exchange API credentials
    │   ├─ trading parameters
    │   └─ logging level
    │
    └─ Applied to:
        ├─ telegram.js (sends messages)
        ├─ priceFetcher.js (calls exchanges)
        ├─ trader.js (executes with limits)
        └─ arbitrage.js (profit threshold)
```

---

## Data Flow Diagram

```
┌──────────────────┐
│   Exchanges      │
│  Sidiora, AMM    │
└────────┬─────────┘
         │
         ▼
    [Fetch Prices]
         │
         ▼
    [Compare Spreads]
         │
         ├─────────────────────┐
         │                     │
    Spread < 1%         Spread ≥ 1%
         │                     │
         ▼                     ▼
    [Skip]         [Calculate Profitability]
                            │
                ┌───────────┴───────────┐
                │                       │
          Profit > Fee?          Profit ≤ Fee?
                │                       │
                ▼                       ▼
          [Execute]              [Skip/Alert]
                │
         ┌──────┴──────┐
         │             │
    [Buy Cheap]   [Sell High]
         │             │
         └──────┬──────┘
                ▼
        [Record Results]
         │      │      │
         ▼      ▼      ▼
        DB  Telegram  Logs
```

---

## Error Handling & Resilience

**Graceful Degradation:**
- Missing prices? Skip that check cycle
- API timeout? Retry in next interval
- Trade failure? Log and alert, continue monitoring
- Database error? Cache in memory, retry later

**Recovery Mechanisms:**
- Automatic database reconnection
- Telegram bot respawn on failure
- Process-level error handlers
- Winston logger for tracking issues

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Check Interval | 5 seconds (configurable) |
| Price Fetch Time | <500ms typical |
| Arbitrage Detection | <100ms |
| Trade Execution | 5-15 seconds (on-chain) |
| Database Query Speed | <50ms |
| Memory Usage | ~50-100MB typical |
| CPU Usage | Minimal (<5% idle) |

---

## Security Considerations

1. **Private Key Management:**
   - Never logged or displayed
   - Kept in environment only
   - Consider hardware wallet integration

2. **API Credentials:**
   - Stored in .env locally
   - Not committed to git
   - Consider key rotation

3. **Trade Safety:**
   - MAX_TRADE_SIZE_USD limits risk
   - Profit threshold prevents losses
   - Slippage tolerance (future feature)

4. **Data Security:**
   - SQLite local storage only
   - No external data transmission
   - Logs don't contain credentials

---

## Future Enhancement Opportunities

**Planned:**
- Multi-pair trading support
- Advanced order types (stops, limits)
- Risk management framework
- Performance dashboard
- Trade analytics
- Telegram command interface

**Possible:**
- Machine learning price prediction
- Multiple wallet support
- Hardware wallet integration
- Market making strategies
- Options trading support
- Cross-chain arbitrage

---

## Testing & Debugging

**Development Mode:**
```bash
npm run dev
LOG_LEVEL=debug node src/index.js
```

**Dry Run (Alert Only):**
```bash
AUTO_EXECUTE_TRADES=false npm start
```

**Database Inspection:**
```bash
sqlite3 data/trades.db
sqlite> SELECT * FROM trades;
sqlite> SELECT * FROM prices WHERE venue='Sidiora';
```

---

## Deployment Considerations

**Local Development:**
- PM2 for process management
- Supervisor for monitoring
- Nginx/Caddy for alerting webhook

**Cloud Deployment:**
- Docker containerization
- AWS Lambda/Google Cloud Functions
- managed databases (optional)
- Cloud logging (CloudWatch, Stackdriver)

---

For questions or modifications, refer to individual module documentation in the code comments.
