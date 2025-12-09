import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb, isDatabaseConfigured } from './client.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  if (!isDatabaseConfigured()) {
    logger.warn('DATABASE_URL not configured, skipping migrations');
    return;
  }

  const sql = getDb();

  // Create migrations tracking table
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Get list of executed migrations
  const executed = await sql<{ name: string }[]>`
    SELECT name FROM _migrations ORDER BY id
  `;
  const executedNames = new Set(executed.map((m) => m.name));

  // Get migration files
  const migrationsDir = join(__dirname, 'migrations');
  let migrationFiles: string[];

  try {
    migrationFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch {
    logger.warn('No migrations directory found, skipping migrations');
    return;
  }

  // Run pending migrations
  for (const file of migrationFiles) {
    if (executedNames.has(file)) {
      logger.debug({ migration: file }, 'Migration already executed');
      continue;
    }

    logger.info({ migration: file }, 'Running migration');

    const filePath = join(migrationsDir, file);
    const sqlContent = readFileSync(filePath, 'utf-8');

    try {
      // Run migration in a transaction
      await sql.begin(async (tx) => {
        // Execute migration SQL
        await tx.unsafe(sqlContent);

        // Record migration
        await tx`
          INSERT INTO _migrations (name) VALUES (${file})
        `;
      });

      logger.info({ migration: file }, 'Migration completed successfully');
    } catch (error) {
      logger.error({ migration: file, error }, 'Migration failed');
      throw error;
    }
  }

  logger.info('All migrations completed');
}

/**
 * Get migration status
 */
export async function getMigrationStatus(): Promise<{
  executed: string[];
  pending: string[];
}> {
  if (!isDatabaseConfigured()) {
    return { executed: [], pending: [] };
  }

  const sql = getDb();

  // Check if migrations table exists
  const tableExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = '_migrations'
    ) as exists
  `;

  if (!tableExists[0]?.exists) {
    return { executed: [], pending: [] };
  }

  const executed = await sql<{ name: string }[]>`
    SELECT name FROM _migrations ORDER BY id
  `;
  const executedNames = executed.map((m) => m.name);

  const migrationsDir = join(__dirname, 'migrations');
  let allMigrations: string[];

  try {
    allMigrations = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch {
    allMigrations = [];
  }

  const pending = allMigrations.filter((m) => !executedNames.includes(m));

  return { executed: executedNames, pending };
}
