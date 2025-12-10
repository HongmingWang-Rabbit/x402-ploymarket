import { FastifyInstance } from 'fastify';
import { proposeRoutes } from './propose.js';
import { aiMarketsRoutes } from './ai-markets.js';
import { disputesRoutes } from './disputes.js';
import { adminRoutes } from './admin/index.js';
import { workerRoutes } from './worker/index.js';

export async function v1Routes(app: FastifyInstance) {
  // Public proposal routes
  await app.register(proposeRoutes, { prefix: '/propose' });

  // Also register as /proposals for GET endpoints
  await app.register(proposeRoutes, { prefix: '/proposals' });

  // AI markets routes
  await app.register(aiMarketsRoutes, { prefix: '/markets' });

  // Disputes routes
  await app.register(disputesRoutes, { prefix: '/disputes' });

  // Admin routes (protected by adminAuthMiddleware)
  await app.register(adminRoutes, { prefix: '/admin' });

  // Worker routes (internal, require worker JWT)
  await app.register(workerRoutes, { prefix: '/worker' });
}
