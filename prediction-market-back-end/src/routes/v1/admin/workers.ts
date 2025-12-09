/**
 * Admin Worker Routes
 *
 * Get worker status and enable/disable workers
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../../../db/index.js';

interface WorkerConfig {
  id: string;
  worker_type: string;
  display_name: string;
  description: string | null;
  enabled: boolean;
  poll_interval_ms: number | null;
  cron_expression: string | null;
  input_queue: string | null;
  output_queue: string | null;
  created_at: Date;
  updated_at: Date;
}

interface WorkerHeartbeat {
  id: string;
  worker_type: string;
  worker_instance_id: string;
  status: 'starting' | 'running' | 'idle' | 'error' | 'stopped';
  last_heartbeat: Date;
  messages_processed: number;
  messages_failed: number;
  current_queue_size: number | null;
  last_error: string | null;
  last_error_at: Date | null;
  consecutive_errors: number;
  hostname: string | null;
  pid: number | null;
  started_at: Date;
}

interface WorkerStatus extends WorkerConfig {
  heartbeats: WorkerHeartbeat[];
  is_healthy: boolean;
  active_instances: number;
}

interface UpdateWorkerBody {
  enabled: boolean;
}

export async function adminWorkerRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/admin/workers
   * Get all worker configurations with their status
   */
  app.get(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sql = getDb();

        // Get all worker configs
        const configs = await sql<WorkerConfig[]>`
          SELECT *
          FROM worker_config
          ORDER BY
            CASE worker_type
              WHEN 'crawler' THEN 1
              WHEN 'extractor' THEN 2
              WHEN 'generator' THEN 3
              WHEN 'validator' THEN 4
              WHEN 'publisher' THEN 5
              WHEN 'scheduler' THEN 6
              WHEN 'resolver' THEN 7
              WHEN 'dispute-agent' THEN 8
              ELSE 9
            END
        `;

        // Get recent heartbeats (within last 5 minutes)
        const heartbeats = await sql<WorkerHeartbeat[]>`
          SELECT *
          FROM worker_heartbeats
          WHERE last_heartbeat > NOW() - INTERVAL '5 minutes'
          ORDER BY worker_type, last_heartbeat DESC
        `;

        // Group heartbeats by worker type
        const heartbeatsByType = heartbeats.reduce((acc, hb) => {
          if (!acc[hb.worker_type]) {
            acc[hb.worker_type] = [];
          }
          acc[hb.worker_type].push(hb);
          return acc;
        }, {} as Record<string, WorkerHeartbeat[]>);

        // Build worker status response
        const workers: WorkerStatus[] = configs.map((config) => {
          const workerHeartbeats = heartbeatsByType[config.worker_type] || [];
          const activeInstances = workerHeartbeats.filter(
            (hb) => hb.status === 'running' || hb.status === 'idle'
          ).length;

          // Worker is healthy if it's disabled (intentionally off) or has active instances
          const isHealthy = !config.enabled || activeInstances > 0;

          return {
            ...config,
            heartbeats: workerHeartbeats,
            is_healthy: isHealthy,
            active_instances: activeInstances,
          };
        });

        return reply.send({
          success: true,
          data: {
            workers,
            summary: {
              total: workers.length,
              enabled: workers.filter((w) => w.enabled).length,
              healthy: workers.filter((w) => w.is_healthy).length,
              unhealthy: workers.filter((w) => !w.is_healthy).length,
            },
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to get worker status');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to get worker status',
          },
        });
      }
    }
  );

  /**
   * GET /api/v1/admin/workers/:workerType
   * Get detailed status for a specific worker
   */
  app.get<{ Params: { workerType: string } }>(
    '/:workerType',
    async (request: FastifyRequest<{ Params: { workerType: string } }>, reply: FastifyReply) => {
      const { workerType } = request.params;

      try {
        const sql = getDb();

        // Get worker config
        const configs = await sql<WorkerConfig[]>`
          SELECT *
          FROM worker_config
          WHERE worker_type = ${workerType}
        `;

        if (configs.length === 0) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'not_found',
              message: `Worker type '${workerType}' not found`,
            },
          });
        }

        const config = configs[0];

        // Get all heartbeats for this worker (last 24 hours)
        const heartbeats = await sql<WorkerHeartbeat[]>`
          SELECT *
          FROM worker_heartbeats
          WHERE worker_type = ${workerType}
            AND last_heartbeat > NOW() - INTERVAL '24 hours'
          ORDER BY last_heartbeat DESC
        `;

        // Get recent heartbeats (last 5 minutes) for active status
        const recentHeartbeats = heartbeats.filter(
          (hb) => new Date(hb.last_heartbeat) > new Date(Date.now() - 5 * 60 * 1000)
        );

        const activeInstances = recentHeartbeats.filter(
          (hb) => hb.status === 'running' || hb.status === 'idle'
        ).length;

        const isHealthy = !config.enabled || activeInstances > 0;

        // Calculate metrics
        const totalProcessed = heartbeats.reduce((sum, hb) => sum + hb.messages_processed, 0);
        const totalFailed = heartbeats.reduce((sum, hb) => sum + hb.messages_failed, 0);

        return reply.send({
          success: true,
          data: {
            ...config,
            heartbeats: recentHeartbeats,
            is_healthy: isHealthy,
            active_instances: activeInstances,
            metrics: {
              total_processed_24h: totalProcessed,
              total_failed_24h: totalFailed,
              success_rate: totalProcessed > 0
                ? ((totalProcessed - totalFailed) / totalProcessed * 100).toFixed(2) + '%'
                : 'N/A',
            },
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to get worker details');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to get worker details',
          },
        });
      }
    }
  );

  /**
   * PATCH /api/v1/admin/workers/:workerType
   * Enable or disable a worker
   */
  app.patch<{ Params: { workerType: string }; Body: UpdateWorkerBody }>(
    '/:workerType',
    async (
      request: FastifyRequest<{ Params: { workerType: string }; Body: UpdateWorkerBody }>,
      reply: FastifyReply
    ) => {
      const { workerType } = request.params;
      const { enabled } = request.body;

      if (typeof enabled !== 'boolean') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'invalid_request',
            message: 'enabled field must be a boolean',
          },
        });
      }

      try {
        const sql = getDb();

        // Check if worker exists
        const existing = await sql`
          SELECT id FROM worker_config WHERE worker_type = ${workerType}
        `;

        if (existing.length === 0) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'not_found',
              message: `Worker type '${workerType}' not found`,
            },
          });
        }

        // Update enabled status
        const updated = await sql<WorkerConfig[]>`
          UPDATE worker_config
          SET enabled = ${enabled}
          WHERE worker_type = ${workerType}
          RETURNING *
        `;

        // Create audit log
        const actor = 'admin'; // TODO: Get from auth context
        await sql`
          INSERT INTO audit_logs (
            action,
            entity_type,
            entity_id,
            actor,
            details,
            created_at
          ) VALUES (
            ${enabled ? 'worker_enabled' : 'worker_disabled'},
            'worker_config',
            ${updated[0].id},
            ${actor},
            ${JSON.stringify({ worker_type: workerType, enabled })},
            NOW()
          )
        `;

        return reply.send({
          success: true,
          data: {
            ...updated[0],
            message: `Worker '${workerType}' ${enabled ? 'enabled' : 'disabled'}`,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to update worker');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to update worker',
          },
        });
      }
    }
  );

  /**
   * POST /api/v1/admin/workers/:workerType/heartbeat
   * Record a worker heartbeat (called by workers)
   */
  app.post<{
    Params: { workerType: string };
    Body: {
      instance_id: string;
      status: 'starting' | 'running' | 'idle' | 'error' | 'stopped';
      messages_processed?: number;
      messages_failed?: number;
      current_queue_size?: number;
      last_error?: string;
      hostname?: string;
      pid?: number;
    };
  }>(
    '/:workerType/heartbeat',
    async (request, reply: FastifyReply) => {
      const { workerType } = request.params;
      const {
        instance_id,
        status,
        messages_processed = 0,
        messages_failed = 0,
        current_queue_size,
        last_error,
        hostname,
        pid,
      } = request.body;

      if (!instance_id || !status) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'invalid_request',
            message: 'instance_id and status are required',
          },
        });
      }

      try {
        const sql = getDb();

        // Upsert heartbeat
        await sql`
          INSERT INTO worker_heartbeats (
            worker_type,
            worker_instance_id,
            status,
            last_heartbeat,
            messages_processed,
            messages_failed,
            current_queue_size,
            last_error,
            last_error_at,
            consecutive_errors,
            hostname,
            pid
          ) VALUES (
            ${workerType},
            ${instance_id},
            ${status},
            NOW(),
            ${messages_processed},
            ${messages_failed},
            ${current_queue_size ?? null},
            ${last_error ?? null},
            ${last_error ? sql`NOW()` : sql`NULL`},
            ${status === 'error' ? sql`consecutive_errors + 1` : 0},
            ${hostname ?? null},
            ${pid ?? null}
          )
          ON CONFLICT (worker_type, worker_instance_id) DO UPDATE
          SET
            status = ${status},
            last_heartbeat = NOW(),
            messages_processed = worker_heartbeats.messages_processed + ${messages_processed},
            messages_failed = worker_heartbeats.messages_failed + ${messages_failed},
            current_queue_size = ${current_queue_size ?? null},
            last_error = COALESCE(${last_error ?? null}, worker_heartbeats.last_error),
            last_error_at = CASE WHEN ${last_error ?? null} IS NOT NULL THEN NOW() ELSE worker_heartbeats.last_error_at END,
            consecutive_errors = CASE WHEN ${status} = 'error' THEN worker_heartbeats.consecutive_errors + 1 ELSE 0 END,
            hostname = COALESCE(${hostname ?? null}, worker_heartbeats.hostname),
            pid = COALESCE(${pid ?? null}, worker_heartbeats.pid)
        `;

        // Check if worker is enabled
        const config = await sql<WorkerConfig[]>`
          SELECT enabled FROM worker_config WHERE worker_type = ${workerType}
        `;

        return reply.send({
          success: true,
          data: {
            enabled: config.length > 0 ? config[0].enabled : true,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to record heartbeat');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to record heartbeat',
          },
        });
      }
    }
  );
}
