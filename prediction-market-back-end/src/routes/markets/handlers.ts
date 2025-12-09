import { FastifyRequest, FastifyReply } from 'fastify';
import { MarketService } from '../../services/market.service.js';

const marketService = new MarketService();

interface ListMarketsQuery {
  limit?: number;
  offset?: number;
}

interface GetMarketParams {
  address: string;
}

interface CreateMarketBody {
  name: string;
  metadataUri: string;
  bParameter: number;
  creatorAddress?: string;
}

export async function listMarketsHandler(
  request: FastifyRequest<{ Querystring: ListMarketsQuery }>,
  reply: FastifyReply
) {
  const { limit = 10, offset = 0 } = request.query;

  const result = await marketService.listMarkets(limit, offset);

  return reply.send({
    success: true,
    data: result,
  });
}

export async function getMarketHandler(
  request: FastifyRequest<{ Params: GetMarketParams }>,
  reply: FastifyReply
) {
  const { address } = request.params;

  const market = await marketService.getMarket(address);

  return reply.send({
    success: true,
    data: market,
  });
}

export async function createMarketHandler(
  request: FastifyRequest<{ Body: CreateMarketBody }>,
  reply: FastifyReply
) {
  const { name, metadataUri, bParameter, creatorAddress } = request.body;

  // x402 payment validation will be handled by middleware
  const result = await marketService.createMarket({
    name,
    metadataUri,
    bParameter,
    creatorAddress,
  });

  return reply.send({
    success: true,
    data: result,
  });
}
