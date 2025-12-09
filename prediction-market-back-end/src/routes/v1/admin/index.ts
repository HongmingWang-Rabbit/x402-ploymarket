import { FastifyInstance } from 'fastify';
import { adminProposalRoutes } from './proposals.js';
import { adminDisputeRoutes } from './disputes.js';
import { adminIngestRoutes } from './ingest.js';
import { adminAiConfigRoutes } from './ai-config.js';
import { adminWorkerRoutes } from './workers.js';

export async function adminRoutes(app: FastifyInstance) {
  // Admin proposal review routes
  await app.register(adminProposalRoutes, { prefix: '/proposals' });

  // Admin dispute review routes
  await app.register(adminDisputeRoutes, { prefix: '/disputes' });

  // Manual news ingest
  await app.register(adminIngestRoutes, { prefix: '/ingest' });

  // AI configuration management
  await app.register(adminAiConfigRoutes, { prefix: '/ai-config' });

  // Worker monitoring and management
  await app.register(adminWorkerRoutes, { prefix: '/workers' });
}
