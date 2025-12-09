#!/usr/bin/env node
/**
 * Backend API Test Script
 *
 * Tests the backend API endpoints:
 * 1. Health check
 * 2. Config endpoints
 * 3. Markets endpoints
 * 4. Proposal endpoints (v1)
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(name) {
  log(`\n━━━ ${name} ━━━`, 'cyan');
}

function logSuccess(message) {
  log(`  ✓ ${message}`, 'green');
}

function logError(message) {
  log(`  ✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`  ℹ ${message}`, 'yellow');
}

class TestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
  }

  async test(name, fn) {
    try {
      await fn();
      logSuccess(name);
      this.passed++;
    } catch (error) {
      logError(`${name}: ${error.message}`);
      this.failed++;
    }
  }

  skip(name, reason) {
    logInfo(`${name} (SKIPPED: ${reason})`);
    this.skipped++;
  }

  summary() {
    log('\n========================================', 'blue');
    log('   Test Summary', 'blue');
    log('========================================', 'blue');
    log(`  Passed:  ${this.passed}`, 'green');
    log(`  Failed:  ${this.failed}`, this.failed > 0 ? 'red' : 'green');
    log(`  Skipped: ${this.skipped}`, 'yellow');
    log('========================================\n', 'blue');
    return this.failed === 0;
  }
}

async function assertResponse(url, options = {}) {
  const { method = 'GET', body, expectedStatus = 200, headers = {} } = options;

  const fetchOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (response.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
  }

  if (response.headers.get('content-type')?.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

async function runTests() {
  log('\n========================================', 'blue');
  log('   Backend API Test Suite', 'blue');
  log('========================================', 'blue');

  const runner = new TestRunner();

  // Health Check
  logSection('Health Check');

  await runner.test('GET /health returns ok', async () => {
    const data = await assertResponse(`${BACKEND_URL}/health`);
    if (data.status !== 'ok') throw new Error('Expected status: ok');
  });

  // Config Tests
  logSection('Config Endpoints');

  await runner.test('GET /api/config/contracts returns contract config', async () => {
    const data = await assertResponse(`${BACKEND_URL}/api/config/contracts`);
    if (!data.success) throw new Error('Expected success: true');
    if (!data.data?.contracts) throw new Error('Missing contracts array');
  });

  // Note: /api/config/x402 route does not exist in current backend
  runner.skip('GET /api/config/x402', 'Route not implemented');

  // Markets Tests (non-v1)
  logSection('Markets Endpoints');

  await runner.test('GET /api/markets returns market list', async () => {
    const data = await assertResponse(`${BACKEND_URL}/api/markets`);
    if (!data.success) throw new Error('Expected success: true');
    if (!Array.isArray(data.data?.markets)) throw new Error('Expected data.markets array');
  });

  await runner.test('GET /api/markets with pagination', async () => {
    const data = await assertResponse(`${BACKEND_URL}/api/markets?limit=5&offset=0`);
    if (!data.success) throw new Error('Expected success: true');
  });

  await runner.test('GET /api/markets/:id with invalid ID returns 404', async () => {
    await assertResponse(`${BACKEND_URL}/api/markets/invalid-market-id`, {
      expectedStatus: 404,
    });
  });

  // Proposal Tests (v1)
  logSection('Proposal Endpoints (v1)');

  let testProposalId = null;
  await runner.test('POST /api/v1/propose with valid data', async () => {
    const data = await assertResponse(`${BACKEND_URL}/api/v1/propose`, {
      method: 'POST',
      body: {
        proposal_text: `Test proposal ${Date.now()}`,
        category_hint: 'technology',
      },
    });
    if (!data.success) throw new Error('Expected success: true');
    if (!data.data?.proposal_id) throw new Error('Expected proposal_id');
    testProposalId = data.data.proposal_id;
  });

  await runner.test('GET /api/v1/propose/:id returns proposal', async () => {
    if (!testProposalId) throw new Error('No test proposal ID available');
    const data = await assertResponse(`${BACKEND_URL}/api/v1/propose/${testProposalId}`);
    if (!data.success) throw new Error('Expected success: true');
  });

  await runner.test('POST /api/v1/propose with empty body returns 400', async () => {
    await assertResponse(`${BACKEND_URL}/api/v1/propose`, {
      method: 'POST',
      body: {},
      expectedStatus: 400,
    });
  });

  await runner.test('POST /api/v1/propose with missing proposal_text returns 400', async () => {
    await assertResponse(`${BACKEND_URL}/api/v1/propose`, {
      method: 'POST',
      body: { category_hint: 'technology' },
      expectedStatus: 400,
    });
  });

  await runner.test('GET /api/v1/propose/:id with invalid UUID returns 400/404', async () => {
    const response = await fetch(`${BACKEND_URL}/api/v1/propose/not-a-uuid`);
    if (response.status !== 400 && response.status !== 404) {
      throw new Error(`Expected 400 or 404, got ${response.status}`);
    }
  });

  // Trading Tests
  logSection('Trading Endpoints');

  runner.skip('POST /api/trading/quote', 'Requires valid market address');
  runner.skip('POST /api/trading/buy', 'Requires valid market and wallet');
  runner.skip('POST /api/trading/sell', 'Requires valid market and wallet');

  // Liquidity Tests
  logSection('Liquidity Endpoints');

  runner.skip('POST /api/liquidity/add', 'Requires valid market and wallet');
  runner.skip('POST /api/liquidity/remove', 'Requires valid market and wallet');

  // Metadata Tests
  logSection('Metadata Endpoints');

  // Note: /api/metadata/categories requires a UUID parameter
  runner.skip('GET /api/metadata/categories', 'Requires market ID parameter');

  // Error Handling Tests
  logSection('Error Handling');

  await runner.test('GET /api/nonexistent returns 404', async () => {
    await assertResponse(`${BACKEND_URL}/api/nonexistent`, {
      expectedStatus: 404,
    });
  });

  // Summary
  const success = runner.summary();
  process.exit(success ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
