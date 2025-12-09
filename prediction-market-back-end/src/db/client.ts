import postgres from 'postgres';
import { env } from '../config/env.js';

// Create postgres client (lazy initialization)
let sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!sql) {
    sql = postgres(env.DATABASE_URL, {
      ssl: 'require',
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  return sql;
}

// Check if database is configured
export function isDatabaseConfigured(): boolean {
  return !!env.DATABASE_URL;
}
