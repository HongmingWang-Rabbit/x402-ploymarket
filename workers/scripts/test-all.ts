#!/usr/bin/env tsx
/**
 * Test All - Comprehensive Test Suite
 *
 * Modularized test runner that tests all system components
 *
 * Usage:
 *   pnpm test:all              # Run all tests
 *   pnpm test:backend          # Test backend API only
 *   pnpm test:workers          # Test workers only
 *   pnpm test:e2e              # Test end-to-end flow
 *   pnpm test:database         # Test database
 *   pnpm test:queue            # Test RabbitMQ
 *   pnpm test:ai               # Test AI/LLM
 *   pnpm test:integration      # Test full integration
 *   pnpm test:all --quick      # Skip slow tests (AI, workers)
 */

import { testBackend } from './tests/test-backend.js';
import { testWorkers } from './tests/test-workers.js';
import { testE2E } from './tests/test-e2e.js';
import { testDatabase } from './tests/test-database.js';
import { testQueue } from './tests/test-queue.js';
import { testAI } from './tests/test-ai.js';
import { testIntegration } from './tests/test-integration.js';

const args = process.argv.slice(2);
const testType = args[0] || 'all';
const isQuick = args.includes('--quick');

interface TestModule {
  name: string;
  fn: () => Promise<{ passed: boolean; error?: string }>;
  slow?: boolean;
}

const TEST_MODULES: Record<string, TestModule> = {
  backend: { name: 'Backend API', fn: testBackend },
  database: { name: 'Database', fn: testDatabase },
  queue: { name: 'RabbitMQ Queue', fn: testQueue },
  ai: { name: 'AI/LLM', fn: testAI, slow: true },
  workers: { name: 'Workers', fn: testWorkers, slow: true },
  e2e: { name: 'End-to-End', fn: testE2E, slow: true },
  integration: { name: 'Integration', fn: testIntegration },
};

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║        AI Prediction Market Test Suite               ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  const results: { name: string; passed: boolean; error?: string; skipped?: boolean }[] = [];

  // Determine which tests to run
  let testsToRun: string[] = [];

  if (testType === 'all') {
    testsToRun = Object.keys(TEST_MODULES);
  } else if (TEST_MODULES[testType]) {
    testsToRun = [testType];
  } else {
    console.log(`❌ Unknown test type: ${testType}`);
    console.log('');
    console.log('Available test types:');
    console.log('  all          - Run all tests');
    for (const [key, mod] of Object.entries(TEST_MODULES)) {
      console.log(`  ${key.padEnd(12)} - ${mod.name}${mod.slow ? ' (slow)' : ''}`);
    }
    console.log('');
    console.log('Options:');
    console.log('  --quick      - Skip slow tests');
    process.exit(1);
  }

  // Show test plan
  console.log('📋 Test Plan:');
  for (const key of testsToRun) {
    const mod = TEST_MODULES[key];
    const skip = isQuick && mod.slow;
    console.log(`   ${skip ? '⏭️ ' : '🔹'} ${mod.name}${skip ? ' (skipped - slow)' : ''}`);
  }
  console.log('');

  try {
    for (const key of testsToRun) {
      const mod = TEST_MODULES[key];

      // Skip slow tests in quick mode
      if (isQuick && mod.slow) {
        results.push({ name: mod.name, passed: true, skipped: true });
        continue;
      }

      console.log('━'.repeat(54));
      console.log(`📦 ${mod.name}`);
      console.log('━'.repeat(54));

      try {
        const result = await mod.fn();
        results.push({ name: mod.name, ...result });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`\n  ❌ Test module crashed: ${msg}`);
        results.push({ name: mod.name, passed: false, error: msg });
      }

      console.log('');
    }

    // Print summary
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║                    Test Summary                      ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');

    let allPassed = true;
    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const result of results) {
      if (result.skipped) {
        console.log(`  ⏭️  ${result.name}: SKIPPED`);
        skippedCount++;
      } else if (result.passed) {
        console.log(`  ✅ ${result.name}: PASSED`);
        passedCount++;
      } else {
        console.log(`  ❌ ${result.name}: FAILED`);
        if (result.error) {
          // Truncate long errors
          const errorMsg = result.error.length > 100
            ? result.error.substring(0, 100) + '...'
            : result.error;
          console.log(`     Error: ${errorMsg}`);
        }
        failedCount++;
        allPassed = false;
      }
    }

    console.log('');
    console.log('─'.repeat(54));
    console.log(`  Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount} | Skipped: ${skippedCount}`);
    console.log('─'.repeat(54));
    console.log('');

    if (allPassed) {
      console.log('🎉 All tests passed!\n');
      process.exit(0);
    } else {
      console.log('💥 Some tests failed!\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  }
}

main();
