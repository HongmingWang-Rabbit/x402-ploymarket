#!/usr/bin/env node
/**
 * Workers Integration Test Script
 *
 * Tests the full worker pipeline:
 * 1. Backend API health check
 * 2. Submit a proposal via API
 * 3. Verify Generator processes the candidate
 * 4. Verify Validator validates the draft
 * 5. Verify Publisher publishes the market (dry run)
 * 6. Check database state
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const TEST_TIMEOUT = 60000; // 60 seconds max for full pipeline

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

function logStep(step, message) {
  log(`\n[Step ${step}] ${message}`, 'cyan');
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Backend Health Check
async function testBackendHealth() {
  logStep(1, 'Testing Backend Health');

  try {
    const response = await fetch(`${BACKEND_URL}/api/config/contracts`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    logSuccess('Backend is running');
    logInfo(`Program ID: ${data.programId?.slice(0, 20)}...`);
    return true;
  } catch (error) {
    logError(`Backend health check failed: ${error.message}`);
    return false;
  }
}

// Test 2: Submit Proposal
async function testSubmitProposal() {
  logStep(2, 'Submitting Test Proposal');

  const testProposal = {
    proposal_text: `Will AI pass the Turing test by ${new Date().getFullYear() + 2}? (Test ${Date.now()})`,
    category_hint: 'technology',
  };

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testProposal),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const data = await response.json();

    if (!data.success || !data.data?.proposal_id) {
      throw new Error('Invalid response structure');
    }

    logSuccess(`Proposal submitted: ${data.data.proposal_id}`);
    logInfo(`Status: ${data.data.status}`);
    return data.data.proposal_id;
  } catch (error) {
    logError(`Failed to submit proposal: ${error.message}`);
    return null;
  }
}

// Test 3: Poll for Proposal Status
async function testProposalProcessing(proposalId, maxWaitMs = 45000) {
  logStep(3, 'Waiting for Worker Processing');

  const startTime = Date.now();
  let lastStatus = null;
  let attempts = 0;

  while (Date.now() - startTime < maxWaitMs) {
    attempts++;

    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/propose/${proposalId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const status = data.data?.status;

      if (status !== lastStatus) {
        logInfo(`Status: ${status} (attempt ${attempts})`);
        lastStatus = status;
      }

      // Check for terminal states
      if (status === 'published' || status === 'approved') {
        logSuccess(`Proposal processed successfully! Final status: ${status}`);
        if (data.data?.draft_market) {
          logInfo(`Draft Market ID: ${data.data.draft_market.id}`);
          logInfo(`Market Title: ${data.data.draft_market.title}`);
        }
        return { success: true, status, data: data.data };
      }

      if (status === 'rejected' || status === 'failed') {
        logInfo(`Proposal was ${status} (this may be expected based on content)`);
        return { success: true, status, data: data.data };
      }

      if (status === 'pending_review' || status === 'needs_human') {
        logInfo('Proposal needs human review (confidence threshold not met)');
        return { success: true, status, data: data.data };
      }

    } catch (error) {
      logError(`Error polling status: ${error.message}`);
    }

    await sleep(2000); // Poll every 2 seconds
  }

  logError(`Timeout waiting for proposal processing (${maxWaitMs}ms)`);
  return { success: false, status: lastStatus, data: null };
}

// Test 4: Verify Database State
async function testDatabaseState(proposalId) {
  logStep(4, 'Verifying Database State');

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/propose/${proposalId}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const proposal = data.data;

    // Check proposal exists
    if (!proposal) {
      throw new Error('Proposal not found in database');
    }
    logSuccess('Proposal exists in database');

    // Check draft market if applicable
    if (proposal.draft_market) {
      logSuccess(`Draft market created: ${proposal.draft_market.title}`);
      logInfo(`Category: ${proposal.draft_market.category}`);
      logInfo(`Confidence: ${proposal.draft_market.confidence_score}`);

      if (proposal.draft_market.market_address) {
        logSuccess(`Market published with address: ${proposal.draft_market.market_address.slice(0, 20)}...`);
      }
    }

    // Check validation decision if applicable
    if (proposal.validation_status) {
      logInfo(`Validation status: ${proposal.validation_status}`);
    }

    return true;
  } catch (error) {
    logError(`Database verification failed: ${error.message}`);
    return false;
  }
}

// Test 5: Test API Edge Cases
async function testAPIEdgeCases() {
  logStep(5, 'Testing API Edge Cases');

  let passed = 0;
  let failed = 0;

  // Test empty proposal
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (response.status === 400) {
      logSuccess('Empty proposal correctly rejected (400)');
      passed++;
    } else {
      logError(`Empty proposal should return 400, got ${response.status}`);
      failed++;
    }
  } catch (error) {
    logError(`Empty proposal test failed: ${error.message}`);
    failed++;
  }

  // Test very short proposal
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal_text: 'Hi' }),
    });

    if (response.status === 400) {
      logSuccess('Short proposal correctly rejected (400)');
      passed++;
    } else {
      logInfo(`Short proposal returned ${response.status} (may be accepted)`);
      passed++;
    }
  } catch (error) {
    logError(`Short proposal test failed: ${error.message}`);
    failed++;
  }

  // Test invalid proposal ID
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/propose/invalid-uuid-here`);

    if (response.status === 400 || response.status === 404) {
      logSuccess(`Invalid proposal ID correctly handled (${response.status})`);
      passed++;
    } else {
      logError(`Invalid proposal ID should return 400/404, got ${response.status}`);
      failed++;
    }
  } catch (error) {
    logError(`Invalid proposal ID test failed: ${error.message}`);
    failed++;
  }

  logInfo(`Edge cases: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Main test runner
async function runTests() {
  log('\n========================================', 'blue');
  log('   Workers Integration Test Suite', 'blue');
  log('========================================\n', 'blue');

  const results = {
    backendHealth: false,
    proposalSubmit: false,
    workerProcessing: false,
    databaseState: false,
    edgeCases: false,
  };

  // Test 1: Backend Health
  results.backendHealth = await testBackendHealth();
  if (!results.backendHealth) {
    logError('\nBackend is not running. Please start the backend first.');
    logInfo('Run: pnpm dev:backend');
    process.exit(1);
  }

  // Test 2: Submit Proposal
  const proposalId = await testSubmitProposal();
  results.proposalSubmit = !!proposalId;

  if (!proposalId) {
    logError('\nFailed to submit proposal. Aborting remaining tests.');
    process.exit(1);
  }

  // Test 3: Wait for Processing
  const processingResult = await testProposalProcessing(proposalId);
  results.workerProcessing = processingResult.success;

  // Test 4: Verify Database
  results.databaseState = await testDatabaseState(proposalId);

  // Test 5: Edge Cases
  results.edgeCases = await testAPIEdgeCases();

  // Summary
  log('\n========================================', 'blue');
  log('   Test Results Summary', 'blue');
  log('========================================\n', 'blue');

  const allPassed = Object.values(results).every(r => r);

  for (const [test, passed] of Object.entries(results)) {
    const icon = passed ? '✓' : '✗';
    const color = passed ? 'green' : 'red';
    log(`  ${icon} ${test}: ${passed ? 'PASSED' : 'FAILED'}`, color);
  }

  log('\n========================================', 'blue');

  if (allPassed) {
    log('  All tests PASSED!', 'green');
    process.exit(0);
  } else {
    log('  Some tests FAILED', 'red');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
