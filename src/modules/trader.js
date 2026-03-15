const { ethers } = require('ethers');
const axios = require('axios');
const logger = require('../logger');
const config = require('../config');
const database = require('./database');
const Decimal = require('decimal.js');

// ERC20 ABI for token interactions
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function balanceOf(address account) public view returns (uint256)',
  'function transfer(address to, uint256 amount) public returns (bool)',
];

// Uniswap V2 Router ABI
const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) public returns (uint[] memory amounts)',
  'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) public returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) public view returns (uint[] memory amounts)',
  'function getAmountsIn(uint amountOut, address[] calldata path) public view returns (uint[] memory amounts)',
];

class Trader {
  constructor() {
    // Initialize Paxeer Network provider and signer
    this.provider = new ethers.JsonRpcProvider(config.paxeer.rpcUrl);
    this.signer = new ethers.Wallet(config.paxeer.privateKey, this.provider);
    this.tradeHistory = [];

    // Load token and router addresses from environment
    this.sidTokenAddress = process.env.SID_TOKEN_ADDRESS;
    this.usdcTokenAddress = process.env.USDC_TOKEN_ADDRESS;
    this.routerAddress = process.env.SIDIORA_ROUTER_ADDRESS;

    // Validate addresses
    if (!this.sidTokenAddress || !this.usdcTokenAddress || !this.routerAddress) {
      logger.warn('⚠️  Missing token/router addresses in environment. Trade execution may fail.');
      logger.warn(`SID: ${this.sidTokenAddress}, USDC: ${this.usdcTokenAddress}, Router: ${this.routerAddress}`);
    }
  }

  async executeTrade(opportunity, profitability) {
    try {
      logger.info(`🚀 Executing real trade: ${opportunity.type}`);
      
      if (!config.trading.autoExecuteTrades) {
        logger.info('Auto-trading disabled, trade not executed');
        return {
          success: false,
          reason: 'Auto-trading disabled',
        };
      }

      // Validate required addresses
      if (!this.sidTokenAddress || !this.usdcTokenAddress || !this.routerAddress) {
        throw new Error('Missing token/router addresses. Set SID_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS, SIDIORA_ROUTER_ADDRESS in .env');
      }

      let buyTxHash;
      let sellTxHash;

      try {
        // Execute buy transaction (on the cheaper venue)
        if (opportunity.buyVenue === 'AMM/DEX') {
          buyTxHash = await this.executeBuyOnAMM(
            profitability.quantity,
            opportunity.buyPrice
          );
        } else if (opportunity.buyVenue === 'Sidiora Exchange') {
          buyTxHash = await this.executeBuyOnSidiora(
            profitability.quantity,
            opportunity.buyPrice
          );
        }

        logger.info(`✅ Buy executed: ${buyTxHash}`);

        // Execute sell transaction (on the expensive venue)
        if (opportunity.sellVenue === 'Sidiora Exchange') {
          sellTxHash = await this.executeSellOnSidiora(
            profitability.quantity,
            opportunity.sellPrice
          );
        } else if (opportunity.sellVenue === 'AMM/DEX') {
          sellTxHash = await this.executeSellOnAMM(
            profitability.quantity,
            opportunity.sellPrice
          );
        }

        logger.info(`✅ Sell executed: ${sellTxHash}`);

        // Record trade in database
        database.recordTrade({
          tradingPair: config.trading.tradingPair,
          buyVenue: opportunity.buyVenue,
          sellVenue: opportunity.sellVenue,
          buyPrice: opportunity.buyPrice,
          sellPrice: opportunity.sellPrice,
          quantity: profitability.quantity,
          buyAmountUsd: profitability.buyAmount,
          sellAmountUsd: profitability.sellAmount,
          grossProfitUsd: profitability.grossProfit,
          feesUsd: profitability.fees,
          netProfitUsd: profitability.netProfit,
          profitPercent: profitability.profitPercent,
          status: 'completed',
          buyTxHash,
          sellTxHash,
        });

        logger.info(`💰 Trade successful! Net Profit: $${profitability.netProfit.toFixed(2)}`);

        return {
          success: true,
          buyVenue: opportunity.buyVenue,
          sellVenue: opportunity.sellVenue,
          quantity: profitability.quantity,
          buyPrice: opportunity.buyPrice,
          sellPrice: opportunity.sellPrice,
          buyAmount: profitability.buyAmount,
          sellAmount: profitability.sellAmount,
          grossProfit: profitability.grossProfit,
          fees: profitability.fees,
          netProfit: profitability.netProfit,
          profitPercent: profitability.profitPercent,
          buyTxHash,
          sellTxHash,
          timestamp: Date.now(),
        };
      } catch (executeError) {
        throw executeError;
      }
    } catch (error) {
      logger.error(`❌ Trade execution failed: ${error.message}`);
      
      // Record failed trade attempt
      database.recordTrade({
        tradingPair: config.trading.tradingPair,
        buyVenue: opportunity.buyVenue,
        sellVenue: opportunity.sellVenue,
        buyPrice: opportunity.buyPrice,
        sellPrice: opportunity.sellPrice,
        quantity: profitability.quantity,
        status: 'failed',
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
        reason: 'Execution failed',
      };
    }
  }

  async executeBuyOnAMM(tokenAmount, maxPrice) {
    try {
      logger.info(`💸 Buying ${tokenAmount} SID on AMM at max $${maxPrice}`);

      // Initialize router contract
      const router = new ethers.Contract(this.routerAddress, ROUTER_ABI, this.signer);
      
      // Get amount of USDC needed (amountIn)
      const path = [this.usdcTokenAddress, this.sidTokenAddress];
      const amounts = await router.getAmountsIn(
        ethers.parseUnits(tokenAmount.toString(), 18),
        path
      );
      
      const amountInMax = amounts[0];
      logger.debug(`AMM: Need ${ethers.formatUnits(amountInMax, 6)} USDC to get ${tokenAmount} SID`);

      // Approve USDC token spend if needed
      await this.approveToken(
        this.usdcTokenAddress,
        this.routerAddress,
        amountInMax
      );

      // Execute swap
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minute deadline
      const minAmountOut = ethers.parseUnits((tokenAmount * 0.95).toString(), 18); // 5% slippage

      logger.info(`Swapping with deadline: ${deadline}, min output: ${ethers.formatUnits(minAmountOut, 18)} SID`);

      const tx = await router.swapExactTokensForTokens(
        amountInMax,
        minAmountOut,
        path,
        this.signer.address,
        deadline
      );

      logger.info(`📤 Swap transaction submitted: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      logger.info(`✅ Buy on AMM confirmed in block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error) {
      logger.error(`❌ Failed to buy on AMM: ${error.message}`);
      throw new Error(`AMM buy failed: ${error.message}`);
    }
  }

  async executeSellOnAMM(tokenAmount, minPrice) {
    try {
      logger.info(`📊 Selling ${tokenAmount} SID on AMM at min $${minPrice}`);

      // Initialize router contract
      const router = new ethers.Contract(this.routerAddress, ROUTER_ABI, this.signer);

      // Approve SID token spend
      await this.approveToken(
        this.sidTokenAddress,
        this.routerAddress,
        ethers.parseUnits(tokenAmount.toString(), 18)
      );

      // Execute swap
      const path = [this.sidTokenAddress, this.usdcTokenAddress];
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minute deadline
      const minAmountOut = ethers.parseUnits((minPrice * tokenAmount * 0.95).toString(), 6); // 5% slippage

      logger.info(`Swapping ${tokenAmount} SID for min ${ethers.formatUnits(minAmountOut, 6)} USDC`);

      const tx = await router.swapExactTokensForTokens(
        ethers.parseUnits(tokenAmount.toString(), 18),
        minAmountOut,
        path,
        this.signer.address,
        deadline
      );

      logger.info(`📤 Swap transaction submitted: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      logger.info(`✅ Sell on AMM confirmed in block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error) {
      logger.error(`❌ Failed to sell on AMM: ${error.message}`);
      throw new Error(`AMM sell failed: ${error.message}`);
    }
  }

  async executeBuyOnSidiora(tokenAmount, maxPrice) {
    try {
      logger.info(`💳 Placing buy order on Sidiora: ${tokenAmount} SID @ $${maxPrice}`);

      const response = await axios.post(
        `${config.sidiora.apiUrl}/v1/orders`,
        {
          pair: config.trading.tradingPair,
          side: 'buy',
          amount: tokenAmount,
          price: maxPrice,
          type: 'limit',
        },
        {
          headers: {
            'X-API-Key': config.sidiora.apiKey,
            'X-API-Secret': config.sidiora.apiSecret,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      if (!response.data.orderId && !response.data.txHash) {
        throw new Error(`Invalid Sidiora response: ${JSON.stringify(response.data)}`);
      }

      logger.info(`✅ Sidiora buy order placed: ${response.data.orderId}`);
      return response.data.txHash || response.data.orderId;
    } catch (error) {
      logger.error(`❌ Failed to buy on Sidiora: ${error.message}`);
      throw new Error(`Sidiora buy failed: ${error.message}`);
    }
  }

  async executeSellOnSidiora(tokenAmount, minPrice) {
    try {
      logger.info(`📋 Placing sell order on Sidiora: ${tokenAmount} SID @ $${minPrice}`);

      const response = await axios.post(
        `${config.sidiora.apiUrl}/v1/orders`,
        {
          pair: config.trading.tradingPair,
          side: 'sell',
          amount: tokenAmount,
          price: minPrice,
          type: 'limit',
        },
        {
          headers: {
            'X-API-Key': config.sidiora.apiKey,
            'X-API-Secret': config.sidiora.apiSecret,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      if (!response.data.orderId && !response.data.txHash) {
        throw new Error(`Invalid Sidiora response: ${JSON.stringify(response.data)}`);
      }

      logger.info(`✅ Sidiora sell order placed: ${response.data.orderId}`);
      return response.data.txHash || response.data.orderId;
    } catch (error) {
      logger.error(`❌ Failed to sell on Sidiora: ${error.message}`);
      throw new Error(`Sidiora sell failed: ${error.message}`);
    }
  }

  async approveToken(tokenAddress, spenderAddress, amount) {
    try {
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);

      // Check current allowance
      const currentAllowance = await token.allowance(this.signer.address, spenderAddress);

      if (currentAllowance >= amount) {
        logger.debug(`✅ Token already approved (allowance: ${ethers.formatUnits(currentAllowance, 6)})`);
        return;
      }

      logger.debug(`Approving token: ${tokenAddress} for ${spenderAddress}`);

      // Approve with unlimited allowance for efficiency
      const approvalAmount = ethers.parseUnits('999999999', 18);
      const tx = await token.approve(spenderAddress, approvalAmount);

      logger.debug(`📤 Approval transaction submitted: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      logger.debug(`✅ Approval confirmed in block ${receipt.blockNumber}`);
    } catch (error) {
      logger.error(`❌ Token approval failed: ${error.message}`);
      throw new Error(`Approval failed: ${error.message}`);
    }
  }

  async getBalance(token) {
    try {
      const tokenContract = new ethers.Contract(token, ERC20_ABI, this.provider);
      const balance = await tokenContract.balanceOf(this.signer.address);
      const decimals = token === this.sidTokenAddress ? 18 : 6;

      const balanceFormatted = ethers.formatUnits(balance, decimals);
      logger.debug(`Balance of ${token}: ${balanceFormatted}`);

      return {
        raw: balance.toString(),
        formatted: parseFloat(balanceFormatted),
      };
    } catch (error) {
      logger.error(`Failed to get balance for ${token}: ${error.message}`);
      return {
        raw: '0',
        formatted: 0,
      };
    }
  }

  async checkBalances() {
    try {
      const sidBalance = await this.getBalance(this.sidTokenAddress);
      const usdcBalance = await this.getBalance(this.usdcTokenAddress);

      logger.info(`💰 Wallet Balances: SID=${sidBalance.formatted}, USDC=${usdcBalance.formatted}`);

      return {
        sid: sidBalance.formatted,
        usdc: usdcBalance.formatted,
      };
    } catch (error) {
      logger.error(`Failed to check balances: ${error.message}`);
      return null;
    }
  }

  async estimateGasCost() {
    try {
      const gasPrice = await this.provider.getGasPrice();
      const gasEstimate = new Decimal(250000); // Typical swap gas for DEX
      const gasCostWei = gasEstimate.times(gasPrice.toString());
      
      // Convert from Wei to ETH (or native gas token)
      const gasCostToken = gasCostWei.dividedBy(new Decimal(10).pow(18));
      const gasCostUsd = gasCostToken.times(new Decimal(100)); // Assuming token price is ~$100

      logger.info(`⛽ Estimated gas cost: ${gasCostUsd.toFixed(2)} USD (${gasPrice.toString()} wei/gas)`);

      return gasCostUsd.toNumber();
    } catch (error) {
      logger.warn(`Could not estimate gas: ${error.message}`);
      return 0.005; // Default conservative estimate (in USD)
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = Trader;
