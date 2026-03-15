# Real Blockchain Trade Execution

## Overview

The Trader module has been upgraded from **simulated** trade execution to **real blockchain transactions**. The bot now executes actual arbitrage trades on:

1. **AMM/DEX** (Decentralized Exchange) - via Uniswap V2-compatible router
2. **Sidiora Exchange** - via REST API

---

## Key Changes

### 1. **AMM Trade Execution** (`executeBuyOnAMM` / `executeSellOnAMM`)

**Before (Simulated):**
```javascript
// Just generated fake tx hashes
const txHash = `0x${Math.random().toString(16).substring(2)}`;
```

**Now (Real):**
- Uses ethers.js to interact with DEX router contract
- Executes `swapExactTokensForTokens` on the Uniswap V2 router
- Handles ERC20 token approvals automatically
- Waits for transaction confirmation before returning
- Implements 5% slippage protection

```javascript
const tx = await router.swapExactTokensForTokens(
  amountInMax,
  minAmountOut,
  path,
  this.signer.address,
  deadline
);
await tx.wait(); // Wait for blockchain confirmation
```

### 2. **Token Approval** (`approveToken`)

NEW METHOD: Automatically approves token spending for the router address

- Checks current allowance
- Skips approval if already sufficient
- Approves with unlimited allowance for efficiency
- Waits for confirmation

```javascript
await this.approveToken(
  tokenAddress,
  routerAddress,
  amount
);
```

### 3. **Sidiora Exchange** (`executeBuyOnSidiora` / `executeSellOnSidiora`)

**Before:** Basic placeholder
**Now:** Full order placement with proper error handling

- Places limit orders on Sidiora Exchange API
- Validates API response
- Proper headers and authentication
- Timeout handling

### 4. **Balance Checking** (`checkBalances` / `getBalance`)

NEW METHODS: Real blockchain balance queries

```javascript
const balances = await trader.checkBalances();
// { sid: 100.5, usdc: 5000 }
```

---

## Required Environment Variables

Add these to your `.env` file (copies provided in `.env.example`):

```bash
# Token addresses on Paxeer Network
SID_TOKEN_ADDRESS=0x...
USDC_TOKEN_ADDRESS=0x...
UNISWAP_ROUTER_ADDRESS=0x...  # DEX router (Uniswap V2 compatible)
```

**How to get these:**

1. **Token Addresses**: Find on Paxeer Network explorer or search official docs
2. **Router Address**: Check the DEX/AMM protocol (Uniswap, SushiSwap, etc.) on Paxeer

---

## How It Works

### Trade Execution Flow

```
Opportunity Detected
  ↓
Check auto-trading enabled?
  ↓
IF buying on AMM → buying on Sidiora:
  1. Approve USDC for router
  2. Swap USDC → SID on AMM (via router)
  3. Wait for block confirmation
  4. Place sell order on Sidiora
  5. Record trade in database
  ↓
IF buying on Sidiora → buying on AMM:
  1. Place buy order on Sidiora
  2. Wait for order fill
  3. Approve SID for router
  4. Swap SID → USDC on AMM (via router)
  5. Wait for block confirmation
  6. Record trade in database
```

### Error Handling

- **All errors are caught and logged**
- Failed trades are recorded in database with error message
- Failures don't crash the bot - it continues monitoring
- Gas errors, slippage errors, approval failures all handled

```javascript
} catch (error) {
  logger.error(`❌ Trade execution failed: ${error.message}`);
  database.recordTrade({
    status: 'failed',
    error: error.message,
  });
  return { success: false, error: error.message };
}
```

---

## Safety Features

### 1. **Slippage Protection**

Enforces 5% slippage limit per transaction:
```javascript
const minAmountOut = ethers.parseUnits((tokenAmount * 0.95).toString(), 18);
```

If price moves >5% during tx, it will revert.

### 2. **Transaction Deadlines**

All swaps have 20-minute deadlines:
```javascript
const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
```

Prevents old transactions from executing unexpectedly.

### 3. **Confirmation Waiting**

Never returns until transaction is confirmed on-chain:
```javascript
const receipt = await tx.wait(); // Blocks until confirmed
```

### 4. **Balance Validation**

Can check wallet balances before trading:
```javascript
const balances = await trader.checkBalances();
```

### 5. **Gas Estimation**

Real gas cost estimation:
```javascript
const gasCost = await trader.estimateGasCost();
```

---

## Configuration Checklist

Before running with real trades, ensure:

- [ ] `AUTO_EXECUTE_TRADES=true` in `.env`
- [ ] `SID_TOKEN_ADDRESS` is set correctly
- [ ] `USDC_TOKEN_ADDRESS` is set correctly
- [ ] `UNISWAP_ROUTER_ADDRESS` is set correctly
- [ ] `PAXEER_PRIVATE_KEY` is a real private key with balance
- [ ] Bot wallet has sufficient USDC to buy SID on AMM
- [ ] bot wallet has sufficient SID if needed
- [ ] `MAX_TRADE_SIZE_USD` is reasonable ($1000 default)
- [ ] `PROFIT_THRESHOLD_PERCENT` is set (1% recommended)

---

## Testing Recommendations

### 1. **Start on Testnet**
Change `PAXEER_RPC_URL` to a testnet RPC and get testnet tokens first.

### 2. **Use Small Amounts**
Set `MAX_TRADE_SIZE_USD=10` initially to test with small amounts.

### 3. **Monitor Logs**
Watch `logs/` folder for detailed transaction info:
```
✅ Buy on AMM confirmed in block 12345678
✅ Sell on Sidiora confirmed: order-id-xyz
💰 Trade successful! Net Profit: $12.50
```

### 4. **Check Database**
Query PostgreSQL `trades` table to verify records:
```sql
SELECT * FROM trades ORDER BY created_at DESC LIMIT 5;
```

---

## Troubleshooting

### "Missing token/router addresses in environment"

**Fix**: Add `SID_TOKEN_ADDRESS`, `USDC_TOKEN_ADDRESS`, and `UNISWAP_ROUTER_ADDRESS` to `.env`

### "Execution reverted: Insufficient balance"

**Fix**: Bot wallet doesn't have enough USDC. Top it up.

### "Execution reverted: ERC20: insufficient allowance"

**Fix**: Token approval failed. Check token address is correct.

### "Execution reverted for an unknown reason"

See Crypto Bridge Error Analysis thread for debugging.

### "Transaction reverted with slippage"

**Fix**: Market moved >5% during swap. Try again when spread is stable.

---

## Differences from Simulation

| Aspect | Simulated | Real |
|--------|-----------|------|
| TX Hash | Fake random | Real blockchain hash |
| Confirmation | Instant | ~1-30 seconds (network dependent) |
| Gas Cost | Not deducted | Actually paid in network fees |
| Token Approval | Not called | Required before swap |
| Balance Check | Not verified | Can query real balance |
| Error Handling | Limited | Comprehensive |
| Database | Records fake data | Records real trades |
| Profit | Not real | Actual profit/loss |

---

## Migration from Simulation

If you were testing with simulated trades:

1. **Update `.env`** with real token addresses
2. **Verify wallet balance** with `checkBalances()`
3. **Start with small `MAX_TRADE_SIZE_USD`** (e.g., $10)
4. **Set `AUTO_EXECUTE_TRADES=true`**
5. **Monitor first trade carefully** - logs will show every step

The bot will now execute actual profitable trades instead of simulating them!

---

## References

- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [Uniswap V2 Router Interface](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/Router02)
- [ERC20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)
