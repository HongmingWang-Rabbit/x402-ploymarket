import { FastifyRequest, FastifyReply } from 'fastify';
import { LiquidityService } from '../../services/liquidity.service.js';

const liquidityService = new LiquidityService();

interface AddLiquidityBody {
  marketAddress: string;
  amount: number;
  userAddress: string;
}

interface WithdrawLiquidityBody {
  marketAddress: string;
  lpAmount: number;
  userAddress: string;
}

export async function addLiquidityHandler(
  request: FastifyRequest<{ Body: AddLiquidityBody }>,
  reply: FastifyReply
) {
  const { marketAddress, amount, userAddress } = request.body;

  const result = await liquidityService.addLiquidity({
    marketAddress,
    amount,
    userAddress,
  });

  return reply.send({
    success: true,
    data: result,
  });
}

export async function withdrawLiquidityHandler(
  request: FastifyRequest<{ Body: WithdrawLiquidityBody }>,
  reply: FastifyReply
) {
  const { marketAddress, lpAmount, userAddress } = request.body;

  const result = await liquidityService.withdrawLiquidity({
    marketAddress,
    lpAmount,
    userAddress,
  });

  return reply.send({
    success: true,
    data: result,
  });
}
