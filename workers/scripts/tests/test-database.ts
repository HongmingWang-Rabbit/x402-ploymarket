/**
 * Database Tests
 *
 * Tests database connectivity and schema:
 * - Connection test
 * - Table existence
 * - Basic CRUD operations
 * - Schema integrity
 */

import postgres from 'postgres';
import path from 'path';
import { config } from 'dotenv';

// Load env from workers directory
config({ path: path.resolve(import.meta.dirname, '../../.env') });

interface TestResult {
  passed: boolean;
  error?: string;
}

const DATABASE_URL = process.env.DATABASE_URL;

// Expected tables in the schema
const EXPECTED_TABLES = [
  'proposals',
  'ai_markets',
  'news_items',
  'candidates',
  'disputes',
  'audit_logs',
  'ai_config',
  'rss_sources',
];

export async function testDatabase(): Promise<TestResult> {
  if (!DATABASE_URL) {
    console.log('  ⚠️  DATABASE_URL not set, skipping database tests');
    return { passed: true };
  }

  let sql: ReturnType<typeof postgres> | null = null;
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // Test 1: Connection
    console.log('  Testing database connection...');
    sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 10 });

    try {
      const result = await sql`SELECT 1 as test`;
      if (result[0]?.test === 1) {
        console.log('    ✅ Database connection successful');
        passed++;
      } else {
        throw new Error('Unexpected result');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ❌ Database connection failed: ${msg}`);
      errors.push(`Connection: ${msg}`);
      failed++;
      return { passed: false, error: errors.join('; ') };
    }

    // Test 2: Table existence
    console.log('\n  Testing table existence...');
    for (const table of EXPECTED_TABLES) {
      try {
        const result = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = ${table}
          ) as exists
        `;
        if (result[0]?.exists) {
          console.log(`    ✅ Table '${table}' exists`);
          passed++;
        } else {
          console.log(`    ❌ Table '${table}' does not exist`);
          errors.push(`Table '${table}' missing`);
          failed++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`    ❌ Error checking table '${table}': ${msg}`);
        errors.push(`Table check '${table}': ${msg}`);
        failed++;
      }
    }

    // Test 3: proposals table schema
    console.log('\n  Testing proposals table schema...');
    try {
      const columns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'proposals'
        ORDER BY ordinal_position
      `;
      const columnNames = columns.map((c) => c.column_name);
      const requiredColumns = ['id', 'proposal_text', 'status', 'created_at'];

      for (const col of requiredColumns) {
        if (columnNames.includes(col)) {
          console.log(`    ✅ proposals.${col} exists`);
          passed++;
        } else {
          console.log(`    ❌ proposals.${col} missing`);
          errors.push(`proposals.${col} missing`);
          failed++;
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ❌ Schema check error: ${msg}`);
      errors.push(`proposals schema: ${msg}`);
      failed++;
    }

    // Test 4: ai_markets table schema
    console.log('\n  Testing ai_markets table schema...');
    try {
      const columns = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'ai_markets'
      `;
      const columnNames = columns.map((c) => c.column_name);
      const requiredColumns = ['id', 'title', 'description', 'status', 'category'];

      for (const col of requiredColumns) {
        if (columnNames.includes(col)) {
          console.log(`    ✅ ai_markets.${col} exists`);
          passed++;
        } else {
          console.log(`    ❌ ai_markets.${col} missing`);
          errors.push(`ai_markets.${col} missing`);
          failed++;
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ❌ Schema check error: ${msg}`);
      errors.push(`ai_markets schema: ${msg}`);
      failed++;
    }

    // Test 5: ai_config table
    console.log('\n  Testing ai_config table...');
    try {
      const result = await sql`
        SELECT key, value FROM ai_config LIMIT 5
      `;
      console.log(`    ✅ ai_config readable (${result.length} rows)`);
      passed++;

      // Check for required config keys
      const keys = result.map((r) => r.key);
      if (keys.includes('ai_version')) {
        console.log('    ✅ ai_config has ai_version');
        passed++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ❌ ai_config check error: ${msg}`);
      errors.push(`ai_config: ${msg}`);
      failed++;
    }

    // Test 6: Count records
    console.log('\n  Testing record counts...');
    const tables = ['proposals', 'ai_markets', 'disputes', 'audit_logs'];
    for (const table of tables) {
      try {
        const result = await sql`
          SELECT COUNT(*)::int as count FROM ${sql(table)}
        `;
        console.log(`    ✅ ${table}: ${result[0]?.count || 0} records`);
        passed++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`    ❌ Count ${table}: ${msg}`);
        errors.push(`Count ${table}: ${msg}`);
        failed++;
      }
    }

    // Test 7: Test INSERT/SELECT/DELETE (proposals)
    console.log('\n  Testing CRUD operations...');
    const testId = `test-${Date.now()}`;
    try {
      // Insert
      await sql`
        INSERT INTO proposals (id, proposal_text, status, created_at)
        VALUES (${testId}, 'Database test proposal', 'pending', NOW())
      `;
      console.log('    ✅ INSERT into proposals');
      passed++;

      // Select
      const selected = await sql`
        SELECT * FROM proposals WHERE id = ${testId}
      `;
      if (selected.length === 1) {
        console.log('    ✅ SELECT from proposals');
        passed++;
      } else {
        throw new Error('SELECT returned unexpected results');
      }

      // Delete
      await sql`DELETE FROM proposals WHERE id = ${testId}`;
      console.log('    ✅ DELETE from proposals');
      passed++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ❌ CRUD test failed: ${msg}`);
      errors.push(`CRUD: ${msg}`);
      failed++;

      // Cleanup on error
      try {
        await sql`DELETE FROM proposals WHERE id = ${testId}`;
      } catch {
        // Ignore cleanup errors
      }
    }

    // Test 8: Index existence
    console.log('\n  Testing indexes...');
    try {
      const indexes = await sql`
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename IN ('proposals', 'ai_markets', 'disputes')
      `;
      console.log(`    ✅ Found ${indexes.length} indexes on main tables`);
      passed++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ❌ Index check failed: ${msg}`);
      errors.push(`Indexes: ${msg}`);
      failed++;
    }

    console.log(`\n  Results: ${passed} passed, ${failed} failed`);

    return {
      passed: failed === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { passed: false, error: msg };
  } finally {
    if (sql) {
      await sql.end();
    }
  }
}
