import { FastifyRequest, FastifyReply } from 'fastify';
import { metadataService } from '../../services/metadata.service.js';

interface CreateMetadataBody {
  chainId?: string;
  name: string;
  symbol: string;
  description?: string;
  category?: string;
  resolutionSource?: string;
}

interface GetMetadataParams {
  id: string;
}

interface GetMetadataByMarketParams {
  address: string;
}

interface LinkMetadataBody {
  marketAddress: string;
}

export async function createMetadataHandler(
  request: FastifyRequest<{ Body: CreateMetadataBody }>,
  reply: FastifyReply
) {
  const { chainId, name, symbol, description, category, resolutionSource } = request.body;

  const metadata = await metadataService.create({
    chainId,
    name,
    symbol,
    description,
    category,
    resolutionSource,
  });

  // Return the metadata with the full URL that can be used as yes_uri
  const baseUrl = `${request.protocol}://${request.hostname}`;
  const metadataUrl = `${baseUrl}/api/metadata/${metadata.id}`;

  return reply.status(201).send({
    success: true,
    data: {
      id: metadata.id,
      url: metadataUrl,
    },
  });
}

export async function getMetadataHandler(
  request: FastifyRequest<{ Params: GetMetadataParams }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  const metadata = await metadataService.getById(id);

  // Return as market metadata JSON format
  // Use 'question' field name for frontend compatibility
  return reply.send({
    question: metadata.name, // Frontend expects 'question'
    name: metadata.name, // Keep 'name' for backwards compatibility
    symbol: metadata.symbol,
    description: metadata.description || '',
    category: metadata.category || '',
    resolutionSource: metadata.resolutionSource || '',
    createdAt: metadata.createdAt.toISOString(),
  });
}

export async function getMetadataByMarketHandler(
  request: FastifyRequest<{ Params: GetMetadataByMarketParams }>,
  reply: FastifyReply
) {
  const { address } = request.params;

  const metadata = await metadataService.getByMarketAddress(address);

  if (!metadata) {
    return reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Metadata not found for this market' },
    });
  }

  // Return wrapped format for API client consistency
  return reply.send({
    success: true,
    data: {
      question: metadata.name,
      name: metadata.name,
      symbol: metadata.symbol,
      description: metadata.description || '',
      category: metadata.category || '',
      resolutionSource: metadata.resolutionSource || '',
      createdAt: metadata.createdAt.toISOString(),
    },
  });
}

export async function linkMetadataHandler(
  request: FastifyRequest<{ Params: GetMetadataParams; Body: LinkMetadataBody }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const { marketAddress } = request.body;

  const metadata = await metadataService.linkToMarket(id, marketAddress);

  return reply.send({
    success: true,
    data: {
      id: metadata.id,
      marketAddress: metadata.marketAddress,
    },
  });
}
