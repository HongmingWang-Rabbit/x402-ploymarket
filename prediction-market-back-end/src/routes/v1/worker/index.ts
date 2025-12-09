/**
 * Worker API Routes
 *
 * Internal endpoints for worker processes to report results
 * These require worker JWT authentication
 */

import { FastifyInstance } from 'fastify';
import { workerAuthRoutes } from './auth.js';
import { workerDraftsRoutes } from './drafts.js';
import { workerValidationsRoutes } from './validations.js';
import { workerMarketsRoutes } from './markets.js';
import { workerResolutionsRoutes } from './resolutions.js';
import { workerDisputesRoutes } from './disputes.js';

export async function workerRoutes(app: FastifyInstance) {
  // Worker authentication
  await app.register(workerAuthRoutes, { prefix: '/auth' });

  // Worker reporting endpoints
  await app.register(workerDraftsRoutes, { prefix: '/drafts' });
  await app.register(workerValidationsRoutes, { prefix: '/validations' });
  await app.register(workerMarketsRoutes, { prefix: '/markets' });
  await app.register(workerResolutionsRoutes, { prefix: '/resolutions' });
  await app.register(workerDisputesRoutes, { prefix: '/disputes' });
}
