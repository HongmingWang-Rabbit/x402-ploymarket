import { getDb, isDatabaseConfigured } from './client.js';
import { runMigrations } from './migrate.js';
import { logger } from '../utils/logger.js';

export async function initDatabase() {
  if (!isDatabaseConfigured()) {
    logger.warn('DATABASE_URL not configured, skipping database initialization');
    return;
  }

  const sql = getDb();

  try {
    // Test connection
    await sql`SELECT 1`;
    logger.info('Database connection established');

    // Run migrations
    await runMigrations();

    // Legacy: Create market_metadata table if not exists (for backwards compatibility)
    await sql`
      CREATE TABLE IF NOT EXISTS market_metadata (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chain_id TEXT NOT NULL DEFAULT 'solana-devnet',
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        description TEXT,
        category TEXT,
        resolution_source TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Add chain_id column if it doesn't exist (for existing tables)
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'market_metadata' AND column_name = 'chain_id'
        ) THEN
          ALTER TABLE market_metadata ADD COLUMN chain_id TEXT NOT NULL DEFAULT 'solana-devnet';
        END IF;
      END $$;
    `;

    // Add market_address column if it doesn't exist
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'market_metadata' AND column_name = 'market_address'
        ) THEN
          ALTER TABLE market_metadata ADD COLUMN market_address TEXT;
          CREATE INDEX IF NOT EXISTS idx_market_metadata_market_address ON market_metadata(market_address);
        END IF;
      END $$;
    `;

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize database');
    throw error;
  }
}

export { runMigrations, getMigrationStatus } from './migrate.js';
