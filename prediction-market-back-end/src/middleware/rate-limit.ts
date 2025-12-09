/**
 * Rate Limiting Middleware
 *
 * Tracks requests per user/IP and enforces rate limits
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../db/index.js';

interface RateLimitConfig {
  perMinute?: number;
  perHour?: number;
  perDay?: number;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  propose: { perMinute: 5, perHour: 20, perDay: 50 },
  dispute: { perHour: 3, perDay: 10 },
  default: { perMinute: 60, perHour: 1000 },
};

/**
 * Get identifier for rate limiting (user address or IP)
 */
function getIdentifier(request: FastifyRequest): string {
  // Try to get user address from JWT or headers
  const userAddress = (request as any).user?.address;
  if (userAddress) return `user:${userAddress}`;

  // Fall back to IP address
  const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
  return `ip:${Array.isArray(ip) ? ip[0] : ip}`;
}

/**
 * Check and increment rate limit counter
 */
async function checkRateLimit(
  identifier: string,
  endpoint: string,
  windowType: 'minute' | 'hour' | 'day',
  limit: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = new Date();
  let windowStart: Date;

  switch (windowType) {
    case 'minute':
      windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
      break;
    case 'hour':
      windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      break;
    case 'day':
      windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
  }

  // Upsert rate limit record
  const sql = getDb();
  const result = await sql`
    INSERT INTO rate_limits (identifier, endpoint, window_start, window_type, count)
    VALUES (${identifier}, ${endpoint}, ${windowStart}, ${windowType}, 1)
    ON CONFLICT (identifier, endpoint, window_start, window_type)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `;

  const count = result[0].count;
  const remaining = Math.max(0, limit - count);

  // Calculate reset time
  const resetAt = new Date(windowStart);
  switch (windowType) {
    case 'minute':
      resetAt.setMinutes(resetAt.getMinutes() + 1);
      break;
    case 'hour':
      resetAt.setHours(resetAt.getHours() + 1);
      break;
    case 'day':
      resetAt.setDate(resetAt.getDate() + 1);
      break;
  }

  return {
    allowed: count <= limit,
    remaining,
    resetAt,
  };
}

/**
 * Create rate limit middleware for an endpoint
 */
export function createRateLimitMiddleware(endpointKey: string) {
  const limits = DEFAULT_LIMITS[endpointKey] || DEFAULT_LIMITS.default;

  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const identifier = getIdentifier(request);
    const checks: Array<{ type: string; limit: number; windowType: 'minute' | 'hour' | 'day' }> = [];

    if (limits.perMinute) {
      checks.push({ type: 'minute', limit: limits.perMinute, windowType: 'minute' });
    }
    if (limits.perHour) {
      checks.push({ type: 'hour', limit: limits.perHour, windowType: 'hour' });
    }
    if (limits.perDay) {
      checks.push({ type: 'day', limit: limits.perDay, windowType: 'day' });
    }

    for (const check of checks) {
      const result = await checkRateLimit(identifier, endpointKey, check.windowType, check.limit);

      // Set rate limit headers
      reply.header(`X-RateLimit-Limit-${check.type}`, check.limit.toString());
      reply.header(`X-RateLimit-Remaining-${check.type}`, result.remaining.toString());
      reply.header(`X-RateLimit-Reset-${check.type}`, result.resetAt.toISOString());

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
        reply.header('Retry-After', retryAfter.toString());

        reply.status(429).send({
          success: false,
          error: {
            code: 'rate_limit_exceeded',
            message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            details: {
              limit: check.limit,
              window: check.windowType,
              reset_at: result.resetAt.toISOString(),
            },
          },
        });
        return;
      }
    }
  };
}

/**
 * Clean up old rate limit records (run periodically)
 */
export async function cleanupRateLimits(): Promise<number> {
  const sql = getDb();
  const result = await sql`
    DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '2 days' RETURNING id
  `;
  return result.length;
}
