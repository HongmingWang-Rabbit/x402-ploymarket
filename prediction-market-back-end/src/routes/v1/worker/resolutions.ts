/**
 * Worker Resolutions Routes
 *
 * Endpoint for Resolver worker to report market resolution results
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../../db/index.js';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger.js';
import { workerAuthMiddleware } from './auth.js';

const resolutionSchema = z.object({
  market_id: z.string().uuid(),
  market_address: z.string().min(32).max(64),
  final_result: z.enum(['YES', 'NO']),
  resolution_source: z.string().url(),
  evidence_hash: z.string().length(64),
  evidence_raw: z.string().min(1),
  must_meet_all_results: z.record(z.string(), z.boolean()),
  must_not_count_results: z.record(z.string(), z.boolean()),
  tx_signature: z.string().min(64).max(128).optional(),
  llm_request_id: z.string().optional(),
});

export async function workerResolutionsRoutes(app: FastifyInstance) {
  // Apply worker auth middleware to all routes
  app.addHook('preHandler', workerAuthMiddleware);

  /**
   * POST /api/v1/worker/resolutions
   * Report a market resolution result
   */
  app.post(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers['x-request-id'] as string) || randomUUID();
      const worker = (request as any).worker;

      try {
        // Validate request
        const parseResult = resolutionSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'invalid_request',
              message: parseResult.error.issues[0].message,
            },
          });
        }

        const {
          market_id,
          market_address,
          final_result,
          resolution_source,
          evidence_hash,
          evidence_raw,
          must_meet_all_results,
          must_not_count_results,
          tx_signature,
          llm_request_id,
        } = parseResult.data;

        const sql = getDb();

        // Verify market exists and is in correct status
        const [market] = await sql`
          SELECT id, status, market_address FROM ai_markets WHERE id = ${market_id}
        `;

        if (!market) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'not_found',
              message: 'Market not found',
            },
          });
        }

        if (market.market_address !== market_address) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'address_mismatch',
              message: 'Market address does not match',
            },
          });
        }

        if (!['active', 'resolving'].includes(market.status)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'invalid_status',
              message: `Market is in ${market.status} status, expected active or resolving`,
            },
          });
        }

        // Calculate dispute window end (24 hours from now)
        const disputeWindowEnds = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Create resolution record
        const resolutionId = randomUUID();
        await sql`
          INSERT INTO resolutions (
            id,
            market_id,
            market_address,
            final_result,
            resolution_source,
            evidence_hash,
            evidence_raw,
            must_meet_all_results,
            must_not_count_results,
            status,
            resolved_by,
            tx_signature,
            dispute_window_ends
          ) VALUES (
            ${resolutionId},
            ${market_id},
            ${market_address},
            ${final_result},
            ${resolution_source},
            ${evidence_hash},
            ${evidence_raw},
            ${JSON.stringify(must_meet_all_results)},
            ${JSON.stringify(must_not_count_results)},
            'resolved',
            ${`worker:${worker.worker_type}`},
            ${tx_signature || null},
            ${disputeWindowEnds}
          )
        `;

        // Update market status
        await sql`
          UPDATE ai_markets
          SET status = 'resolved', resolved_at = NOW()
          WHERE id = ${market_id}
        `;

        // Log audit entry
        await sql`
          INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, ai_version, llm_request_id)
          VALUES (
            'market_resolved',
            'resolution',
            ${resolutionId},
            ${`worker:${worker.worker_type}`},
            ${JSON.stringify({
              market_id,
              market_address,
              final_result,
              evidence_hash,
              dispute_window_ends: disputeWindowEnds.toISOString(),
            })},
            'resolver_v1',
            ${llm_request_id || null}
          )
        `;

        logger.info(
          {
            requestId,
            resolution_id: resolutionId,
            market_id,
            final_result,
            worker_type: worker.worker_type,
          },
          'Market resolution recorded'
        );

        return reply.status(201).send({
          success: true,
          data: {
            resolution_id: resolutionId,
            market_id,
            final_result,
            dispute_window_ends: disputeWindowEnds.toISOString(),
            status: 'resolved',
            message: 'Resolution recorded successfully. Dispute window open for 24 hours.',
          },
        });
      } catch (error) {
        logger.error({ error, requestId }, 'Failed to record resolution');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to record resolution',
          },
        });
      }
    }
  );
}
