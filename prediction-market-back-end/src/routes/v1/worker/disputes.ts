/**
 * Worker Disputes Routes
 *
 * Endpoint for Dispute Agent worker to report AI dispute review results
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../../db/index.js';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger.js';
import { workerAuthMiddleware } from './auth.js';

const disputeReviewSchema = z.object({
  decision: z.enum(['upheld', 'overturned', 'escalate']),
  new_result: z.enum(['YES', 'NO']).optional(),
  reasoning: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  llm_request_id: z.string().optional(),
});

export async function workerDisputesRoutes(app: FastifyInstance) {
  // Apply worker auth middleware to all routes
  app.addHook('preHandler', workerAuthMiddleware);

  /**
   * POST /api/v1/worker/disputes/:dispute_id/review
   * Report AI dispute review result
   */
  app.post<{ Params: { dispute_id: string } }>(
    '/:dispute_id/review',
    async (request: FastifyRequest<{ Params: { dispute_id: string } }>, reply: FastifyReply) => {
      const requestId = (request.headers['x-request-id'] as string) || randomUUID();
      const worker = (request as any).worker;
      const { dispute_id } = request.params;

      try {
        // Validate request
        const parseResult = disputeReviewSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'invalid_request',
              message: parseResult.error.issues[0].message,
            },
          });
        }

        const { decision, new_result, reasoning, confidence, llm_request_id } = parseResult.data;

        // Validate new_result is provided if overturned
        if (decision === 'overturned' && !new_result) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'invalid_request',
              message: 'new_result is required when overturning a dispute',
            },
          });
        }

        const sql = getDb();

        // Verify dispute exists and is in correct status
        const [dispute] = await sql`
          SELECT d.*, r.id as resolution_id, r.market_id, r.final_result as original_result, m.market_address
          FROM disputes d
          JOIN resolutions r ON r.id = d.resolution_id
          JOIN ai_markets m ON m.id = r.market_id
          WHERE d.id = ${dispute_id}
        `;

        if (!dispute) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'not_found',
              message: 'Dispute not found',
            },
          });
        }

        if (!['pending', 'reviewing'].includes(dispute.status)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'invalid_status',
              message: `Dispute is in ${dispute.status} status, expected pending or reviewing`,
            },
          });
        }

        // Prepare AI review object
        const aiReview = {
          decision,
          reasoning,
          confidence: confidence || 0.5,
          reviewed_at: new Date().toISOString(),
          reviewed_by: `worker:${worker.worker_type}`,
        };

        let newStatus: string;
        let updatedResult: string | null = null;

        switch (decision) {
          case 'upheld':
            newStatus = 'upheld';

            // Update resolution to finalized
            await sql`
              UPDATE resolutions
              SET status = 'finalized', finalized_at = NOW()
              WHERE id = ${dispute.resolution_id}
            `;

            // Update market status
            await sql`
              UPDATE ai_markets
              SET status = 'finalized', finalized_at = NOW()
              WHERE id = ${dispute.market_id}
            `;
            break;

          case 'overturned':
            newStatus = 'overturned';
            updatedResult = new_result!;

            // Update dispute with new result
            await sql`
              UPDATE disputes
              SET new_result = ${updatedResult}
              WHERE id = ${dispute_id}
            `;

            // Update resolution with new result
            await sql`
              UPDATE resolutions
              SET
                final_result = ${updatedResult},
                status = 'finalized',
                finalized_at = NOW()
              WHERE id = ${dispute.resolution_id}
            `;

            // Update market status
            await sql`
              UPDATE ai_markets
              SET status = 'finalized', finalized_at = NOW()
              WHERE id = ${dispute.market_id}
            `;

            // TODO: Trigger on-chain resolution update
            break;

          case 'escalate':
            newStatus = 'escalated';
            // Leave for admin review - don't update resolution or market
            break;

          default:
            newStatus = 'escalated';
        }

        // Update dispute with AI review
        await sql`
          UPDATE disputes
          SET
            status = ${newStatus},
            ai_review = ${JSON.stringify(aiReview)},
            resolved_at = ${decision !== 'escalate' ? new Date() : null}
          WHERE id = ${dispute_id}
        `;

        // Log audit entry
        await sql`
          INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, ai_version, llm_request_id)
          VALUES (
            'dispute_ai_review',
            'dispute',
            ${dispute_id},
            ${`worker:${worker.worker_type}`},
            ${JSON.stringify({
              decision,
              reasoning,
              confidence: confidence || 0.5,
              new_result: updatedResult,
              original_result: dispute.original_result,
            })},
            'dispute_agent_v1',
            ${llm_request_id || null}
          )
        `;

        logger.info(
          {
            requestId,
            dispute_id,
            decision,
            new_result: updatedResult,
            worker_type: worker.worker_type,
          },
          'Dispute AI review completed'
        );

        return reply.send({
          success: true,
          data: {
            dispute_id,
            decision,
            new_status: newStatus,
            new_result: updatedResult,
            message:
              decision === 'escalate'
                ? 'Dispute escalated to admin review'
                : `Dispute ${decision}`,
          },
        });
      } catch (error) {
        logger.error({ error, requestId, dispute_id }, 'Failed to record dispute review');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to record dispute review',
          },
        });
      }
    }
  );
}
