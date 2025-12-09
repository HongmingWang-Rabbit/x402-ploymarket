import { FastifyInstance } from 'fastify';
import { listMarketsHandler, getMarketHandler, createMarketHandler } from './handlers.js';

export async function marketRoutes(app: FastifyInstance) {
  // GET /api/markets - List all markets
  app.get('/', {
    schema: {
      description: 'List all prediction markets',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
          offset: { type: 'integer', default: 0, minimum: 0 },
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
                markets: { type: 'array' },
                total: { type: 'integer' },
                limit: { type: 'integer' },
                offset: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  }, listMarketsHandler);

  // GET /api/markets/:address - Get single market
  app.get('/:address', {
    schema: {
      description: 'Get a specific prediction market by address',
      params: {
        type: 'object',
        required: ['address'],
        properties: {
          address: { type: 'string' },
        },
      },
    },
  }, getMarketHandler);

  // POST /api/markets/create - Create market (with x402 payment)
  app.post('/create', {
    schema: {
      description: 'Create a new prediction market (requires x402 payment)',
      body: {
        type: 'object',
        required: ['name', 'metadataUri', 'bParameter'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          metadataUri: { type: 'string' },
          bParameter: { type: 'number', minimum: 1 },
          creatorAddress: { type: 'string' },
        },
      },
    },
  }, createMarketHandler);
}
