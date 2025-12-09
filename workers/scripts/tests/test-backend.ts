/**
 * Backend API Tests
 *
 * Comprehensive tests for all backend API endpoints:
 * - Health & Ready endpoints
 * - Config endpoints
 * - Markets endpoints (legacy and v1)
 * - Proposal endpoints (v1)
 * - Admin endpoints
 * - Worker endpoints
 * - Trading endpoints
 * - Liquidity endpoints
 * - Disputes endpoints
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

interface TestResult {
  passed: boolean;
  error?: string;
}

interface TestCase {
  name: string;
  fn: () => Promise<void>;
}

interface TestSection {
  name: string;
  tests: TestCase[];
}

async function runTests(sections: TestSection[]): Promise<TestResult> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const section of sections) {
    console.log(`\n  📂 ${section.name}`);

    for (const test of section.tests) {
      try {
        await test.fn();
        console.log(`    ✅ ${test.name}`);
        passed++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`    ❌ ${test.name}: ${msg}`);
        errors.push(`${section.name} > ${test.name}: ${msg}`);
        failed++;
      }
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed`);

  return {
    passed: failed === 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

// Helper to make fetch requests
async function request(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    expectedStatus?: number;
  } = {}
): Promise<unknown> {
  const { method = 'GET', body, headers = {}, expectedStatus = 200 } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (expectedStatus && res.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus}, got ${res.status}`);
  }

  if (res.headers.get('content-type')?.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

// Track created resources for cleanup/testing
let testProposalId: string | null = null;
let testMarketId: string | null = null;

export async function testBackend(): Promise<TestResult> {
  const sections: TestSection[] = [
    // Health & Ready
    {
      name: 'Health & Ready Endpoints',
      tests: [
        {
          name: 'GET /health returns ok',
          fn: async () => {
            const data = (await request('/health')) as { status: string };
            if (data.status !== 'ok' && data.status !== 'degraded') {
              throw new Error(`Unexpected status: ${data.status}`);
            }
          },
        },
        {
          name: 'GET /ready returns ready state',
          fn: async () => {
            const data = (await request('/ready')) as { ready: boolean };
            if (typeof data.ready !== 'boolean') {
              throw new Error('Expected ready to be boolean');
            }
          },
        },
      ],
    },

    // Config Endpoints
    {
      name: 'Config Endpoints',
      tests: [
        {
          name: 'GET /api/config/contracts returns contract config',
          fn: async () => {
            const data = (await request('/api/config/contracts')) as {
              success: boolean;
              data: { contracts: unknown[] };
            };
            if (!data.success) throw new Error('Expected success: true');
            if (!data.data?.contracts) throw new Error('Missing contracts');
          },
        },
      ],
    },

    // Legacy Markets Endpoints
    {
      name: 'Legacy Markets Endpoints (/api/markets)',
      tests: [
        {
          name: 'GET /api/markets returns market list',
          fn: async () => {
            const data = (await request('/api/markets')) as {
              success: boolean;
              data: { markets: unknown[] };
            };
            if (!data.success) throw new Error('Expected success: true');
            if (!Array.isArray(data.data?.markets)) {
              throw new Error('Expected markets array');
            }
          },
        },
        {
          name: 'GET /api/markets with pagination',
          fn: async () => {
            const data = (await request('/api/markets?limit=5&offset=0')) as {
              success: boolean;
            };
            if (!data.success) throw new Error('Expected success: true');
          },
        },
        {
          name: 'GET /api/markets/:id with invalid ID returns 404',
          fn: async () => {
            await request('/api/markets/invalid-market-id', {
              expectedStatus: 404,
            });
          },
        },
      ],
    },

    // V1 Markets Endpoints
    {
      name: 'V1 Markets Endpoints (/api/v1/markets)',
      tests: [
        {
          name: 'GET /api/v1/markets returns AI markets list',
          fn: async () => {
            const data = (await request('/api/v1/markets')) as {
              success: boolean;
              data: unknown[];
            };
            if (!data.success) throw new Error('Expected success: true');
            if (!Array.isArray(data.data)) {
              throw new Error('Expected data array');
            }
            // Store first market ID for later tests
            if (data.data.length > 0) {
              testMarketId = (data.data[0] as { id: string }).id;
            }
          },
        },
        {
          name: 'GET /api/v1/markets with status filter',
          fn: async () => {
            const data = (await request('/api/v1/markets?status=active')) as {
              success: boolean;
            };
            if (!data.success) throw new Error('Expected success: true');
          },
        },
        {
          name: 'GET /api/v1/markets with category filter',
          fn: async () => {
            const data = (await request('/api/v1/markets?category=technology')) as {
              success: boolean;
            };
            if (!data.success) throw new Error('Expected success: true');
          },
        },
      ],
    },

    // Proposal Endpoints
    {
      name: 'Proposal Endpoints (/api/v1/propose)',
      tests: [
        {
          name: 'POST /api/v1/propose with valid proposal',
          fn: async () => {
            const data = (await request('/api/v1/propose', {
              method: 'POST',
              body: {
                proposal_text: `Test proposal ${Date.now()} - Will AI pass the Turing test by 2030?`,
                category_hint: 'technology',
              },
            })) as { success: boolean; data: { proposal_id: string } };
            if (!data.success) throw new Error('Expected success: true');
            if (!data.data?.proposal_id) throw new Error('Missing proposal_id');
            testProposalId = data.data.proposal_id;
          },
        },
        {
          name: 'GET /api/v1/propose/:id returns proposal',
          fn: async () => {
            if (!testProposalId) throw new Error('No test proposal ID');
            const data = (await request(`/api/v1/propose/${testProposalId}`)) as {
              success: boolean;
              data: { status: string };
            };
            if (!data.success) throw new Error('Expected success: true');
            if (!data.data?.status) throw new Error('Missing status');
          },
        },
        {
          name: 'POST /api/v1/propose with empty body returns 400',
          fn: async () => {
            await request('/api/v1/propose', {
              method: 'POST',
              body: {},
              expectedStatus: 400,
            });
          },
        },
        {
          name: 'POST /api/v1/propose with short text returns 400',
          fn: async () => {
            await request('/api/v1/propose', {
              method: 'POST',
              body: { proposal_text: 'short' },
              expectedStatus: 400,
            });
          },
        },
        {
          name: 'GET /api/v1/propose/:id with invalid UUID returns 400/404',
          fn: async () => {
            const res = await fetch(`${API_BASE}/api/v1/propose/not-a-uuid`);
            if (res.status !== 400 && res.status !== 404) {
              throw new Error(`Expected 400/404, got ${res.status}`);
            }
          },
        },
      ],
    },

    // Disputes Endpoints
    {
      name: 'Disputes Endpoints (/api/v1/disputes)',
      tests: [
        {
          name: 'GET /api/v1/disputes returns disputes list',
          fn: async () => {
            const data = (await request('/api/v1/disputes')) as {
              success: boolean;
              data: unknown[];
            };
            if (!data.success) throw new Error('Expected success: true');
            if (!Array.isArray(data.data)) {
              throw new Error('Expected data array');
            }
          },
        },
        {
          name: 'POST /api/v1/disputes requires market_id',
          fn: async () => {
            await request('/api/v1/disputes', {
              method: 'POST',
              body: { reason: 'test' },
              expectedStatus: 400,
            });
          },
        },
      ],
    },

    // Admin Endpoints
    {
      name: 'Admin Endpoints (/api/v1/admin)',
      tests: [
        {
          name: 'GET /api/v1/admin/proposals returns list',
          fn: async () => {
            const data = (await request('/api/v1/admin/proposals')) as {
              success: boolean;
            };
            if (!data.success) throw new Error('Expected success: true');
          },
        },
        {
          name: 'GET /api/v1/admin/proposals with status filter',
          fn: async () => {
            const data = (await request('/api/v1/admin/proposals?status=pending')) as {
              success: boolean;
            };
            if (!data.success) throw new Error('Expected success: true');
          },
        },
        {
          name: 'GET /api/v1/admin/disputes returns list',
          fn: async () => {
            const data = (await request('/api/v1/admin/disputes')) as {
              success: boolean;
            };
            if (!data.success) throw new Error('Expected success: true');
          },
        },
        {
          name: 'GET /api/v1/admin/ai-config returns config',
          fn: async () => {
            const data = (await request('/api/v1/admin/ai-config')) as {
              success: boolean;
              data: unknown;
            };
            if (!data.success) throw new Error('Expected success: true');
            if (!data.data) throw new Error('Missing config data');
          },
        },
      ],
    },

    // Worker Auth Endpoints
    {
      name: 'Worker Auth Endpoints (/api/v1/worker)',
      tests: [
        {
          name: 'POST /api/v1/worker/auth/token rejects invalid key',
          fn: async () => {
            const res = await fetch(`${API_BASE}/api/v1/worker/auth/token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                api_key: 'invalid-key',
                worker_type: 'generator',
              }),
            });
            if (res.status < 400) {
              throw new Error(`Expected error, got ${res.status}`);
            }
          },
        },
        {
          name: 'POST /api/v1/worker/auth/token validates worker_type',
          fn: async () => {
            const res = await fetch(`${API_BASE}/api/v1/worker/auth/token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                api_key: 'test-key',
                worker_type: 'invalid_type',
              }),
            });
            if (res.status < 400) {
              throw new Error(`Expected error, got ${res.status}`);
            }
          },
        },
      ],
    },

    // Trading Endpoints
    {
      name: 'Trading Endpoints (/api/trading)',
      tests: [
        {
          name: 'POST /api/trading/quote validates input',
          fn: async () => {
            await request('/api/trading/quote', {
              method: 'POST',
              body: {},
              expectedStatus: 400,
            });
          },
        },
        {
          name: 'POST /api/trading/buy validates input',
          fn: async () => {
            await request('/api/trading/buy', {
              method: 'POST',
              body: {},
              expectedStatus: 400,
            });
          },
        },
        {
          name: 'POST /api/trading/sell validates input',
          fn: async () => {
            await request('/api/trading/sell', {
              method: 'POST',
              body: {},
              expectedStatus: 400,
            });
          },
        },
      ],
    },

    // Liquidity Endpoints
    {
      name: 'Liquidity Endpoints (/api/liquidity)',
      tests: [
        {
          name: 'POST /api/liquidity/add validates input',
          fn: async () => {
            await request('/api/liquidity/add', {
              method: 'POST',
              body: {},
              expectedStatus: 400,
            });
          },
        },
        {
          name: 'POST /api/liquidity/remove validates input',
          fn: async () => {
            await request('/api/liquidity/remove', {
              method: 'POST',
              body: {},
              expectedStatus: 400,
            });
          },
        },
      ],
    },

    // Error Handling
    {
      name: 'Error Handling',
      tests: [
        {
          name: 'GET /api/nonexistent returns 404',
          fn: async () => {
            await request('/api/nonexistent', { expectedStatus: 404 });
          },
        },
        {
          name: 'Invalid JSON body returns 400',
          fn: async () => {
            const res = await fetch(`${API_BASE}/api/v1/propose`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: 'invalid json{',
            });
            if (res.status !== 400) {
              throw new Error(`Expected 400, got ${res.status}`);
            }
          },
        },
      ],
    },
  ];

  return runTests(sections);
}
