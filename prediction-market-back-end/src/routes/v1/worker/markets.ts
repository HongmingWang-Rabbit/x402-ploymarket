/**
 * Worker Markets Routes
 *
 * Endpoint for Publisher worker to report successful on-chain market creation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../../db/index.js';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger.js';
import { workerAuthMiddleware } from './auth.js';

const publishedSchema = z.object({
  market_address: z.string().min(32).max(64),
  tx_signature: z.string().min(64).max(128),
  initial_liquidity_usdc: z.number().min(0).optional(),
});

export async function workerMarketsRoutes(app: FastifyInstance) {
  // Apply worker auth middleware to all routes
  app.addHook('preHandler', workerAuthMiddleware);

  /**
   * POST /api/v1/worker/markets/:draft_market_id/published
   * Report successful on-chain market creation
   */
  app.post<{ Params: { draft_market_id: string } }>(
    '/:draft_market_id/published',
    async (request: FastifyRequest<{ Params: { draft_market_id: string } }>, reply: FastifyReply) => {
      const requestId = (request.headers['x-request-id'] as string) || randomUUID();
      const worker = (request as any).worker;
      const { draft_market_id } = request.params;

      try {
        // Validate request
        const parseResult = publishedSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'invalid_request',
              message: parseResult.error.issues[0].message,
            },
          });
        }

        const { market_address, tx_signature, initial_liquidity_usdc } = parseResult.data;
        const sql = getDb();

        // Verify draft market exists and is in correct status
        const [market] = await sql`
          SELECT id, status, source_proposal_id FROM ai_markets WHERE id = ${draft_market_id}
        `;

        if (!market) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'not_found',
              message: 'Draft market not found',
            },
          });
        }

        if (!['draft', 'pending_review'].includes(market.status)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'invalid_status',
              message: `Market is in ${market.status} status, expected draft or pending_review`,
            },
          });
        }

        // Update market with on-chain info
        await sql`
          UPDATE ai_markets
          SET
            market_address = ${market_address},
            status = 'active',
            published_at = NOW()
          WHERE id = ${draft_market_id}
        `;

        // Update related proposal if exists
        if (market.source_proposal_id) {
          await sql`
            UPDATE proposals
            SET status = 'published'
            WHERE id = ${market.source_proposal_id}
          `;
        }

        // Log audit entry
        await sql`
          INSERT INTO audit_logs (action, entity_type, entity_id, actor, details)
          VALUES (
            'market_published',
            'ai_market',
            ${draft_market_id},
            ${`worker:${worker.worker_type}`},
            ${JSON.stringify({
              market_address,
              tx_signature,
              initial_liquidity_usdc: initial_liquidity_usdc || 0,
            })}
          )
        `;

        logger.info(
          { requestId, draft_market_id, market_address, tx_signature, worker_type: worker.worker_type },
          'Market published on-chain'
        );

        return reply.send({
          success: true,
          data: {
            draft_market_id,
            market_address,
            tx_signature,
            status: 'active',
            message: 'Market published successfully',
          },
        });
      } catch (error) {
        logger.error({ error, requestId, draft_market_id }, 'Failed to record market publication');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to record market publication',
          },
        });
      }
    }
  );
}
