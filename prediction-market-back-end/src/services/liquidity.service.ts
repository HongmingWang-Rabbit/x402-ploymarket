import { getSolanaClient } from '../blockchain/solana/client.js';
import type { AddLiquidityParams, WithdrawLiquidityParams } from '../blockchain/types.js';
import { logger } from '../utils/logger.js';

export class LiquidityService {
  private get solanaClient() {
    return getSolanaClient();
  }

  async addLiquidity(params: AddLiquidityParams) {
    logger.info({ params }, 'Adding liquidity');

    const result = await this.solanaClient.addLiquidity({
      marketAddress: params.marketAddress,
      amount: params.amount,
      userAddress: params.userAddress,
    });

    return result;
  }

  async withdrawLiquidity(params: WithdrawLiquidityParams) {
    logger.info({ params }, 'Withdrawing liquidity');

    const result = await this.solanaClient.withdrawLiquidity({
      marketAddress: params.marketAddress,
      lpAmount: params.lpAmount,
      userAddress: params.userAddress,
    });

    return result;
  }
}
