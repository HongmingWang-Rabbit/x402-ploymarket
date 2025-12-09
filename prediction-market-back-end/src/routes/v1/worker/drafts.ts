/**
 * Worker Drafts Routes
 *
 * Endpoint for Generator worker to report generated draft markets
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../../db/index.js';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger.js';
import { workerAuthMiddleware } from './auth.js';

const draftSchema = z.object({
  candidate_id: z.string().uuid().optional(),
  proposal_id: z.string().uuid().optional(),
  draft_market: z.object({
    title: z.string().min(1).max(256),
    description: z.string().min(1),
    category: z.enum(['politics', 'product_launch', 'finance', 'sports', 'entertainment', 'technology', 'misc']),
    image_url: z.string().url().optional(),
    resolution: z.object({
      type: z.literal('binary'),
      exact_question: z.string(),
      criteria: z.object({
        must_meet_all: z.array(z.string()),
        must_not_count: z.array(z.string()),
        allowed_sources: z.array(z.object({
          name: z.string(),
          url: z.string().url(),
          method: z.string().optional(),
          condition: z.string().optional(),
        })),
      }),
      expiry: z.string().datetime(),
    }),
    confidence_score: z.number().min(0).max(1),
  }),
  llm_request_id: z.string().optional(),
});

export async function workerDraftsRoutes(app: FastifyInstance) {
  // Apply worker auth middleware to all routes
  app.addHook('preHandler', workerAuthMiddleware);

  /**
   * POST /api/v1/worker/drafts
   * Report a generated draft market
   */
  app.post(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers['x-request-id'] as string) || randomUUID();
      const worker = (request as any).worker;

      try {
        // Validate request
        const parseResult = draftSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'invalid_request',
              message: parseResult.error.issues[0].message,
            },
          });
        }

        const { candidate_id, proposal_id, draft_market, llm_request_id } = parseResult.data;

        // Must have either candidate_id or proposal_id
        if (!candidate_id && !proposal_id) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'invalid_request',
              message: 'Either candidate_id or proposal_id is required',
            },
          });
        }

        const sql = getDb();

        // Create the draft market
        const draftId = randomUUID();
        const aiVersion = `worker_${worker.worker_type}_v1`;

        await sql`
          INSERT INTO ai_markets (
            id,
            title,
            description,
            category,
            image_url,
            ai_version,
            confidence_score,
            resolution,
            status,
            created_by,
            source_news_id
          ) VALUES (
            ${draftId},
            ${draft_market.title},
            ${draft_market.description},
            ${draft_market.category},
            ${draft_market.image_url || null},
            ${aiVersion},
            ${draft_market.confidence_score},
            ${JSON.stringify(draft_market.resolution)},
            'draft',
            ${`worker:${worker.worker_type}`},
            ${candidate_id ? (await sql`SELECT news_id FROM candidates WHERE id = ${candidate_id}`)[0]?.news_id : null}
          )
        `;

        // Update candidate if provided
        if (candidate_id) {
          await sql`
            UPDATE candidates
            SET processed = true, draft_market_id = ${draftId}
            WHERE id = ${candidate_id}
          `;
        }

        // Update proposal if provided
        if (proposal_id) {
          await sql`
            UPDATE proposals
            SET status = 'draft_created', draft_market_id = ${draftId}, processed_at = NOW()
            WHERE id = ${proposal_id}
          `;

          // Also link the market to the proposal
          await sql`
            UPDATE ai_markets
            SET source_proposal_id = ${proposal_id}
            WHERE id = ${draftId}
          `;
        }

        // Log audit entry
        await sql`
          INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, ai_version, llm_request_id)
          VALUES (
            'draft_created',
            'ai_market',
            ${draftId},
            ${`worker:${worker.worker_type}`},
            ${JSON.stringify({
              candidate_id,
              proposal_id,
              confidence_score: draft_market.confidence_score,
            })},
            ${aiVersion},
            ${llm_request_id || null}
          )
        `;

        logger.info(
          { requestId, draftId, candidate_id, proposal_id, worker_type: worker.worker_type },
          'Draft market created by worker'
        );

        return reply.status(201).send({
          success: true,
          data: {
            draft_market_id: draftId,
            status: 'draft',
            message: 'Draft market created successfully',
          },
        });
      } catch (error) {
        logger.error({ error, requestId }, 'Failed to create draft market');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to create draft market',
          },
        });
      }
    }
  );
}
