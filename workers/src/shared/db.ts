import postgres from 'postgres';
import { env } from './env.js';
import { logger } from './logger.js';

let sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!sql) {
    sql = postgres(env.DATABASE_URL, {
      ssl: 'require',
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    logger.info('Database connection pool created');
  }

  return sql;
}

export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end();
    sql = null;
    logger.info('Database connection closed');
  }
}

// Re-export the Row type for type inference
export type { Row } from 'postgres';
