import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../../db/index.js';
import { logger } from '../../../utils/logger.js';

// Review dispute schema
const reviewDisputeSchema = z.object({
  decision: z.enum(['uphold', 'overturn']),
  new_result: z.enum(['YES', 'NO']).optional(),
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

export async function adminDisputeRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/admin/disputes - List disputes
   */
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const sql = getDb();

    try {
      const { status, limit = '20' } = request.query as {
        status?: string;
        limit?: string;
      };

      const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

      let disputes;
      if (status) {
        disputes = await sql`
          SELECT
            d.*,
            r.final_result as original_result,
            r.resolution_source,
            m.title as market_title,
            m.market_address
          FROM disputes d
          JOIN resolutions r ON r.id = d.resolution_id
          JOIN ai_markets m ON m.id = r.market_id
          WHERE d.status = ${status}
          ORDER BY d.created_at DESC
          LIMIT ${limitNum}
        `;
      } else {
        // Default: pending and escalated disputes
        disputes = await sql`
          SELECT
            d.*,
            r.final_result as original_result,
            r.resolution_source,
            m.title as market_title,
            m.market_address
          FROM disputes d
          JOIN resolutions r ON r.id = d.resolution_id
          JOIN ai_markets m ON m.id = r.market_id
          WHERE d.status IN ('pending', 'escalated')
          ORDER BY d.created_at ASC
          LIMIT ${limitNum}
        `;
      }

      return reply.send({
        success: true,
        data: disputes,
        pagination: {
          total: disputes.length,
          limit: limitNum,
          has_more: disputes.length === limitNum,
          next_cursor: null,
        },
        meta: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error({ error, requestId }, 'Failed to list disputes');
      return reply.status(500).send(
        createErrorResponse('internal_error', 'An unexpected error occurred', null, requestId)
      );
    }
  });

  /**
   * GET /api/v1/admin/disputes/:id - Get dispute details
   */
  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const sql = getDb();
    const { id } = request.params;

    try {
      const [dispute] = await sql`
        SELECT
          d.*,
          r.final_result as original_result,
          r.resolution_source,
          r.evidence_hash,
          r.evidence_raw,
          r.must_meet_all_results,
          r.must_not_count_results,
          m.title as market_title,
          m.description as market_description,
          m.market_address,
          m.resolution as market_resolution
        FROM disputes d
        JOIN resolutions r ON r.id = d.resolution_id
        JOIN ai_markets m ON m.id = r.market_id
        WHERE d.id = ${id}
      `;

      if (!dispute) {
        return reply.status(404).send(
          createErrorResponse('not_found', 'Dispute not found', null, requestId)
        );
      }

      return reply.send(createResponse(dispute, requestId));
    } catch (error) {
      logger.error({ error, requestId, disputeId: id }, 'Failed to fetch dispute');
      return reply.status(500).send(
        createErrorResponse('internal_error', 'An unexpected error occurred', null, requestId)
      );
    }
  });

  /**
   * POST /api/v1/admin/disputes/:id/review - Review a dispute
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
        const parseResult = reviewDisputeSchema.safeParse(request.body);
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

        const { decision, new_result, reason } = parseResult.data;

        // Validate that new_result is provided if overturning
        if (decision === 'overturn' && !new_result) {
          return reply.status(400).send(
            createErrorResponse(
              'invalid_request',
              'new_result is required when overturning a dispute',
              null,
              requestId
            )
          );
        }

        // Fetch dispute
        const [dispute] = await sql`
          SELECT d.*, r.id as resolution_id, r.market_id, m.market_address
          FROM disputes d
          JOIN resolutions r ON r.id = d.resolution_id
          JOIN ai_markets m ON m.id = r.market_id
          WHERE d.id = ${id}
        `;

        if (!dispute) {
          return reply.status(404).send(
            createErrorResponse('not_found', 'Dispute not found', null, requestId)
          );
        }

        if (!['pending', 'escalated', 'reviewing'].includes(dispute.status)) {
          return reply.status(400).send(
            createErrorResponse(
              'invalid_request',
              `Dispute is in ${dispute.status} status and cannot be reviewed`,
              null,
              requestId
            )
          );
        }

        if (decision === 'uphold') {
          // Uphold original resolution
          await sql`
            UPDATE disputes
            SET
              status = 'upheld',
              admin_review = ${JSON.stringify({ decision, reason, reviewed_by: adminUser })},
              resolved_at = NOW()
            WHERE id = ${id}
          `;

          // Update resolution status to finalized
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

          logger.info({ disputeId: id, adminUser }, 'Dispute upheld by admin');
        } else {
          // Overturn resolution - new_result is guaranteed by validation above
          const finalResult = new_result!;

          await sql`
            UPDATE disputes
            SET
              status = 'overturned',
              new_result = ${finalResult},
              admin_review = ${JSON.stringify({ decision, reason, new_result: finalResult, reviewed_by: adminUser })},
              resolved_at = NOW()
            WHERE id = ${id}
          `;

          // Update resolution with new result
          await sql`
            UPDATE resolutions
            SET
              final_result = ${finalResult},
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

          // TODO: Trigger on-chain resolution update if needed

          logger.info(
            { disputeId: id, adminUser, newResult: finalResult },
            'Dispute overturned by admin'
          );
        }

        // Log audit
        await sql`
          INSERT INTO audit_logs (action, entity_type, entity_id, actor, details)
          VALUES (
            'dispute_resolved',
            'dispute',
            ${id},
            ${adminUser},
            ${JSON.stringify({
              decision,
              reason,
              new_result: decision === 'overturn' ? new_result : null,
            })}
          )
        `;

        return reply.send(
          createResponse(
            {
              dispute_id: id,
              status: decision === 'uphold' ? 'upheld' : 'overturned',
              decision,
              new_result: decision === 'overturn' ? new_result : null,
              reason,
            },
            requestId
          )
        );
      } catch (error) {
        logger.error({ error, requestId, disputeId: id }, 'Failed to review dispute');
        return reply.status(500).send(
          createErrorResponse('internal_error', 'An unexpected error occurred', null, requestId)
        );
      }
    }
  );
}
