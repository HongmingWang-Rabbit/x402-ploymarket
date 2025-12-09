/**
 * End-to-End Tests
 *
 * Tests the complete proposal flow from submission to publication
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

interface TestResult {
  passed: boolean;
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function testE2E(): Promise<TestResult> {
  const errors: string[] = [];

  try {
    console.log('  Step 1: Submit a proposal...');

    const proposalText = `E2E Test ${Date.now()} - Will quantum computers break RSA encryption by 2030?`;

    const submitRes = await fetch(`${API_BASE}/api/v1/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposal_text: proposalText,
        category_hint: 'technology',
      }),
    });

    if (!submitRes.ok) {
      throw new Error(`Failed to submit proposal: ${submitRes.status}`);
    }

    const submitData = await submitRes.json();
    if (!submitData.success || !submitData.data.proposal_id) {
      throw new Error('No proposal_id in response');
    }

    const proposalId = submitData.data.proposal_id;
    console.log(`  ✅ Proposal submitted: ${proposalId}`);
    console.log(`     Status: ${submitData.data.status}`);

    // Step 2: Poll for completion
    console.log('\n  Step 2: Waiting for processing (max 60s)...');

    let finalStatus = submitData.data.status;
    let attempts = 0;
    const maxAttempts = 12; // 60 seconds max

    while (attempts < maxAttempts) {
      await sleep(5000);
      attempts++;

      const statusRes = await fetch(`${API_BASE}/api/v1/propose/${proposalId}`);
      if (!statusRes.ok) {
        console.log(`     Attempt ${attempts}: Error fetching status`);
        continue;
      }

      const statusData = await statusRes.json();
      finalStatus = statusData.data.status;

      console.log(`     Attempt ${attempts}: Status = ${finalStatus}`);

      // Check for terminal states
      if (
        finalStatus === 'published' ||
        finalStatus === 'rejected' ||
        finalStatus === 'needs_human' ||
        finalStatus === 'matched'
      ) {
        break;
      }
    }

    // Step 3: Verify result
    console.log('\n  Step 3: Verifying result...');

    if (finalStatus === 'processing' || finalStatus === 'pending') {
      console.log(`  ⚠️  Proposal still ${finalStatus} after ${maxAttempts * 5}s`);
      console.log('     This may indicate workers are not running');
      errors.push(`Proposal stuck in ${finalStatus} state`);
    } else if (finalStatus === 'published') {
      console.log('  ✅ Proposal was published successfully!');

      // Check if market was created
      const marketsRes = await fetch(`${API_BASE}/api/v1/markets`);
      const marketsData = await marketsRes.json();

      const newMarket = marketsData.data.find(
        (m: any) =>
          m.description?.includes(proposalText.substring(0, 30)) ||
          m.title?.toLowerCase().includes('quantum')
      );

      if (newMarket) {
        console.log(`  ✅ Market created: ${newMarket.title}`);
        console.log(`     Address: ${newMarket.market_address || 'pending'}`);
      }
    } else if (finalStatus === 'needs_human') {
      console.log('  ✅ Proposal requires human review (expected for some proposals)');
    } else if (finalStatus === 'rejected') {
      console.log('  ⚠️  Proposal was rejected');
      errors.push('Proposal rejected');
    } else if (finalStatus === 'matched') {
      console.log('  ✅ Proposal matched existing market');
    }

    // Overall result
    const passed =
      errors.length === 0 ||
      finalStatus === 'published' ||
      finalStatus === 'needs_human' ||
      finalStatus === 'matched';

    console.log(`\n  Results: ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      passed,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ E2E test error: ${msg}`);
    return {
      passed: false,
      error: msg,
    };
  }
}
