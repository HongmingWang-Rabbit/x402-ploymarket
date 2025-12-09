/**
 * AI Markets API Routes
 *
 * Public endpoints for listing and viewing AI-generated markets
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../../db/index.js';

// Types
type MarketStatus = 'draft' | 'pending_review' | 'active' | 'resolving' | 'resolved' | 'finalized' | 'disputed' | 'canceled';
type MarketCategory = 'politics' | 'product_launch' | 'finance' | 'sports' | 'entertainment' | 'technology' | 'misc';

interface ListMarketsQuery {
  status?: MarketStatus;
  category?: MarketCategory;
  limit?: number;
  cursor?: string;
}

interface MarketParams {
  address: string;
}

interface AIMarket {
  id: string;
  market_address: string | null;
  title: string;
  description: string;
  category: MarketCategory;
  image_url: string | null;
  ai_version: string;
  confidence_score: number;
  resolution: {
    type: 'binary';
    exact_question: string;
    criteria: {
      must_meet_all: string[];
      must_not_count: string[];
      allowed_sources: Array<{
        name: string;
        url: string;
        method?: string;
        condition?: string;
      }>;
    };
    expiry: string;
  };
  status: MarketStatus;
  validation_decision: {
    status: string;
    reason: string;
    evidence?: string[];
  } | null;
  created_at: string;
  published_at: string | null;
  resolved_at: string | null;
}

export async function aiMarketsRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/markets
   * List AI-generated markets with filtering and pagination
   */
  app.get<{ Querystring: ListMarketsQuery }>(
    '/',
    async (request: FastifyRequest<{ Querystring: ListMarketsQuery }>, reply: FastifyReply) => {
      const { status, category, limit = 20, cursor } = request.query;

      // Validate limit
      const safeLimit = Math.min(Math.max(1, limit), 100);

      try {
        const sql = getDb();

        // Build query conditions
        const conditions: string[] = [];
        const values: (string | Date)[] = [];
        let paramIndex = 1;

        // Only show published markets by default (exclude drafts)
        if (status) {
          conditions.push(`status = $${paramIndex++}`);
          values.push(status);
        } else {
          // Default: show active, resolving, resolved, finalized markets
          conditions.push(`status IN ('active', 'resolving', 'resolved', 'finalized')`);
        }

        if (category) {
          conditions.push(`category = $${paramIndex++}`);
          values.push(category);
        }

        if (cursor) {
          conditions.push(`created_at < $${paramIndex++}`);
          values.push(new Date(cursor));
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Query markets
        const markets = await sql.unsafe(`
          SELECT
            id,
            market_address,
            title,
            description,
            category,
            image_url,
            ai_version,
            confidence_score,
            resolution,
            status,
            validation_decision,
            created_at,
            published_at,
            resolved_at
          FROM ai_markets
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT ${safeLimit + 1}
        `, values);

        // Check if there are more results
        const hasMore = markets.length > safeLimit;
        const data = hasMore ? markets.slice(0, safeLimit) : markets;
        const nextCursor = hasMore && data.length > 0
          ? data[data.length - 1].created_at
          : null;

        return reply.send({
          success: true,
          data: data.map(formatMarket),
          meta: {
            total: data.length,
            limit: safeLimit,
            has_more: hasMore,
            next_cursor: nextCursor,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to list AI markets');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to list markets',
          },
        });
      }
    }
  );

  /**
   * GET /api/v1/markets/:address
   * Get detailed AI market information by market address
   */
  app.get<{ Params: MarketParams }>(
    '/:address',
    async (request: FastifyRequest<{ Params: MarketParams }>, reply: FastifyReply) => {
      const { address } = request.params;

      try {
        const sql = getDb();

        // Fetch market
        const [market] = await sql`
          SELECT
            m.id,
            m.market_address,
            m.title,
            m.description,
            m.category,
            m.image_url,
            m.ai_version,
            m.confidence_score,
            m.resolution,
            m.status,
            m.validation_decision,
            m.created_at,
            m.published_at,
            m.resolved_at,
            m.finalized_at,
            m.source_news_id,
            m.source_proposal_id
          FROM ai_markets m
          WHERE m.market_address = ${address}
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

        // Fetch resolution record if market is resolved
        let resolutionRecord = null;
        if (['resolved', 'finalized', 'disputed'].includes(market.status)) {
          const [resolution] = await sql`
            SELECT
              id,
              final_result,
              resolution_source,
              evidence_hash,
              must_meet_all_results,
              must_not_count_results,
              status,
              resolved_by,
              resolved_at,
              tx_signature,
              dispute_window_ends,
              finalized_at
            FROM resolutions
            WHERE market_id = ${market.id}
            ORDER BY resolved_at DESC
            LIMIT 1
          `;
          resolutionRecord = resolution || null;
        }

        // Fetch any active disputes
        let disputes: Record<string, unknown>[] = [];
        if (resolutionRecord) {
          disputes = await sql`
            SELECT
              id,
              user_address,
              reason,
              status,
              ai_review,
              admin_review,
              new_result,
              created_at,
              resolved_at
            FROM disputes
            WHERE resolution_id = ${resolutionRecord.id}
            ORDER BY created_at DESC
          `;
        }

        return reply.send({
          success: true,
          data: {
            ...formatMarket(market),
            finalized_at: market.finalized_at,
            source_news_id: market.source_news_id,
            source_proposal_id: market.source_proposal_id,
            resolution_record: resolutionRecord ? {
              id: resolutionRecord.id,
              final_result: resolutionRecord.final_result,
              resolution_source: resolutionRecord.resolution_source,
              evidence_hash: resolutionRecord.evidence_hash,
              must_meet_all_results: resolutionRecord.must_meet_all_results,
              must_not_count_results: resolutionRecord.must_not_count_results,
              status: resolutionRecord.status,
              resolved_by: resolutionRecord.resolved_by,
              resolved_at: resolutionRecord.resolved_at,
              tx_signature: resolutionRecord.tx_signature,
              dispute_window_ends: resolutionRecord.dispute_window_ends,
              finalized_at: resolutionRecord.finalized_at,
            } : null,
            disputes: disputes.map(d => ({
              id: d.id,
              user_address: d.user_address,
              reason: d.reason,
              status: d.status,
              ai_review: d.ai_review,
              admin_review: d.admin_review,
              new_result: d.new_result,
              created_at: d.created_at,
              resolved_at: d.resolved_at,
            })),
          },
        });
      } catch (error) {
        request.log.error({ error, address }, 'Failed to get AI market');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to get market',
          },
        });
      }
    }
  );
}

/**
 * Format market for API response
 */
function formatMarket(market: Record<string, unknown>): AIMarket {
  return {
    id: market.id as string,
    market_address: market.market_address as string | null,
    title: market.title as string,
    description: market.description as string,
    category: market.category as MarketCategory,
    image_url: market.image_url as string | null,
    ai_version: market.ai_version as string,
    confidence_score: Number(market.confidence_score),
    resolution: market.resolution as AIMarket['resolution'],
    status: market.status as MarketStatus,
    validation_decision: market.validation_decision as AIMarket['validation_decision'],
    created_at: (market.created_at as Date).toISOString(),
    published_at: market.published_at ? (market.published_at as Date).toISOString() : null,
    resolved_at: market.resolved_at ? (market.resolved_at as Date).toISOString() : null,
  };
}
