/**
 * Worker Authentication Middleware
 *
 * Validates worker JWT tokens and checks worker permissions
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/index.js';
import { config } from '../config/index.js';

const JWT_SECRET = config.auth.jwtSecret;

export type WorkerType =
  | 'crawler'
  | 'extractor'
  | 'generator'
  | 'validator'
  | 'publisher'
  | 'resolver'
  | 'dispute_agent'
  | 'scheduler';

export interface WorkerTokenPayload {
  worker_type: WorkerType;
  permissions: string[];
  iat: number;
  exp: number;
}

export interface WorkerUser {
  worker_type: WorkerType;
  permissions: string[];
}

/**
 * Verify worker JWT token
 */
function verifyWorkerToken(token: string): WorkerTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as WorkerTokenPayload;
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

  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({
      success: false,
      error: {
        code: 'unauthorized',
        message: 'Worker authentication required',
      },
    });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyWorkerToken(token);

  if (!payload) {
    reply.status(401).send({
      success: false,
      error: {
        code: 'token_expired',
        message: 'Invalid or expired worker token',
      },
    });
    return;
  }

  // Attach worker info to request
  (request as any).worker = {
    worker_type: payload.worker_type,
    permissions: payload.permissions,
  } as WorkerUser;
}

/**
 * Create middleware that requires specific worker type
 */
export function requireWorkerType(...allowedTypes: WorkerType[]) {
  return async function workerTypeMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    await workerAuthMiddleware(request, reply);

    if (reply.sent) return;

    const worker = (request as any).worker as WorkerUser;

    if (!allowedTypes.includes(worker.worker_type)) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'forbidden',
          message: `Worker type '${worker.worker_type}' not allowed for this endpoint`,
          details: {
            allowed_types: allowedTypes,
          },
        },
      });
      return;
    }
  };
}

/**
 * Create middleware that requires specific permission
 */
export function requireWorkerPermission(permission: string) {
  return async function permissionMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    await workerAuthMiddleware(request, reply);

    if (reply.sent) return;

    const worker = (request as any).worker as WorkerUser;

    if (!worker.permissions.includes(permission)) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'forbidden',
          message: `Permission '${permission}' required`,
        },
      });
      return;
    }
  };
}

/**
 * Update last_used_at for worker API key
 */
export async function updateWorkerKeyUsage(apiKeyHash: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE worker_api_keys SET last_used_at = NOW() WHERE api_key_hash = ${apiKeyHash}`;
}
