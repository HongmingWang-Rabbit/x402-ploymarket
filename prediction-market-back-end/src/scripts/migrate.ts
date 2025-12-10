#!/usr/bin/env tsx
/**
 * Database migration script
 * Run with: pnpm migrate
 */

import 'dotenv/config';
import { runMigrations, getMigrationStatus } from '../db/index.js';
import { logger } from '../utils/logger.js';

async function main() {
  const command = process.argv[2] || 'run';

  try {
    if (command === 'status') {
      const status = await getMigrationStatus();
      console.log('\n=== Migration Status ===\n');
      console.log('Executed migrations:');
      if (status.executed.length === 0) {
        console.log('  (none)');
      } else {
        status.executed.forEach((m) => console.log(`  ✓ ${m}`));
      }
      console.log('\nPending migrations:');
      if (status.pending.length === 0) {
        console.log('  (none)');
      } else {
        status.pending.forEach((m) => console.log(`  ○ ${m}`));
      }
      console.log('');
    } else if (command === 'run') {
      console.log('\n=== Running Migrations ===\n');
      await runMigrations();
      console.log('\n=== Migrations Complete ===\n');
    } else {
      console.log('Usage: pnpm migrate [run|status]');
      console.log('  run    - Run pending migrations (default)');
      console.log('  status - Show migration status');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Migration failed');
    process.exit(1);
  }
}

main();
