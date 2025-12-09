/**
 * Worker Authentication Routes
 *
 * Exchange API key for short-lived JWT token
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../../db/index.js';
import { createHash, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from '../../../utils/logger.js';

const JWT_SECRET = process.env.INTERNAL_JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_EXPIRY = '15m';

const authSchema = z.object({
  api_key: z.string().min(32),
  worker_type: z.string().min(1),
});

/**
 * Hash API key for comparison
 */
function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

export async function workerAuthRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/worker/auth/token
   * Exchange API key for short-lived JWT
   */
  app.post(
    '/token',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers['x-request-id'] as string) || randomUUID();

      try {
        // Validate request
        const parseResult = authSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'invalid_request',
              message: parseResult.error.issues[0].message,
            },
          });
        }

        const { api_key, worker_type } = parseResult.data;
        const sql = getDb();

        // Hash the API key for comparison
        const apiKeyHash = hashApiKey(api_key);

        // Look up the API key
        const [workerKey] = await sql`
          SELECT id, worker_type, permissions, active, expires_at
          FROM worker_api_keys
          WHERE api_key_hash = ${apiKeyHash}
        `;

        if (!workerKey) {
          logger.warn({ requestId, worker_type }, 'Invalid worker API key');
          return reply.status(401).send({
            success: false,
            error: {
              code: 'invalid_credentials',
              message: 'Invalid API key',
            },
          });
        }

        // Verify the key is active
        if (!workerKey.active) {
          logger.warn({ requestId, worker_type, keyId: workerKey.id }, 'Inactive worker API key');
          return reply.status(401).send({
            success: false,
            error: {
              code: 'invalid_credentials',
              message: 'API key is inactive',
            },
          });
        }

        // Verify expiration
        if (workerKey.expires_at && new Date(workerKey.expires_at) < new Date()) {
          logger.warn({ requestId, worker_type, keyId: workerKey.id }, 'Expired worker API key');
          return reply.status(401).send({
            success: false,
            error: {
              code: 'invalid_credentials',
              message: 'API key has expired',
            },
          });
        }

        // Verify worker type matches
        if (workerKey.worker_type !== worker_type) {
          logger.warn(
            { requestId, expected: workerKey.worker_type, actual: worker_type },
            'Worker type mismatch'
          );
          return reply.status(401).send({
            success: false,
            error: {
              code: 'invalid_credentials',
              message: 'Worker type mismatch',
            },
          });
        }

        // Update last used timestamp
        await sql`
          UPDATE worker_api_keys
          SET last_used_at = NOW()
          WHERE id = ${workerKey.id}
        `;

        // Generate JWT
        const token = jwt.sign(
          {
            type: 'worker',
            worker_type: workerKey.worker_type,
            permissions: workerKey.permissions,
            key_id: workerKey.id,
          },
          JWT_SECRET,
          { expiresIn: TOKEN_EXPIRY }
        );

        logger.info({ requestId, worker_type, keyId: workerKey.id }, 'Worker token issued');

        return reply.send({
          success: true,
          data: {
            token,
            expires_in: 900, // 15 minutes in seconds
            token_type: 'Bearer',
          },
        });
      } catch (error) {
        logger.error({ error, requestId }, 'Failed to authenticate worker');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'Failed to authenticate',
          },
        });
      }
    }
  );
}

/**
 * Verify worker JWT token
 * Returns decoded token payload or null if invalid
 */
export function verifyWorkerToken(token: string): {
  type: string;
  worker_type: string;
  permissions: string[];
  key_id: string;
} | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      type: string;
      worker_type: string;
      permissions: string[];
      key_id: string;
    };

    if (decoded.type !== 'worker') {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Worker authentication middleware
 */
export async function workerAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'unauthorized',
        message: 'Missing or invalid authorization header',
      },
    });
  }

  const token = authHeader.substring(7);
  const decoded = verifyWorkerToken(token);

  if (!decoded) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'unauthorized',
        message: 'Invalid or expired token',
      },
    });
  }

  // Attach worker info to request
  (request as any).worker = decoded;
}
