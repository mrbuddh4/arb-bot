# Railway Deployment Troubleshooting

## Current Issues 🔴

Based on your logs:

```
❌ Failed to connect to PostgreSQL: ECONNREFUSED (host=localhost, port=5432)
❌ Failed to fetch Sidiora price from https://api.sidiora.exchange: getaddrinfo ENOTFOUND
❌ Failed to fetch AMM price from RPC https://rpc.paxeer.network: getaddrinfo ENOTFOUND
```

---

## Issue #1: PostgreSQL Connection Refused

**Problem**: Bot is trying to connect to `localhost:5432` instead of Railway's PostgreSQL service.

**Solution**:

1. **Check if PostgreSQL service exists in Railway**:
   - Go to your Railway project dashboard
   - Click "Add Service" → "Database" → "PostgreSQL"
   - Wait for it to provision (1-2 minutes)

2. **Verify PostgreSQL environment variables are set**:
   - In Railway, click on the PostgreSQL service
   - go to the "Variables" tab
   - You should see:
     - `DATABASE_URL` (or individual vars: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD)

3. **Add these to your Node app service environment**:
   - In Railway app service settings → "Variables":
   
   ```
   DATABASE_HOST=${{Postgres.PGHOST}}
   DATABASE_PORT=${{Postgres.PGPORT}}
   DATABASE_NAME=${{Postgres.PGDATABASE}}
   DATABASE_USER=${{Postgres.PGUSER}}
   DATABASE_PASSWORD=${{Postgres.PGPASSWORD}}
   DATABASE_SSL=true
   ```
   
   OR use the connection string:
   
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ```

4. **Redeploy** after setting variables.

---

## Issue #2: Sidiora API Unreachable

**Problem**: `api.sidiora.exchange` is not resolving (DNS not found).

**Solutions**:

1. **Verify the URL is correct**:
   - Is `https://api.sidiora.exchange` the right endpoint?
   - Check Sidiora documentation
   - Try pinging it from your local machine:
   ```bash
   curl https://api.sidiora.exchange/v1/ping
   ```

2. **If URL is correct but still fails**:
   - Might be an IP whitelist issue
   - Contact Sidiora support to allow Railway IP range

3. **If URL is different**:
   - Update your Railway environment variable:
   ```
   SIDIORA_API_URL=https://correct-url-here.com
   ```

---

## Issue #3: Paxeer RPC Unreachable ❌ NOT NEEDED

**UPDATE**: The DEX uses **GraphQL**, not JSON-RPC for price fetching!

**New Issue**: Missing GRAPHQL_ENDPOINT environment variable

**Solution**:

1. **Get the correct GraphQL endpoint**:
   - Ask the CEO or check browser DevTools (F12) Network tab
   - The endpoint might be `https://api.sidiora.exchange/graphql` or similar
   - Store it in Railway environment as `GRAPHQL_ENDPOINT`

2. **Set GRAPHQL_ENDPOINT in Railway**:
   ```
   GRAPHQL_ENDPOINT=https://api.sidiora.exchange/graphql
   ```
   (or whatever the actual endpoint is)

3. **GraphQL Query Format**:
   - The bot queries for SID/USDC pair data
   - Needs `token0Price` or `reserve0`/`reserve1` to calculate price
   - Query structure:
   ```graphql
   query {
     pairs(first: 1, where: { token0: "USDC_ADDRESS", token1: "SID_ADDRESS" }) {
       token0Price
       token1Price
       reserve0
       reserve1
     }
   }
   ```

---

## Updated Endpoint Summary

| Service | Type | Endpoint | Status |
|---------|------|----------|--------|
| Sidiora API | REST | https://api.sidiora.exchange | ✅ Confirmed |
| DEX Prices | **GraphQL** | `GRAPHQL_ENDPOINT` env var | ❌ **Needs to be set** |
| PostgreSQL | Native | ${{Postgres.*}} vars | ❌ Not connected |



---

## Checklist to Fix Deployment

- [ ] **PostgreSQL Service** - Added to Railway project
- [ ] **Database Credentials** - DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME set in app environment
- [ ] **Sidiora API URL** - Verified working: `curl https://api.sidiora.exchange`
- [ ] **Paxeer RPC URL** - Verified working: `curl -X POST https://rpc.paxeer.network`
- [ ] **API Keys** - SIDIORA_API_KEY and SIDIORA_API_SECRET set
- [ ] **Private Key** - PAXEER_PRIVATE_KEY set (0x... format)
- [ ] **Telegram** - TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID set
- [ ] **Token Addresses** - SID_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS, SIDIORA_ROUTER_ADDRESS set

---

## Testing Connection to Services

From Railway logs, run these commands to test:

```bash
# Test PostgreSQL
psql postgresql://user:password@host:port/database

# Test Sidiora
curl -H "X-API-Key: your_key" https://api.sidiora.exchange/v1/prices

# Test Paxeer RPC
curl -X POST https://rpc.paxeer.network -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

---

## Expected Log Output (When Fixed)

```
✅ PostgreSQL database connected
✅ Sidiora price: $12.34
✅ AMM price: $12.10
🎯 Found 1 opportunity(ies)
✅ Bot started - checking every 5000ms
```

---

## If Still Failing

**Collect this info and share**:

1. PostgreSQL service name and status in Railway
2. Output of these curl commands (from your local machine):
   - `curl https://api.sidiora.exchange`
   - `curl https://rpc.paxeer.network` 
3. Full error message from Railway logs (last 50 lines)
4. Check if APIs are on internal network only (VPN required?)

---

## More Info

- [Railway PostgreSQL Documentation](https://docs.railway.app/databases/postgres)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- [Railway Networking](https://docs.railway.app/develop/networking)
