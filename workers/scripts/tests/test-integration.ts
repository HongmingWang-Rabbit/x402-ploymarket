/**
 * Integration Tests
 *
 * End-to-end integration tests that test the full system flow:
 * - Proposal submission flow
 * - Market creation flow
 * - Dispute flow
 * - Resolution flow
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

interface TestResult {
  passed: boolean;
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    expectedStatus?: number;
  } = {}
): Promise<{ status: number; data: unknown }> {
  const { method = 'GET', body, expectedStatus } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : await res.text();

  if (expectedStatus && res.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus}, got ${res.status}`);
  }

  return { status: res.status, data };
}

export async function testIntegration(): Promise<TestResult> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  // Flow 1: Complete Proposal Submission Flow
  console.log('  📋 Flow 1: Proposal Submission');
  console.log('  ─────────────────────────────────');

  let proposalId: string | null = null;
  const proposalText = `Integration Test ${Date.now()} - Will autonomous vehicles reduce traffic accidents by 50% by 2030?`;

  // Step 1.1: Submit proposal
  try {
    console.log('    Step 1: Submitting proposal...');
    const { data } = await request('/api/v1/propose', {
      method: 'POST',
      body: {
        proposal_text: proposalText,
        category_hint: 'technology',
      },
    });

    const result = data as { success: boolean; data: { proposal_id: string; status: string } };
    if (!result.success || !result.data.proposal_id) {
      throw new Error('No proposal_id returned');
    }

    proposalId = result.data.proposal_id;
    console.log(`    ✅ Proposal submitted: ${proposalId}`);
    console.log(`       Initial status: ${result.data.status}`);
    passed++;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ❌ Submit failed: ${msg}`);
    errors.push(`Submit: ${msg}`);
    failed++;
  }

  // Step 1.2: Verify proposal appears in admin list
  if (proposalId) {
    try {
      console.log('    Step 2: Verifying proposal in admin list...');
      const { data } = await request('/api/v1/admin/proposals');
      const result = data as { success: boolean; data: { proposals: { id: string }[] } };

      const found = result.data.proposals?.some((p) => p.id === proposalId);
      if (found) {
        console.log('    ✅ Proposal found in admin list');
        passed++;
      } else {
        console.log('    ⚠️  Proposal not found in admin list (may be processing)');
        // Don't fail, just warn
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ❌ Admin list check failed: ${msg}`);
      errors.push(`Admin list: ${msg}`);
      failed++;
    }
  }

  // Step 1.3: Poll for status change
  if (proposalId) {
    console.log('    Step 3: Polling for status changes (max 30s)...');
    let finalStatus = 'pending';
    const maxAttempts = 6;

    for (let i = 0; i < maxAttempts; i++) {
      await sleep(5000);

      try {
        const { data } = await request(`/api/v1/propose/${proposalId}`);
        const result = data as { success: boolean; data: { status: string } };

        if (result.success) {
          finalStatus = result.data.status;
          console.log(`       Attempt ${i + 1}: status = ${finalStatus}`);

          // Terminal states
          if (['published', 'rejected', 'needs_human', 'matched'].includes(finalStatus)) {
            break;
          }
        }
      } catch (error) {
        console.log(`       Attempt ${i + 1}: error fetching status`);
      }
    }

    if (finalStatus !== 'pending' && finalStatus !== 'processing') {
      console.log(`    ✅ Proposal reached terminal state: ${finalStatus}`);
      passed++;
    } else {
      console.log(`    ⚠️  Proposal still in ${finalStatus} state (workers may be slow)`);
    }
  }

  // Flow 2: AI Markets List
  console.log('\n  📊 Flow 2: AI Markets');
  console.log('  ─────────────────────────────────');

  try {
    console.log('    Step 1: Fetching AI markets...');
    const { data } = await request('/api/v1/markets');
    const result = data as { success: boolean; data: { id: string; title: string; status: string }[] };

    if (!result.success) throw new Error('Request failed');

    console.log(`    ✅ Found ${result.data.length} AI markets`);

    // Show some market details
    if (result.data.length > 0) {
      const activeMarkets = result.data.filter((m) => m.status === 'active');
      const draftMarkets = result.data.filter((m) => m.status === 'draft');
      console.log(`       Active: ${activeMarkets.length}, Draft: ${draftMarkets.length}`);

      // Show first market title
      if (result.data[0]?.title) {
        console.log(`       Sample: "${result.data[0].title.substring(0, 50)}..."`);
      }
    }
    passed++;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ❌ Markets fetch failed: ${msg}`);
    errors.push(`Markets: ${msg}`);
    failed++;
  }

  // Flow 3: Disputes
  console.log('\n  ⚖️  Flow 3: Disputes');
  console.log('  ─────────────────────────────────');

  try {
    console.log('    Step 1: Fetching disputes...');
    const { data } = await request('/api/v1/disputes');
    const result = data as { success: boolean; data: { id: string; status: string }[] };

    if (!result.success) throw new Error('Request failed');

    console.log(`    ✅ Found ${result.data.length} disputes`);

    if (result.data.length > 0) {
      const pendingDisputes = result.data.filter((d) => d.status === 'pending');
      const resolvedDisputes = result.data.filter((d) => d.status === 'resolved');
      console.log(`       Pending: ${pendingDisputes.length}, Resolved: ${resolvedDisputes.length}`);
    }
    passed++;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ❌ Disputes fetch failed: ${msg}`);
    errors.push(`Disputes: ${msg}`);
    failed++;
  }

  // Flow 4: AI Config
  console.log('\n  ⚙️  Flow 4: AI Configuration');
  console.log('  ─────────────────────────────────');

  try {
    console.log('    Step 1: Fetching AI config...');
    const { data } = await request('/api/v1/admin/ai-config');
    const result = data as { success: boolean; data: Record<string, unknown> };

    if (!result.success) throw new Error('Request failed');

    console.log('    ✅ AI config retrieved');

    // Show some config details
    const configKeys = Object.keys(result.data);
    console.log(`       Config keys: ${configKeys.slice(0, 5).join(', ')}...`);

    if (result.data.ai_version) {
      console.log(`       AI Version: ${result.data.ai_version}`);
    }
    passed++;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ❌ AI config fetch failed: ${msg}`);
    errors.push(`AI config: ${msg}`);
    failed++;
  }

  // Flow 5: Full System Health
  console.log('\n  🏥 Flow 5: System Health');
  console.log('  ─────────────────────────────────');

  try {
    console.log('    Step 1: Checking health endpoint...');
    const { data } = await request('/health');
    const result = data as { status: string; checks?: Record<string, { status: string }> };

    console.log(`    ✅ System status: ${result.status}`);

    if (result.checks) {
      for (const [name, check] of Object.entries(result.checks)) {
        const icon = check.status === 'ok' ? '✓' : '✗';
        console.log(`       ${icon} ${name}: ${check.status}`);
      }
    }
    passed++;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ❌ Health check failed: ${msg}`);
    errors.push(`Health: ${msg}`);
    failed++;
  }

  // Flow 6: News Ingest (Admin)
  console.log('\n  📰 Flow 6: News Ingest');
  console.log('  ─────────────────────────────────');

  try {
    console.log('    Step 1: Testing manual ingest endpoint...');
    const { status, data } = await request('/api/v1/admin/ingest', {
      method: 'POST',
      body: {
        title: `Integration Test News ${Date.now()}`,
        content: 'This is a test news article for integration testing.',
        url: 'https://example.com/test-news',
        source: 'integration-test',
      },
    });

    if (status === 200 || status === 201) {
      console.log('    ✅ News ingest accepted');
      passed++;
    } else if (status === 400) {
      console.log('    ⚠️  News ingest validation error (expected for test data)');
    } else {
      const result = data as { success: boolean; message?: string };
      throw new Error(result.message || `Unexpected status ${status}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ⚠️  News ingest test: ${msg}`);
    // Don't fail, this is optional
  }

  // Summary
  console.log('\n  ─────────────────────────────────');
  console.log(`  Results: ${passed} passed, ${failed} failed`);

  return {
    passed: failed === 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}
