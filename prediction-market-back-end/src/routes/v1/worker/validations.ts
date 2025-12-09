/**
 * Worker Validations Routes
 *
 * Endpoint for Validator worker to report validation decisions
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../../db/index.js';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger.js';
import { workerAuthMiddleware } from './auth.js';
import { publishMarketPublish, isQueueConfigured } from '../../../services/ai/queue.service.js';

const validationSchema = z.object({
  draft_market_id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected', 'needs_human']),
  reason: z.string().min(1),
  evidence: z.object({
    ambiguity_check: z.object({
      passed: z.boolean(),
      issues: z.array(z.string()).optional(),
    }).optional(),
    determinism_check: z.object({
      passed: z.boolean(),
      issues: z.array(z.string()).optional(),
    }).optional(),
    fairness_check: z.object({
      passed: z.boolean(),
      issues: z.array(z.string()).optional(),
    }).optional(),
    safety_check: z.object({
      passed: z.boolean(),
      issues: z.array(z.string()).optional(),
    }).optional(),
    duplicate_check: z.object({
      is_duplicate: z.boolean(),
      matched_market_id: z.string().optional(),
      similarity_score: z.number().optional(),
    }).optional(),
  }).optional(),
  llm_request_id: z.string().optional(),
});

export async function workerValidationsRoutes(app: FastifyInstance) {
  // Apply worker auth middleware to all routes
  app.addHook('preHandler', workerAuthMiddleware);

  /**
   * POST /api/v1/worker/validations
   * Report a validation decision
   */
  app.post(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers['x-request-id'] as string) || randomUUID();
      const worker = (request as any).worker;

      try {
        // Validate request
        const parseResult = validationSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'invalid_request',
              message: parseResult.error.issues[0].message,
            },
          });
        }

        const { draft_market_id, decision, reason, evidence, llm_request_id } = parseResult.data;
        const sql = getDb();

        // Verify draft market exists
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

        if (market.status !== 'draft') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'invalid_status',
              message: `Market is in ${market.status} status, expected draft`,
            },
          });
        }

        // Update market with validation decision
        const validationDecision = {
          status: decision,
          reason,
          evidence: evidence || {},
          validated_at: new Date().toISOString(),
          validated_by: `worker:${worker.worker_type}`,
        };

        let newStatus: string;
        switch (decision) {
          case 'approved':
            newStatus = 'pending_review'; // or 'active' if auto-publish is enabled
            break;
          case 'rejected':
            newStatus = 'canceled';
            break;
          case 'needs_human':
            newStatus = 'pending_review';
            break;
          default:
            newStatus = 'pending_review';
        }

        await sql`
          UPDATE ai_markets
          SET
            validation_decision = ${JSON.stringify(validationDecision)},
            status = ${newStatus}
          WHERE id = ${draft_market_id}
        `;

        // Update related proposal status if exists
        if (market.source_proposal_id) {
          let proposalStatus: string;
          switch (decision) {
            case 'approved':
              proposalStatus = 'approved';
              break;
            case 'rejected':
              proposalStatus = 'rejected';
              break;
            case 'needs_human':
              proposalStatus = 'needs_human';
              break;
            default:
              proposalStatus = 'needs_human';
          }

          await sql`
            UPDATE proposals
            SET status = ${proposalStatus}, rejection_reason = ${decision === 'rejected' ? reason : null}
            WHERE id = ${market.source_proposal_id}
          `;
        }

        // If approved, queue for publishing
        if (decision === 'approved' && isQueueConfigured()) {
          await publishMarketPublish({
            draft_market_id,
            validation_id: `validation_${requestId}`,
          });
        }

        // Log audit entry
        await sql`
          INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, ai_version, llm_request_id)
          VALUES (
            'validation_completed',
            'ai_market',
            ${draft_market_id},
            ${`worker:${worker.worker_type}`},
            ${JSON.stringify({
              decision,
              reason,
              evidence: evidence || {},
            })},
            'validator_v1',
            ${llm_request_id || null}
          )
        `;

        logger.info(
          { requestId, draft_market_id, decision, worker_type: worker.worker_type },
          'Validation decision recorded'
        );

        return reply.send({
          success: true,
          data: {
            draft_market_id,
            decision,
            new_status: newStatus,
            message: `Validation ${decision}`,
          },
        });
      } catch (error) {
        logger.error({ error, requestId }, 'Failed to record validation');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to record validation',
          },
        });
      }
    }
  );
}
