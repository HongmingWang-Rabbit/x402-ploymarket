import cors from '@fastify/cors';
import { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';

export async function registerCors(app: FastifyInstance) {
  // In development, allow all origins for easier testing
  // In production, use the configured origin
  const origin = config.isDev ? true : config.cors.origin;

  await app.register(cors, {
    origin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Payment', 'X-Payment-Response', 'X-Request-Id'],
    exposedHeaders: ['X-Payment-Response', 'Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    credentials: true,
  });
}
