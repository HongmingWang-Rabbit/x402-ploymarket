import { FastifyInstance } from 'fastify';
import { swapHandler, mintHandler, redeemHandler, quoteHandler, buyHandler, sellHandler } from './handlers.js';

export async function tradingRoutes(app: FastifyInstance) {
  // POST /api/trading/quote - Get price quote for a trade
  app.post('/quote', {
    schema: {
      description: 'Get a price quote for a trade without executing it',
      body: {
        type: 'object',
        required: ['marketAddress', 'tokenType', 'amount', 'direction'],
        properties: {
          marketAddress: { type: 'string' },
          tokenType: { type: 'string', enum: ['yes', 'no'] },
          amount: { type: 'number', minimum: 0 },
          direction: { type: 'string', enum: ['buy', 'sell'] },
        },
      },
    },
  }, quoteHandler);

  // POST /api/trading/buy - Buy tokens (shorthand for swap with direction=buy)
  app.post('/buy', {
    schema: {
      description: 'Buy YES or NO tokens in a prediction market',
      body: {
        type: 'object',
        required: ['marketAddress', 'tokenType', 'amount', 'userAddress'],
        properties: {
          marketAddress: { type: 'string' },
          tokenType: { type: 'string', enum: ['yes', 'no'] },
          amount: { type: 'number', minimum: 0 },
          slippage: { type: 'number', minimum: 0, maximum: 100, default: 5 },
          userAddress: { type: 'string' },
        },
      },
    },
  }, buyHandler);

  // POST /api/trading/sell - Sell tokens (shorthand for swap with direction=sell)
  app.post('/sell', {
    schema: {
      description: 'Sell YES or NO tokens in a prediction market',
      body: {
        type: 'object',
        required: ['marketAddress', 'tokenType', 'amount', 'userAddress'],
        properties: {
          marketAddress: { type: 'string' },
          tokenType: { type: 'string', enum: ['yes', 'no'] },
          amount: { type: 'number', minimum: 0 },
          slippage: { type: 'number', minimum: 0, maximum: 100, default: 5 },
          userAddress: { type: 'string' },
        },
      },
    },
  }, sellHandler);

  // POST /api/trading/swap - Execute swap (with x402 payment)
  app.post('/swap', {
    schema: {
      description: 'Swap tokens in a prediction market (requires x402 payment)',
      body: {
        type: 'object',
        required: ['marketAddress', 'direction', 'amount', 'userAddress'],
        properties: {
          marketAddress: { type: 'string' },
          direction: { type: 'string', enum: ['buy', 'sell'] },
          tokenType: { type: 'string', enum: ['yes', 'no'] },
          amount: { type: 'number', minimum: 0 },
          slippage: { type: 'number', minimum: 0, maximum: 100, default: 5 },
          userAddress: { type: 'string' },
        },
      },
    },
  }, swapHandler);

  // POST /api/trading/mint - Mint complete set
  app.post('/mint', {
    schema: {
      description: 'Mint a complete set of YES and NO tokens',
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
  }, mintHandler);

  // POST /api/trading/redeem - Redeem complete set
  app.post('/redeem', {
    schema: {
      description: 'Redeem a complete set of YES and NO tokens for USDC',
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
  }, redeemHandler);
}
