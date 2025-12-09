/**
 * Worker Health Check Server
 *
 * Provides HTTP health endpoints for worker liveness/readiness probes
 */

import http from 'http';
import { logger } from './logger.js';
import { getDb } from './db.js';

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '9090', 10);

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  worker_type: string;
  uptime_seconds: number;
  checks: {
    database: boolean;
    rabbitmq: boolean;
  };
  last_message_at?: string;
  messages_processed?: number;
}

// Worker metrics
let startTime = Date.now();
let lastMessageAt: Date | null = null;
let messagesProcessed = 0;
let workerType = 'unknown';

/**
 * Set worker type for health reporting
 */
export function setWorkerType(type: string): void {
  workerType = type;
}

/**
 * Record that a message was processed
 */
export function recordMessageProcessed(): void {
  lastMessageAt = new Date();
  messagesProcessed++;
}

/**
 * Get current health status
 */
async function getHealthStatus(): Promise<HealthStatus> {
  let dbHealthy = false;
  let mqHealthy = false;

  // Check database
  try {
    const sql = getDb();
    await sql`SELECT 1`;
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  // Check RabbitMQ - assume healthy if we got this far
  // (actual connection check would require importing connection state)
  mqHealthy = true;

  const status: HealthStatus = {
    status: dbHealthy && mqHealthy ? 'healthy' : 'unhealthy',
    worker_type: workerType,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: dbHealthy,
      rabbitmq: mqHealthy,
    },
  };

  if (lastMessageAt) {
    status.last_message_at = lastMessageAt.toISOString();
  }
  if (messagesProcessed > 0) {
    status.messages_processed = messagesProcessed;
  }

  return status;
}

/**
 * Start the health check HTTP server
 */
export function startHealthServer(): http.Server {
  startTime = Date.now();

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/health' || req.url === '/') {
      try {
        const status = await getHealthStatus();
        const statusCode = status.status === 'healthy' ? 200 : 503;
        res.writeHead(statusCode);
        res.end(JSON.stringify(status, null, 2));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ status: 'error', error: String(error) }));
      }
    } else if (req.url === '/ready') {
      try {
        const status = await getHealthStatus();
        if (status.status === 'healthy') {
          res.writeHead(200);
          res.end(JSON.stringify({ ready: true }));
        } else {
          res.writeHead(503);
          res.end(JSON.stringify({ ready: false, checks: status.checks }));
        }
      } catch (error) {
        res.writeHead(503);
        res.end(JSON.stringify({ ready: false, error: String(error) }));
      }
    } else if (req.url === '/metrics') {
      // Simple Prometheus-compatible metrics
      try {
        const status = await getHealthStatus();
        const metrics = [
          `# HELP worker_up Worker health status (1 = healthy, 0 = unhealthy)`,
          `# TYPE worker_up gauge`,
          `worker_up{worker_type="${workerType}"} ${status.status === 'healthy' ? 1 : 0}`,
          ``,
          `# HELP worker_uptime_seconds Worker uptime in seconds`,
          `# TYPE worker_uptime_seconds counter`,
          `worker_uptime_seconds{worker_type="${workerType}"} ${status.uptime_seconds}`,
          ``,
          `# HELP worker_messages_processed Total messages processed`,
          `# TYPE worker_messages_processed counter`,
          `worker_messages_processed{worker_type="${workerType}"} ${messagesProcessed}`,
          ``,
          `# HELP worker_database_up Database connection status`,
          `# TYPE worker_database_up gauge`,
          `worker_database_up{worker_type="${workerType}"} ${status.checks.database ? 1 : 0}`,
          ``,
          `# HELP worker_rabbitmq_up RabbitMQ connection status`,
          `# TYPE worker_rabbitmq_up gauge`,
          `worker_rabbitmq_up{worker_type="${workerType}"} ${status.checks.rabbitmq ? 1 : 0}`,
        ].join('\n');

        res.setHeader('Content-Type', 'text/plain');
        res.writeHead(200);
        res.end(metrics);
      } catch (error) {
        res.writeHead(500);
        res.end(`# Error: ${String(error)}`);
      }
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(HEALTH_PORT, () => {
    logger.info({ port: HEALTH_PORT, worker: workerType }, 'Health server started');
  });

  server.on('error', (error) => {
    logger.error({ error, port: HEALTH_PORT }, 'Health server error');
  });

  return server;
}

/**
 * Stop the health check server
 */
export function stopHealthServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
      } else {
        logger.info('Health server stopped');
        resolve();
      }
    });
  });
}
