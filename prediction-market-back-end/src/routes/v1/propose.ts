import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { publishCandidate, isQueueConfigured } from '../../services/ai/queue.service.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import type {
  ProposeRequest,
  ProposeResponseData,
  MarketCategory,
} from '@x402/shared-types';

// Request validation schema
const proposeSchema = z.object({
  proposal_text: z.string().min(10).max(500),
  category_hint: z
    .enum(['politics', 'product_launch', 'finance', 'sports', 'entertainment', 'technology', 'misc'])
    .optional(),
});

// Rate limit windows
const RATE_LIMITS = {
  minute: { limit: env.RATE_LIMIT_PROPOSE_PER_MIN, windowMs: 60 * 1000 },
  hour: { limit: env.RATE_LIMIT_PROPOSE_PER_HOUR, windowMs: 60 * 60 * 1000 },
  day: { limit: env.RATE_LIMIT_PROPOSE_PER_DAY, windowMs: 24 * 60 * 60 * 1000 },
};

/**
 * Check rate limits for a given identifier
 */
async function checkRateLimit(
  identifier: string,
  endpoint: string
): Promise<{ allowed: boolean; limit?: number; window?: string; retryAfter?: number }> {
  const sql = getDb();

  for (const [windowType, config] of Object.entries(RATE_LIMITS)) {
    const windowStart = new Date(Date.now() - config.windowMs);

    // Get current count for this window
    const [result] = await sql`
      SELECT COALESCE(SUM(count), 0)::int as total
      FROM rate_limits
      WHERE identifier = ${identifier}
        AND endpoint = ${endpoint}
        AND window_type = ${windowType}
        AND window_start > ${windowStart}
    `;

    const currentCount = result?.total || 0;

    if (currentCount >= config.limit) {
      // Calculate retry after
      const [oldestRecord] = await sql`
        SELECT window_start
        FROM rate_limits
        WHERE identifier = ${identifier}
          AND endpoint = ${endpoint}
          AND window_type = ${windowType}
          AND window_start > ${windowStart}
        ORDER BY window_start ASC
        LIMIT 1
      `;

      const retryAfter = oldestRecord
        ? Math.ceil((new Date(oldestRecord.window_start).getTime() + config.windowMs - Date.now()) / 1000)
        : Math.ceil(config.windowMs / 1000);

      return {
        allowed: false,
        limit: config.limit,
        window: windowType,
        retryAfter,
      };
    }
  }

  return { allowed: true };
}

/**
 * Increment rate limit counter
 */
async function incrementRateLimit(identifier: string, endpoint: string): Promise<void> {
  const sql = getDb();
  const now = new Date();

  // Increment for each window type
  for (const windowType of Object.keys(RATE_LIMITS)) {
    await sql`
      INSERT INTO rate_limits (identifier, endpoint, window_start, window_type, count)
      VALUES (${identifier}, ${endpoint}, ${now}, ${windowType}, 1)
      ON CONFLICT (identifier, endpoint, window_start, window_type)
      DO UPDATE SET count = rate_limits.count + 1
    `;
  }
}

/**
 * Check for existing similar markets
 */
async function findSimilarMarkets(proposalText: string): Promise<{
  id: string;
  market_address: string;
  title: string;
  similarity_score: number;
} | null> {
  const sql = getDb();

  // Use pg_trgm similarity search
  const results = await sql`
    SELECT
      id,
      market_address,
      title,
      similarity(title, ${proposalText}) as title_sim,
      similarity(resolution->>'exact_question', ${proposalText}) as question_sim
    FROM ai_markets
    WHERE status IN ('active', 'resolving', 'resolved')
      AND market_address IS NOT NULL
      AND (
        similarity(title, ${proposalText}) > 0.5
        OR similarity(resolution->>'exact_question', ${proposalText}) > 0.6
      )
    ORDER BY GREATEST(
      similarity(title, ${proposalText}),
      similarity(resolution->>'exact_question', ${proposalText})
    ) DESC
    LIMIT 1
  `;

  if (results.length > 0) {
    const match = results[0];
    const similarityScore = Math.max(match.title_sim, match.question_sim);

    // Only return if similarity is high enough
    if (similarityScore > 0.7) {
      return {
        id: match.id,
        market_address: match.market_address,
        title: match.title,
        similarity_score: similarityScore,
      };
    }
  }

  return null;
}

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
 * Create error response envelope
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

export async function proposeRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/propose - Submit a market proposal
   */
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const sql = getDb();

    try {
      // Parse and validate request body
      const parseResult = proposeSchema.safeParse(request.body);
      if (!parseResult.success) {
        const error = parseResult.error.issues[0];
        return reply.status(400).send(
          createErrorResponse(
            'invalid_request',
            error.message,
            {
              field: error.path.join('.'),
              constraint: error.code,
            },
            requestId
          )
        );
      }

      const { proposal_text, category_hint } = parseResult.data;

      // Get identifier for rate limiting (user ID from JWT or IP)
      const userId = (request as any).user?.address || null;
      const identifier = userId || request.ip || 'unknown';

      // Check rate limits
      const rateLimitCheck = await checkRateLimit(identifier, '/api/v1/propose');
      if (!rateLimitCheck.allowed) {
        reply.header('Retry-After', rateLimitCheck.retryAfter);
        reply.header('X-RateLimit-Limit', rateLimitCheck.limit);
        reply.header('X-RateLimit-Remaining', 0);

        return reply.status(429).send(
          createErrorResponse(
            'rate_limit_exceeded',
            `You have exceeded the ${rateLimitCheck.window}ly proposal limit`,
            {
              limit: rateLimitCheck.limit,
              window: rateLimitCheck.window,
              retry_after: rateLimitCheck.retryAfter,
            },
            requestId
          )
        );
      }

      // Check for duplicate/similar markets
      const existingMarket = await findSimilarMarkets(proposal_text);
      if (existingMarket) {
        // Create proposal record with matched status
        const [proposal] = await sql`
          INSERT INTO proposals (user_id, proposal_text, category_hint, status, matched_market_id, ip_address)
          VALUES (${userId}, ${proposal_text}, ${category_hint || null}, 'matched', ${existingMarket.id}, ${request.ip})
          RETURNING id
        `;

        // Increment rate limit
        await incrementRateLimit(identifier, '/api/v1/propose');

        const responseData: ProposeResponseData = {
          proposal_id: proposal.id,
          status: 'matched',
          existing_market: {
            id: existingMarket.id,
            market_address: existingMarket.market_address,
            title: existingMarket.title,
            similarity_score: existingMarket.similarity_score,
          },
          draft_market: null,
          validation_status: null,
          rules_summary: null,
        };

        return reply.send(createResponse(responseData, requestId));
      }

      // Create proposal record
      const [proposal] = await sql`
        INSERT INTO proposals (user_id, proposal_text, category_hint, status, ip_address)
        VALUES (${userId}, ${proposal_text}, ${category_hint || null}, 'pending', ${request.ip})
        RETURNING id
      `;

      // Increment rate limit
      await incrementRateLimit(identifier, '/api/v1/propose');

      // Check if queue is configured
      if (!isQueueConfigured()) {
        logger.warn('RabbitMQ not configured, proposal will remain pending');

        const responseData: ProposeResponseData = {
          proposal_id: proposal.id,
          status: 'pending',
          existing_market: null,
          draft_market: null,
          validation_status: null,
          rules_summary: null,
        };

        return reply.send(createResponse(responseData, requestId));
      }

      // Create candidate and queue for processing
      const [candidate] = await sql`
        INSERT INTO candidates (news_id, entities, event_type, category_hint, relevant_text, processed)
        VALUES (
          NULL,
          ARRAY[]::text[],
          'user_proposal',
          ${category_hint || 'misc'},
          ${proposal_text},
          false
        )
        RETURNING id
      `;

      // Update proposal status
      await sql`
        UPDATE proposals SET status = 'processing' WHERE id = ${proposal.id}
      `;

      // Publish to candidates queue
      await publishCandidate({
        candidate_id: candidate.id,
        news_id: null,
        entities: [],
        event_type: 'user_proposal',
        category_hint: (category_hint || 'misc') as MarketCategory,
        relevant_text: proposal_text,
        proposal_id: proposal.id,
      });

      logger.info({ proposalId: proposal.id, candidateId: candidate.id }, 'Proposal queued for processing');

      const responseData: ProposeResponseData = {
        proposal_id: proposal.id,
        status: 'processing',
        existing_market: null,
        draft_market: null,
        validation_status: null,
        rules_summary: null,
      };

      return reply.send(createResponse(responseData, requestId));
    } catch (error) {
      logger.error({ error, requestId }, 'Failed to process proposal');

      return reply.status(500).send(
        createErrorResponse(
          'internal_error',
          'An unexpected error occurred',
          null,
          requestId
        )
      );
    }
  });

  /**
   * GET /api/v1/proposals/:id - Get proposal status
   */
  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const sql = getDb();
    const { id } = request.params;

    try {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return reply.status(400).send(
          createErrorResponse('invalid_request', 'Invalid proposal ID format', null, requestId)
        );
      }

      // Fetch proposal with related market data
      const [proposal] = await sql`
        SELECT
          p.id,
          p.proposal_text,
          p.status,
          p.category_hint,
          p.confidence_score,
          p.rejection_reason,
          p.created_at,
          p.processed_at,
          p.draft_market_id,
          p.matched_market_id,
          m.id as market_id,
          m.title as market_title,
          m.description as market_description,
          m.category as market_category,
          m.market_address,
          m.resolution as market_resolution,
          m.confidence_score as market_confidence,
          m.validation_decision
        FROM proposals p
        LEFT JOIN ai_markets m ON m.id = COALESCE(p.draft_market_id, p.matched_market_id)
        WHERE p.id = ${id}
      `;

      if (!proposal) {
        return reply.status(404).send(
          createErrorResponse('not_found', 'Proposal not found', null, requestId)
        );
      }

      // Build response based on status
      let draftMarket = null;
      let existingMarket = null;
      let rulesSummary = null;

      if (proposal.market_id) {
        const resolution = proposal.market_resolution;

        if (proposal.matched_market_id) {
          existingMarket = {
            id: proposal.market_id,
            market_address: proposal.market_address,
            title: proposal.market_title,
            similarity_score: proposal.confidence_score || 0,
          };
        } else if (proposal.draft_market_id) {
          draftMarket = {
            id: proposal.market_id,
            title: proposal.market_title,
            description: proposal.market_description,
            category: proposal.market_category as MarketCategory,
            confidence_score: proposal.market_confidence,
            resolution,
          };

          if (resolution?.criteria) {
            rulesSummary = {
              must_meet_all: resolution.criteria.must_meet_all || [],
              must_not_count: resolution.criteria.must_not_count || [],
              allowed_sources: (resolution.criteria.allowed_sources || []).map(
                (s: { name: string }) => s.name
              ),
            };
          }
        }
      }

      const responseData = {
        id: proposal.id,
        proposal_text: proposal.proposal_text,
        status: proposal.status,
        category_hint: proposal.category_hint,
        draft_market_id: proposal.draft_market_id,
        matched_market_id: proposal.matched_market_id,
        confidence_score: proposal.confidence_score,
        rejection_reason: proposal.rejection_reason,
        created_at: proposal.created_at,
        processed_at: proposal.processed_at,
        existing_market: existingMarket,
        draft_market: draftMarket,
        rules_summary: rulesSummary,
      };

      return reply.send(createResponse(responseData, requestId));
    } catch (error) {
      logger.error({ error, requestId, proposalId: id }, 'Failed to fetch proposal');

      return reply.status(500).send(
        createErrorResponse('internal_error', 'An unexpected error occurred', null, requestId)
      );
    }
  });
}
