import { FastifyInstance } from 'fastify';
import { addLiquidityHandler, withdrawLiquidityHandler } from './handlers.js';

export async function liquidityRoutes(app: FastifyInstance) {
  // POST /api/liquidity/add - Add liquidity to market
  app.post('/add', {
    schema: {
      description: 'Add liquidity to a prediction market',
      body: {
        type: 'object',
        required: ['marketAddress', 'amount', 'userAddress'],
        properties: {
          marketAddress: { type: 'string' },
          amount: { type: 'number', minimum: 0 },
          userAddress: { type: 'string' },
        },
      },
    },
  }, addLiquidityHandler);

  // POST /api/liquidity/withdraw - Withdraw liquidity from market
  app.post('/withdraw', {
    schema: {
      description: 'Withdraw liquidity from a prediction market',
      body: {
        type: 'object',
        required: ['marketAddress', 'lpAmount', 'userAddress'],
        properties: {
          marketAddress: { type: 'string' },
          lpAmount: { type: 'number', minimum: 0 },
          userAddress: { type: 'string' },
        },
      },
    },
  }, withdrawLiquidityHandler);

  // POST /api/liquidity/remove - Alias for /withdraw
  app.post('/remove', {
    schema: {
      description: 'Remove liquidity from a prediction market (alias for /withdraw)',
      body: {
        type: 'object',
        required: ['marketAddress', 'lpAmount', 'userAddress'],
        properties: {
          marketAddress: { type: 'string' },
          lpAmount: { type: 'number', minimum: 0 },
          userAddress: { type: 'string' },
        },
      },
    },
  }, withdrawLiquidityHandler);
}
