import { FastifyInstance } from 'fastify';
import { MARKET_CATEGORIES } from '../../config/categories.js';
import { getEnabledChains, getContractByChainId, type ChainContract } from '../../config/contracts.js';

export async function configRoutes(app: FastifyInstance) {
  // GET /api/config - Get app configuration (categories, etc.)
  app.get('/', {
    schema: {
      description: 'Get application configuration including market categories',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                categories: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      label: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        categories: MARKET_CATEGORIES,
      },
    });
  });

  // GET /api/config/contracts - Get all enabled chain contracts
  app.get('/contracts', {
    schema: {
      description: 'Get contract addresses for all enabled chains',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                contracts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      chainId: { type: 'string' },
                      chainName: { type: 'string' },
                      network: { type: 'string' },
                      programId: { type: 'string' },
                      rpcUrl: { type: 'string' },
                      explorerUrl: { type: 'string' },
                      usdcMint: { type: 'string' },
                      enabled: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        contracts: getEnabledChains(),
      },
    });
  });

  // GET /api/config/contracts/:chainId - Get contract for specific chain
  app.get<{ Params: { chainId: string } }>('/contracts/:chainId', {
    schema: {
      description: 'Get contract address for a specific chain',
      params: {
        type: 'object',
        required: ['chainId'],
        properties: {
          chainId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { chainId } = request.params;
    const contract = getContractByChainId(chainId);

    if (!contract) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Contract not found for chain: ${chainId}`,
        },
      });
    }

    return reply.send({
      success: true,
      data: contract,
    });
  });
}
