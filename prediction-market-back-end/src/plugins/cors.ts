import cors from '@fastify/cors';
import { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';

/**
 * Parse CORS origin from config
 * Supports comma-separated list for multiple origins
 */
function parseOrigin(originConfig: string): string | string[] {
  const origins = originConfig.split(',').map((o) => o.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

export async function registerCors(app: FastifyInstance) {
  // In development, allow all origins for easier testing
  // In production, use the configured origin(s)
  const origin = config.isDev ? true : parseOrigin(config.cors.origin);

  await app.register(cors, {
    origin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Payment', 'X-Payment-Response', 'X-Request-Id'],
    exposedHeaders: ['X-Payment-Response', 'Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    credentials: true,
  });
}
