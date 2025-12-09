import { FastifyRequest, FastifyReply } from 'fastify';
import { TradingService } from '../../services/trading.service.js';
import { solanaConfig } from '../../blockchain/solana/config.js';

const tradingService = new TradingService();
const { DEFAULT_SLIPPAGE_PERCENT } = solanaConfig.trading;

interface QuoteBody {
  marketAddress: string;
  tokenType: 'yes' | 'no';
  amount: number;
  direction: 'buy' | 'sell';
}

interface SwapBody {
  marketAddress: string;
  direction: 'buy' | 'sell';
  tokenType: 'yes' | 'no';
  amount: number;
  slippage?: number;
  userAddress: string;
}

interface BuySellBody {
  marketAddress: string;
  tokenType: 'yes' | 'no';
  amount: number;
  slippage?: number;
  userAddress: string;
}

interface MintRedeemBody {
  marketAddress: string;
  amount: number;
  userAddress: string;
}

export async function swapHandler(
  request: FastifyRequest<{ Body: SwapBody }>,
  reply: FastifyReply
) {
  const { marketAddress, direction, tokenType, amount, slippage = DEFAULT_SLIPPAGE_PERCENT, userAddress } = request.body;

  const result = await tradingService.swap({
    marketAddress,
    direction,
    tokenType,
    amount,
    slippage,
    userAddress,
  });

  return reply.send({
    success: true,
    data: result,
  });
}

export async function mintHandler(
  request: FastifyRequest<{ Body: MintRedeemBody }>,
  reply: FastifyReply
) {
  const { marketAddress, amount, userAddress } = request.body;

  const result = await tradingService.mintCompleteSet({
    marketAddress,
    amount,
    userAddress,
  });

  return reply.send({
    success: true,
    data: result,
  });
}

export async function redeemHandler(
  request: FastifyRequest<{ Body: MintRedeemBody }>,
  reply: FastifyReply
) {
  const { marketAddress, amount, userAddress } = request.body;

  const result = await tradingService.redeemCompleteSet({
    marketAddress,
    amount,
    userAddress,
  });

  return reply.send({
    success: true,
    data: result,
  });
}

export async function quoteHandler(
  request: FastifyRequest<{ Body: QuoteBody }>,
  reply: FastifyReply
) {
  const { marketAddress, tokenType, amount, direction } = request.body;

  const result = await tradingService.getQuote({
    marketAddress,
    tokenType,
    amount,
    direction,
  });

  return reply.send({
    success: true,
    data: result,
  });
}

export async function buyHandler(
  request: FastifyRequest<{ Body: BuySellBody }>,
  reply: FastifyReply
) {
  const { marketAddress, tokenType, amount, slippage = DEFAULT_SLIPPAGE_PERCENT, userAddress } = request.body;

  const result = await tradingService.buy({
    marketAddress,
    tokenType,
    amount,
    slippage,
    userAddress,
  });

  return reply.send({
    success: true,
    data: result,
  });
}

export async function sellHandler(
  request: FastifyRequest<{ Body: BuySellBody }>,
  reply: FastifyReply
) {
  const { marketAddress, tokenType, amount, slippage = DEFAULT_SLIPPAGE_PERCENT, userAddress } = request.body;

  const result = await tradingService.sell({
    marketAddress,
    tokenType,
    amount,
    slippage,
    userAddress,
  });

  return reply.send({
    success: true,
    data: result,
  });
}
