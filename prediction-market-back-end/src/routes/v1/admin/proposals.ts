import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../../db/index.js';
import { publishMarketPublish, isQueueConfigured } from '../../../services/ai/queue.service.js';
import { logger } from '../../../utils/logger.js';

// Review decision schema
const reviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  modifications: z
    .object({
      title: z.string().optional(),
      resolution: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  reason: z.string().min(1),
});

/**
 * Create API response envelope
 */
function createResponse<T>(
  data: T,
  requestId: string
): { success: true; data: T; meta: { request_id: string; timestamp: string } } {
  return {
    success: true,
    data,
    meta: {
      request_id: requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create error response
 */
function createErrorResponse(
  code: string,
  message: string,
  details: Record<string, unknown> | null,
  requestId: string
) {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: {
      request_id: requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

export async function adminProposalRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/admin/proposals - List proposals needing review
   */
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const sql = getDb();

    try {
      const { status, limit = '20', cursor } = request.query as {
        status?: string;
        limit?: string;
        cursor?: string;
      };

      const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

      // Build query
      let proposals;
      if (status) {
        proposals = await sql`
          SELECT
            p.id,
            p.proposal_text,
            p.status,
            p.category_hint,
            p.created_at,
            p.processed_at,
            m.title as draft_title,
            m.confidence_score,
            m.validation_decision
          FROM proposals p
          LEFT JOIN ai_markets m ON m.id = p.draft_market_id
          WHERE p.status = ${status}
          ORDER BY p.created_at DESC
          LIMIT ${limitNum + 1}
        `;
      } else {
        // Default: show needs_human status
        proposals = await sql`
          SELECT
            p.id,
            p.proposal_text,
            p.status,
            p.category_hint,
            p.created_at,
            p.processed_at,
            m.title as draft_title,
            m.confidence_score,
            m.validation_decision
          FROM proposals p
          LEFT JOIN ai_markets m ON m.id = p.draft_market_id
          WHERE p.status = 'needs_human'
          ORDER BY p.created_at ASC
          LIMIT ${limitNum + 1}
        `;
      }

      const hasMore = proposals.length > limitNum;
      const data = proposals.slice(0, limitNum);

      return reply.send({
        success: true,
        data,
        pagination: {
          total: data.length,
          limit: limitNum,
          has_more: hasMore,
          next_cursor: hasMore ? data[data.length - 1].id : null,
        },
        meta: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error({ error, requestId }, 'Failed to list proposals');
      return reply.status(500).send(
        createErrorResponse('internal_error', 'An unexpected error occurred', null, requestId)
      );
    }
  });

  /**
   * GET /api/v1/admin/proposals/:id - Get proposal details
   */
  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const sql = getDb();
    const { id } = request.params;

    try {
      const [proposal] = await sql`
        SELECT
          p.*,
          m.id as market_id,
          m.title as market_title,
          m.description as market_description,
          m.category as market_category,
          m.resolution as market_resolution,
          m.confidence_score as market_confidence,
          m.validation_decision,
          m.status as market_status
        FROM proposals p
        LEFT JOIN ai_markets m ON m.id = p.draft_market_id
        WHERE p.id = ${id}
      `;

      if (!proposal) {
        return reply.status(404).send(
          createErrorResponse('not_found', 'Proposal not found', null, requestId)
        );
      }

      return reply.send(createResponse(proposal, requestId));
    } catch (error) {
      logger.error({ error, requestId, proposalId: id }, 'Failed to fetch proposal');
      return reply.status(500).send(
        createErrorResponse('internal_error', 'An unexpected error occurred', null, requestId)
      );
    }
  });

  /**
   * POST /api/v1/admin/proposals/:id/review - Review a proposal
   */
  app.post(
    '/:id/review',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
      const sql = getDb();
      const { id } = request.params;
      const adminUser = (request as any).user?.address || 'admin';

      try {
        // Validate request
        const parseResult = reviewSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(400).send(
            createErrorResponse(
              'invalid_request',
              parseResult.error.issues[0].message,
              null,
              requestId
            )
          );
        }

        const { decision, modifications, reason } = parseResult.data;

        // Fetch proposal
        const [proposal] = await sql`
          SELECT p.*, m.id as market_id
          FROM proposals p
          LEFT JOIN ai_markets m ON m.id = p.draft_market_id
          WHERE p.id = ${id}
        `;

        if (!proposal) {
          return reply.status(404).send(
            createErrorResponse('not_found', 'Proposal not found', null, requestId)
          );
        }

        if (proposal.status !== 'needs_human') {
          return reply.status(400).send(
            createErrorResponse(
              'invalid_request',
              `Proposal is in ${proposal.status} status and cannot be reviewed`,
              null,
              requestId
            )
          );
        }

        if (decision === 'approve') {
          // Apply modifications if provided
          if (modifications && proposal.market_id) {
            const updates: Record<string, unknown> = {};
            if (modifications.title) updates.title = modifications.title;
            if (modifications.resolution) {
              // Merge resolution modifications
              const currentResolution = await sql`
                SELECT resolution FROM ai_markets WHERE id = ${proposal.market_id}
              `;
              updates.resolution = {
                ...currentResolution[0]?.resolution,
                ...modifications.resolution,
              };
            }

            if (Object.keys(updates).length > 0) {
              await sql`
                UPDATE ai_markets
                SET ${sql(updates)}
                WHERE id = ${proposal.market_id}
              `;
            }
          }

          // Update market status to approved
          if (proposal.market_id) {
            await sql`
              UPDATE ai_markets
              SET status = 'active'
              WHERE id = ${proposal.market_id}
            `;
          }

          // Update proposal status
          await sql`
            UPDATE proposals
            SET status = 'approved', processed_at = NOW()
            WHERE id = ${id}
          `;

          // Queue for publishing if queue is configured
          if (isQueueConfigured() && proposal.market_id) {
            await publishMarketPublish({
              draft_market_id: proposal.market_id,
              validation_id: `admin_review_${requestId}`,
            });
          }

          // Log audit
          await sql`
            INSERT INTO audit_logs (action, entity_type, entity_id, actor, details)
            VALUES (
              'admin_action',
              'proposal',
              ${id},
              ${adminUser},
              ${JSON.stringify({
                decision: 'approve',
                reason,
                modifications: modifications || null,
              })}
            )
          `;

          logger.info({ proposalId: id, adminUser }, 'Proposal approved by admin');
        } else {
          // Reject
          await sql`
            UPDATE proposals
            SET status = 'rejected', rejection_reason = ${reason}, processed_at = NOW()
            WHERE id = ${id}
          `;

          if (proposal.market_id) {
            await sql`
              UPDATE ai_markets
              SET status = 'canceled'
              WHERE id = ${proposal.market_id}
            `;
          }

          // Log audit
          await sql`
            INSERT INTO audit_logs (action, entity_type, entity_id, actor, details)
            VALUES (
              'admin_action',
              'proposal',
              ${id},
              ${adminUser},
              ${JSON.stringify({
                decision: 'reject',
                reason,
              })}
            )
          `;

          logger.info({ proposalId: id, adminUser, reason }, 'Proposal rejected by admin');
        }

        // Fetch updated proposal
        const [updated] = await sql`
          SELECT * FROM proposals WHERE id = ${id}
        `;

        return reply.send(
          createResponse(
            {
              proposal_id: id,
              status: updated.status,
              decision,
              reason,
            },
            requestId
          )
        );
      } catch (error) {
        logger.error({ error, requestId, proposalId: id }, 'Failed to review proposal');
        return reply.status(500).send(
          createErrorResponse('internal_error', 'An unexpected error occurred', null, requestId)
        );
      }
    }
  );
}
