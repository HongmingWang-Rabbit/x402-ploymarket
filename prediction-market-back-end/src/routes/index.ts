import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';
import { marketRoutes } from './markets/index.js';
import { tradingRoutes } from './trading/index.js';
import { liquidityRoutes } from './liquidity/index.js';
import { metadataRoutes } from './metadata/index.js';
import { configRoutes } from './config/index.js';
import { v1Routes } from './v1/index.js';

export async function registerRoutes(app: FastifyInstance) {
  // Health check
  await app.register(healthRoutes);

  // API routes (existing)
  await app.register(configRoutes, { prefix: '/api/config' });
  await app.register(marketRoutes, { prefix: '/api/markets' });
  await app.register(tradingRoutes, { prefix: '/api/trading' });
  await app.register(liquidityRoutes, { prefix: '/api/liquidity' });
  await app.register(metadataRoutes, { prefix: '/api/metadata' });

  // API v1 routes (new AI features)
  await app.register(v1Routes, { prefix: '/api/v1' });
}
