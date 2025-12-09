/**
 * Admin Ingest Routes
 *
 * Manual news ingestion endpoint for admins
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../../../db/index.js';
import { createHash, randomUUID } from 'crypto';

interface IngestBody {
  source: string;
  url: string;
  title: string;
  content: string;
  published_at?: string;
  category_hint?: string;
}

export async function adminIngestRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/admin/ingest
   * Manually ingest a news item
   */
  app.post<{ Body: IngestBody }>(
    '/',
    async (request: FastifyRequest<{ Body: IngestBody }>, reply: FastifyReply) => {
      const {
        source,
        url,
        title,
        content,
        published_at,
        category_hint,
      } = request.body;

      // Validate required fields
      if (!source || !url || !title || !content) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'invalid_request',
            message: 'Missing required fields: source, url, title, content',
          },
        });
      }

      // Validate URL is HTTPS
      if (!url.startsWith('https://')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'invalid_url',
            message: 'URL must use HTTPS',
          },
        });
      }

      try {
        const sql = getDb();

        // Compute content hash for deduplication
        const contentHash = createHash('sha256')
          .update(`${title}${content}`)
          .digest('hex');

        // Check for duplicates
        const [existing] = await sql`
          SELECT id FROM news_items WHERE content_hash = ${contentHash}
        `;

        if (existing) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'duplicate_content',
              message: 'Content already exists',
              existing_id: existing.id,
            },
          });
        }

        // Insert news item
        const newsId = randomUUID();
        const publishedAt = published_at ? new Date(published_at) : new Date();

        await sql`
          INSERT INTO news_items (
            id,
            source,
            source_url,
            title,
            content,
            published_at,
            content_hash,
            status,
            ingested_at
          ) VALUES (
            ${newsId},
            ${source},
            ${url},
            ${title},
            ${content},
            ${publishedAt},
            ${contentHash},
            'ingested',
            NOW()
          )
        `;

        // Create audit log
        await sql`
          INSERT INTO audit_logs (
            action,
            entity_type,
            entity_id,
            actor,
            details,
            created_at
          ) VALUES (
            'manual_ingest',
            'news_item',
            ${newsId},
            'admin',
            ${JSON.stringify({ source, url, category_hint })},
            NOW()
          )
        `;

        // TODO: Optionally publish to news.raw queue for processing
        // For now, just return success

        return reply.status(201).send({
          success: true,
          data: {
            news_id: newsId,
            content_hash: contentHash,
            status: 'ingested',
            message: 'News item ingested successfully',
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to ingest news');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to ingest news item',
          },
        });
      }
    }
  );
}
