/**
 * Health Check Routes
 *
 * Provides liveness and readiness endpoints for the backend service
 */

import { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  latency_ms?: number;
  error?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  checks?: {
    database: HealthCheck;
    rabbitmq?: HealthCheck;
    solana_rpc?: HealthCheck;
  };
}

const VERSION = process.env.npm_package_version || '1.0.0';
const RABBITMQ_URL = process.env.RABBITMQ_URL;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const sql = getDb();
    await sql`SELECT 1`;
    return {
      status: 'healthy',
      latency_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check RabbitMQ connectivity (if configured)
 */
async function checkRabbitMQ(): Promise<HealthCheck | null> {
  if (!RABBITMQ_URL) return null;

  const start = Date.now();
  try {
    // Simple TCP check - full amqp check would require connection
    const url = new URL(RABBITMQ_URL);
    const net = await import('net');

    return new Promise((resolve) => {
      const socket = net.createConnection(
        {
          host: url.hostname,
          port: parseInt(url.port) || 5672,
          timeout: 5000,
        },
        () => {
          socket.end();
          resolve({
            status: 'healthy',
            latency_ms: Date.now() - start,
          });
        }
      );

      socket.on('error', (error) => {
        resolve({
          status: 'unhealthy',
          latency_ms: Date.now() - start,
          error: error.message,
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          status: 'unhealthy',
          latency_ms: Date.now() - start,
          error: 'Connection timeout',
        });
      });
    });
  } catch (error) {
    return {
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Solana RPC connectivity (if configured)
 */
async function checkSolanaRPC(): Promise<HealthCheck | null> {
  if (!SOLANA_RPC_URL) return null;

  const start = Date.now();
  try {
    const response = await fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return {
        status: 'healthy',
        latency_ms: Date.now() - start,
      };
    }

    return {
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function healthRoutes(app: FastifyInstance) {
  /**
   * Liveness probe - simple check that service is running
   */
  app.get('/health', {
    schema: {
      description: 'Liveness health check endpoint',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            version: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            version: { type: 'string' },
            timestamp: { type: 'string' },
            checks: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const [database, rabbitmq, solana] = await Promise.all([
      checkDatabase(),
      checkRabbitMQ(),
      checkSolanaRPC(),
    ]);

    const checks: HealthResponse['checks'] = {
      database,
    };

    if (rabbitmq) checks.rabbitmq = rabbitmq;
    if (solana) checks.solana_rpc = solana;

    // Determine overall status
    const allHealthy = database.status === 'healthy' &&
      (!rabbitmq || rabbitmq.status === 'healthy') &&
      (!solana || solana.status === 'healthy');

    const anyUnhealthy = database.status === 'unhealthy';

    let status: HealthResponse['status'];
    if (anyUnhealthy) {
      status = 'unhealthy';
    } else if (!allHealthy) {
      status = 'degraded';
    } else {
      status = 'ok';
    }

    const response: HealthResponse = {
      status,
      version: VERSION,
      timestamp: new Date().toISOString(),
      checks,
    };

    if (status === 'unhealthy') {
      reply.status(503);
    }

    return response;
  });

  /**
   * Readiness probe - checks if service is ready to accept traffic
   */
  app.get('/ready', {
    schema: {
      description: 'Readiness check endpoint',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
            timestamp: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
            timestamp: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Check database is reachable
    const database = await checkDatabase();

    if (database.status !== 'healthy') {
      reply.status(503).send({
        ready: false,
        timestamp: new Date().toISOString(),
        reason: 'Database unavailable',
      });
      return;
    }

    return {
      ready: true,
      timestamp: new Date().toISOString(),
    };
  });
}
