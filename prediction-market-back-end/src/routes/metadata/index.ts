import { FastifyInstance } from 'fastify';
import { createMetadataHandler, getMetadataHandler, getMetadataByMarketHandler, linkMetadataHandler } from './handlers.js';

export async function metadataRoutes(app: FastifyInstance) {
  // POST /api/metadata - Create metadata and get URL
  app.post('/', {
    schema: {
      description: 'Store market metadata and get a URL for contract',
      body: {
        type: 'object',
        required: ['name', 'symbol'],
        properties: {
          chainId: { type: 'string', maxLength: 50, description: 'Chain identifier (e.g., solana-devnet, ethereum-mainnet)' },
          name: { type: 'string', minLength: 1, maxLength: 200 },
          symbol: { type: 'string', minLength: 1, maxLength: 20 },
          description: { type: 'string', maxLength: 2000 },
          category: { type: 'string', maxLength: 50 },
          resolutionSource: { type: 'string', maxLength: 500 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                url: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, createMetadataHandler);

  // GET /api/metadata/market/:address - Get metadata by market address
  app.get('/market/:address', {
    schema: {
      description: 'Get market metadata by on-chain market address',
      params: {
        type: 'object',
        required: ['address'],
        properties: {
          address: { type: 'string', minLength: 32, maxLength: 64 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                name: { type: 'string' },
                symbol: { type: 'string' },
                description: { type: 'string' },
                category: { type: 'string' },
                resolutionSource: { type: 'string' },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, getMetadataByMarketHandler);

  // GET /api/metadata/:id - Get metadata JSON
  app.get('/:id', {
    schema: {
      description: 'Get market metadata by ID (used as token metadata URI)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            name: { type: 'string' },
            symbol: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            resolutionSource: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
  }, getMetadataHandler);

  // PATCH /api/metadata/:id/link - Link metadata to market address
  app.patch('/:id/link', {
    schema: {
      description: 'Link metadata to an on-chain market address (call after market creation)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['marketAddress'],
        properties: {
          marketAddress: { type: 'string', minLength: 32, maxLength: 64 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                marketAddress: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, linkMetadataHandler);
}
