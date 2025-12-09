/**
 * Worker Tests
 *
 * Tests worker connectivity and basic functionality
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';

interface TestResult {
  passed: boolean;
  error?: string;
}

const WORKERS = [
  'generator',
  'validator',
  'publisher',
  'scheduler',
  'resolver',
  'dispute-agent',
  'crawler',
  'extractor',
];

const WORKER_DIR = path.resolve(import.meta.dirname, '../../');

async function testWorkerStartup(workerName: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('pnpm', [`dev:${workerName}`], {
      cwd: WORKER_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let output = '';
    let error = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        // Check if we saw successful connection logs
        if (
          output.includes('RabbitMQ connected') ||
          output.includes('worker started') ||
          output.includes('is running')
        ) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: error || 'Timeout without connection' });
        }
      }
    }, 15000);

    proc.stdout?.on('data', (data) => {
      output += data.toString();
      // Quick success check
      if (
        !resolved &&
        (output.includes('waiting for messages') ||
          output.includes('is running') ||
          output.includes('Consumer started'))
      ) {
        resolved = true;
        clearTimeout(timeout);
        proc.kill();
        resolve({ success: true });
      }
    });

    proc.stderr?.on('data', (data) => {
      error += data.toString();
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ success: false, error: err.message });
      }
    });

    proc.on('exit', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `Exit code ${code}` });
        }
      }
    });
  });
}

export async function testWorkers(): Promise<TestResult> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  console.log('  Testing worker startup (this may take a moment)...\n');

  for (const worker of WORKERS) {
    process.stdout.write(`  Testing ${worker}... `);
    const result = await testWorkerStartup(worker);

    if (result.success) {
      console.log('✅');
      passed++;
    } else {
      console.log(`❌ ${result.error || 'Failed'}`);
      errors.push(`${worker}: ${result.error}`);
      failed++;
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed`);

  return {
    passed: failed === 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}
