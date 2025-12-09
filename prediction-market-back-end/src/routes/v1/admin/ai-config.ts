/**
 * Admin AI Config Routes
 *
 * Get and update AI configuration
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../../../db/index.js';

interface UpdateConfigBody {
  ai_version?: string;
  llm_model?: string;
  validation_confidence_threshold?: number;
  categories?: string[];
  rate_limits?: {
    propose_per_minute?: number;
    propose_per_hour?: number;
    propose_per_day?: number;
    dispute_per_hour?: number;
    dispute_per_day?: number;
  };
  dispute_window_hours?: number;
  max_retries?: number;
}

export async function adminAiConfigRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/admin/ai-config
   * Get current AI configuration
   */
  app.get(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sql = getDb();

        const configs = await sql`
          SELECT key, value, updated_at, updated_by
          FROM ai_config
          ORDER BY key
        `;

        // Convert to object format
        const configObject: Record<string, unknown> = {};
        const metadata: Record<string, { updated_at: Date; updated_by: string }> = {};

        for (const config of configs) {
          configObject[config.key] = config.value;
          metadata[config.key] = {
            updated_at: config.updated_at,
            updated_by: config.updated_by,
          };
        }

        return reply.send({
          success: true,
          data: {
            config: configObject,
            metadata,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to get AI config');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to get AI configuration',
          },
        });
      }
    }
  );

  /**
   * PATCH /api/v1/admin/ai-config
   * Update AI configuration (partial updates supported)
   */
  app.patch<{ Body: UpdateConfigBody }>(
    '/',
    async (request: FastifyRequest<{ Body: UpdateConfigBody }>, reply: FastifyReply) => {
      const updates = request.body;

      if (!updates || Object.keys(updates).length === 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'invalid_request',
            message: 'No updates provided',
          },
        });
      }

      try {
        const sql = getDb();

        const updatedKeys: string[] = [];
        const actor = 'admin'; // TODO: Get from auth context

        // Update each provided config key
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined) continue;

          // Validate specific fields
          if (key === 'validation_confidence_threshold') {
            if (typeof value !== 'number' || value < 0 || value > 1) {
              return reply.status(400).send({
                success: false,
                error: {
                  code: 'invalid_value',
                  message: 'validation_confidence_threshold must be between 0 and 1',
                },
              });
            }
          }

          if (key === 'dispute_window_hours') {
            if (typeof value !== 'number' || value < 1 || value > 168) {
              return reply.status(400).send({
                success: false,
                error: {
                  code: 'invalid_value',
                  message: 'dispute_window_hours must be between 1 and 168',
                },
              });
            }
          }

          if (key === 'llm_model') {
            const validModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini'];
            if (!validModels.includes(value as string)) {
              return reply.status(400).send({
                success: false,
                error: {
                  code: 'invalid_value',
                  message: `llm_model must be one of: ${validModels.join(', ')}`,
                },
              });
            }
          }

          // Upsert config value
          await sql`
            INSERT INTO ai_config (key, value, updated_at, updated_by)
            VALUES (${key}, ${JSON.stringify(value)}, NOW(), ${actor})
            ON CONFLICT (key) DO UPDATE
            SET value = ${JSON.stringify(value)}, updated_at = NOW(), updated_by = ${actor}
          `;

          updatedKeys.push(key);
        }

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
            'config_update',
            'ai_config',
            gen_random_uuid(),
            ${actor},
            ${JSON.stringify({ updated_keys: updatedKeys, values: updates })},
            NOW()
          )
        `;

        // Fetch updated config
        const configs = await sql`
          SELECT key, value, updated_at, updated_by
          FROM ai_config
          WHERE key = ANY(${updatedKeys})
        `;

        const configObject: Record<string, unknown> = {};
        for (const config of configs) {
          configObject[config.key] = config.value;
        }

        return reply.send({
          success: true,
          data: {
            updated: updatedKeys,
            config: configObject,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to update AI config');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to update AI configuration',
          },
        });
      }
    }
  );
}
