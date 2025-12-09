/**
 * Disputes API Routes
 *
 * Public endpoints for submitting and viewing disputes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../../db/index.js';
import { randomUUID } from 'crypto';

// Types
interface SubmitDisputeBody {
  market_address: string;
  user_address: string;
  reason: string;
  evidence_urls?: string[];
  user_token_balance: {
    yes_tokens: number;
    no_tokens: number;
  };
}

interface DisputeParams {
  id: string;
}

export async function disputesRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/disputes
   * List all disputes (public, paginated)
   */
  app.get(
    '/',
    async (request: FastifyRequest<{ Querystring: { status?: string; limit?: number; offset?: number } }>, reply: FastifyReply) => {
      const { status, limit = 20, offset = 0 } = request.query as { status?: string; limit?: number; offset?: number };

      try {
        const sql = getDb();

        let disputes;
        if (status) {
          disputes = await sql`
            SELECT
              d.id,
              d.market_address,
              d.user_address,
              d.reason,
              d.status,
              d.created_at,
              d.resolved_at,
              m.title as market_title
            FROM disputes d
            LEFT JOIN resolutions r ON d.resolution_id = r.id
            LEFT JOIN ai_markets m ON r.market_id = m.id
            WHERE d.status = ${status}
            ORDER BY d.created_at DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `;
        } else {
          disputes = await sql`
            SELECT
              d.id,
              d.market_address,
              d.user_address,
              d.reason,
              d.status,
              d.created_at,
              d.resolved_at,
              m.title as market_title
            FROM disputes d
            LEFT JOIN resolutions r ON d.resolution_id = r.id
            LEFT JOIN ai_markets m ON r.market_id = m.id
            ORDER BY d.created_at DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `;
        }

        return reply.send({
          success: true,
          data: disputes,
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to list disputes');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to list disputes',
          },
        });
      }
    }
  );

  /**
   * POST /api/v1/disputes
   * Submit a dispute for a resolved market
   */
  app.post<{ Body: SubmitDisputeBody }>(
    '/',
    async (request: FastifyRequest<{ Body: SubmitDisputeBody }>, reply: FastifyReply) => {
      const {
        market_address,
        user_address,
        reason,
        evidence_urls = [],
        user_token_balance,
      } = request.body;

      // Validate input
      if (!market_address || !user_address || !reason) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'invalid_request',
            message: 'Missing required fields: market_address, user_address, reason',
          },
        });
      }

      if (reason.length < 20) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'invalid_request',
            message: 'Reason must be at least 20 characters',
          },
        });
      }

      if (evidence_urls.length > 5) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'invalid_request',
            message: 'Maximum 5 evidence URLs allowed',
          },
        });
      }

      // Validate user holds tokens
      const totalTokens = (user_token_balance?.yes_tokens || 0) + (user_token_balance?.no_tokens || 0);
      if (totalTokens <= 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'insufficient_tokens',
            message: 'User must hold YES or NO tokens to submit a dispute',
          },
        });
      }

      try {
        const sql = getDb();

        // Find the market
        const [market] = await sql`
          SELECT id, status FROM ai_markets
          WHERE market_address = ${market_address}
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

        if (market.status !== 'resolved') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'invalid_market_status',
              message: 'Can only dispute resolved markets',
            },
          });
        }

        // Find the resolution
        const [resolution] = await sql`
          SELECT id, dispute_window_ends, status
          FROM resolutions
          WHERE market_id = ${market.id}
          ORDER BY resolved_at DESC
          LIMIT 1
        `;

        if (!resolution) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'not_found',
              message: 'Resolution not found',
            },
          });
        }

        // Check dispute window
        if (new Date() > new Date(resolution.dispute_window_ends)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'dispute_window_closed',
              message: 'Dispute window has closed',
            },
          });
        }

        // Check rate limiting (5/hr, 20/day per user)
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [hourCount] = await sql`
          SELECT COUNT(*) as count FROM disputes
          WHERE user_address = ${user_address}
          AND created_at > ${hourAgo}
        `;

        if (Number(hourCount.count) >= 5) {
          return reply.status(429).send({
            success: false,
            error: {
              code: 'rate_limit_exceeded',
              message: 'Maximum 5 disputes per hour',
            },
          });
        }

        const [dayCount] = await sql`
          SELECT COUNT(*) as count FROM disputes
          WHERE user_address = ${user_address}
          AND created_at > ${dayAgo}
        `;

        if (Number(dayCount.count) >= 20) {
          return reply.status(429).send({
            success: false,
            error: {
              code: 'rate_limit_exceeded',
              message: 'Maximum 20 disputes per day',
            },
          });
        }

        // Check for existing dispute from this user on this resolution
        const [existingDispute] = await sql`
          SELECT id FROM disputes
          WHERE resolution_id = ${resolution.id}
          AND user_address = ${user_address}
        `;

        if (existingDispute) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'duplicate_dispute',
              message: 'You have already submitted a dispute for this market',
            },
          });
        }

        // Create dispute
        const disputeId = randomUUID();
        await sql`
          INSERT INTO disputes (
            id,
            resolution_id,
            market_address,
            user_address,
            user_token_balance,
            reason,
            evidence_urls,
            status,
            created_at
          ) VALUES (
            ${disputeId},
            ${resolution.id},
            ${market_address},
            ${user_address},
            ${JSON.stringify(user_token_balance)},
            ${reason},
            ${evidence_urls},
            'pending',
            NOW()
          )
        `;

        // Update market status
        await sql`
          UPDATE ai_markets
          SET status = 'disputed'
          WHERE id = ${market.id}
        `;

        // TODO: Queue dispute for processing (publish to disputes queue)
        // For now, just create the record

        return reply.status(201).send({
          success: true,
          data: {
            dispute_id: disputeId,
            status: 'pending',
            message: 'Dispute submitted successfully. It will be reviewed within 24 hours.',
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to submit dispute');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to submit dispute',
          },
        });
      }
    }
  );

  /**
   * GET /api/v1/disputes/:id
   * Get dispute status and details
   */
  app.get<{ Params: DisputeParams }>(
    '/:id',
    async (request: FastifyRequest<{ Params: DisputeParams }>, reply: FastifyReply) => {
      const { id } = request.params;

      try {
        const sql = getDb();

        const [dispute] = await sql`
          SELECT
            d.id,
            d.resolution_id,
            d.market_address,
            d.user_address,
            d.user_token_balance,
            d.reason,
            d.evidence_urls,
            d.status,
            d.ai_review,
            d.admin_review,
            d.new_result,
            d.created_at,
            d.resolved_at,
            m.title as market_title,
            r.final_result as original_result
          FROM disputes d
          JOIN resolutions r ON d.resolution_id = r.id
          JOIN ai_markets m ON r.market_id = m.id
          WHERE d.id = ${id}
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

        return reply.send({
          success: true,
          data: {
            id: dispute.id,
            market_address: dispute.market_address,
            market_title: dispute.market_title,
            original_result: dispute.original_result,
            user_address: dispute.user_address,
            user_token_balance: dispute.user_token_balance,
            reason: dispute.reason,
            evidence_urls: dispute.evidence_urls,
            status: dispute.status,
            ai_review: dispute.ai_review,
            admin_review: dispute.admin_review,
            new_result: dispute.new_result,
            created_at: dispute.created_at,
            resolved_at: dispute.resolved_at,
          },
        });
      } catch (error) {
        request.log.error({ error, id }, 'Failed to get dispute');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to get dispute',
          },
        });
      }
    }
  );
}
