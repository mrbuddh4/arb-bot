# PostgreSQL Setup Guide

Your arbitrage bot now uses PostgreSQL instead of SQLite. This guide will help you set it up.

## 📦 Installation

### Windows

1. **Download PostgreSQL installer**
   - Visit [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
   - Download PostgreSQL 15 or higher

2. **Run the installer**
   - Follow the wizard
   - Set password for `postgres` user (remember this!)
   - Default port is `5432`
   - Keep stack builder selected at end

3. **Verify Installation**
   ```powershell
   psql --version
   ```

### macOS

```bash
# Using Homebrew
brew install postgresql@15
brew services start postgresql@15

# Verify
psql --version
```

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify
psql --version
```

---

## 🗄️ Create Database & User

### 1. Connect to PostgreSQL

```bash
psql -U postgres
```

You'll be prompted for the password you set during installation.

### 2. Create Database

```sql
CREATE DATABASE arb_bot;
```

### 3. Create Database User

```sql
CREATE USER arb_bot_user WITH PASSWORD 'your_secure_password_here';
```

### 4. Grant Permissions

```sql
ALTER ROLE arb_bot_user SET client_encoding TO 'utf8';
ALTER ROLE arb_bot_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE arb_bot_user SET default_transaction_deferrable TO on;
ALTER ROLE arb_bot_user SET default_transaction_read_only TO off;

GRANT ALL PRIVILEGES ON DATABASE arb_bot TO arb_bot_user;

-- Connect to the database to set additional permissions
\c arb_bot

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO arb_bot_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO arb_bot_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO arb_bot_user;
```

### 5. Exit PostgreSQL

```sql
\q
```

---

## ⚙️ Configure the Bot

Update your `.env` file:

```env
# PostgreSQL Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=arb_bot
DATABASE_USER=arb_bot_user
DATABASE_PASSWORD=your_secure_password_here
DATABASE_SSL=false
```

For production/remote servers:
```env
DATABASE_HOST=your.postgres.server.com
DATABASE_PORT=5432
DATABASE_NAME=arb_bot
DATABASE_USER=arb_bot_user
DATABASE_PASSWORD=your_secure_password_here
DATABASE_SSL=true
```

---

## 🚀 Start the Bot

```bash
npm start
```

The bot will automatically create all required tables on first run.

---

## 📊 Query Your Data

### Connect to Database

```bash
psql -U arb_bot_user -d arb_bot
```

### View Recent Trades

```sql
SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10;
```

### Get Profit Summary

```sql
SELECT 
  COUNT(*) as total_trades,
  ROUND(SUM(net_profit_usd)::numeric, 2) as total_profit,
  ROUND(AVG(net_profit_usd)::numeric, 2) as avg_profit,
  ROUND(MAX(net_profit_usd)::numeric, 2) as best_trade,
  ROUND(MIN(net_profit_usd)::numeric, 2) as worst_trade,
  ROUND(AVG(profit_percent)::numeric, 2) as avg_profit_percent,
  ROUND((COUNT(CASE WHEN net_profit_usd > 0 THEN 1 END)::float / COUNT(*) * 100)::numeric, 1) as win_rate
FROM trades WHERE status = 'completed';
```

### Daily Performance

```sql
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as trades,
  ROUND(SUM(net_profit_usd)::numeric, 2) as daily_profit,
  ROUND(AVG(profit_percent)::numeric, 2) as avg_profit_percent
FROM trades 
WHERE status = 'completed'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

### Price History for Analysis

```sql
SELECT venue, AVG(price) as avg_price, MIN(price) as min, MAX(price) as max
FROM prices
WHERE trading_pair = 'SID/USDC'
AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY venue;
```

---

## 🔍 Monitoring & Maintenance

### Check Database Size

```sql
SELECT 
  schemaname, 
  tablename, 
  round(pg_total_relation_size(schemaname || '.' || tablename) / 1024 / 1024::numeric, 2) as size_mb
FROM pg_tables 
WHERE schemaname != 'pg_catalog'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```

### Backup Database

```bash
# Dump entire database
pg_dump -U arb_bot_user -d arb_bot > arb_bot_backup.sql

# Dump specific table
pg_dump -U arb_bot_user -d arb_bot -t trades > trades_backup.sql
```

### Restore from Backup

```bash
psql -U arb_bot_user -d arb_bot < arb_bot_backup.sql
```

### Clean Old Prices (Optional)

```sql
DELETE FROM prices WHERE timestamp < NOW() - INTERVAL '30 days';
```

---

## 🔧 Troubleshooting

### "Connection refused"
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify host, port, and credentials in `.env`
- Check firewall doesn't block port 5432

### "FATAL: Ident authentication failed"
- You need to use password authentication
- Update `pg_hba.conf` to use `md5` or `scram-sha-256` instead of `ident`
- Location varies by OS - check PostgreSQL docs

### "SSL connection refused"
- If using local PostgreSQL, set `DATABASE_SSL=false`
- For services like AWS RDS, set `DATABASE_SSL=true`

### "Too many connections"
- Close old connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid();`
- Default is 100 concurrent connections (usually plenty)

---

## 📈 Performance Tips

1. **Enable Connection Pooling** (if running multiple bots)
   - Use PgBouncer for connection pooling

2. **Regular Backups**
   ```bash
   pg_dump -U arb_bot_user -d arb_bot | gzip > backup_$(date +%Y%m%d).sql.gz
   ```

3. **Index Optimization**
   - Existing indexes on `timestamp` and `venue` are already configured
   - Add custom indexes for frequently queried fields

4. **Archive Old Trades**
   ```sql
   CREATE TABLE trades_archive AS SELECT * FROM trades WHERE timestamp < NOW() - INTERVAL '1 year';
   DELETE FROM trades WHERE timestamp < NOW() - INTERVAL '1 year';
   ```

---

## 🌐 Remote Database (Cloud)

### AWS RDS
```env
DATABASE_HOST=your-instance.region.rds.amazonaws.com
DATABASE_PORT=5432
DATABASE_SSL=true
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=arb_bot
```

### Google Cloud SQL
```env
DATABASE_HOST=35.192.xxx.xxx
DATABASE_PORT=5432
DATABASE_SSL=true
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=arb_bot
```

### Heroku Postgres
```env
# Heroku provides DATABASE_URL in format:
# postgres://user:password@host:port/dbname
# Parse and set individual variables:
DATABASE_HOST=host
DATABASE_PORT=port
DATABASE_USER=user
DATABASE_PASSWORD=password
DATABASE_NAME=dbname
```

---

## 📚 PostgreSQL Resources

- [Official PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL vs SQLite Comparison](https://www.postgresql.org/about/news/difference-between-postgresql-and-sqlite/)
- [Connection Pooling with PgBouncer](https://pgbouncer.github.io/)

---

All tables and indexes are automatically created on bot startup!
