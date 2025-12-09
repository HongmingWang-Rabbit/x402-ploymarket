/**
 * Dispute Agent Worker
 *
 * Processes and evaluates disputes using AI.
 * Consumes from disputes queue.
 */

import crypto from 'crypto';
import { env } from './shared/env.js';
import { logger } from './shared/logger.js';
import { getDb, closeDb } from './shared/db.js';
import { consumeMessages, initializeQueues, closeQueue, QUEUE_NAMES } from './shared/queue.js';
import { llmJsonRequest } from './shared/llm.js';
import { startHeartbeat, stopHeartbeat, recordSuccess, recordFailure, setIdle } from './shared/heartbeat.js';
import {
  DISPUTE_REVIEW_SYSTEM_PROMPT,
  buildDisputeReviewPrompt,
  type DisputeReviewResponse,
} from './prompts/dispute-review.js';
import type { DisputeMessage } from '@x402/shared-types';

const FETCH_TIMEOUT = 30000; // 30 seconds
const CONFIDENCE_THRESHOLD_FOR_AUTO_DECISION = 0.85;

interface MarketResolution {
  type: string;
  exact_question: string;
  expiry: string;
  criteria: {
    must_meet_all: string[];
    must_not_count: string[];
    allowed_sources: {
      name: string;
      url: string;
      method: string;
      condition: string;
    }[];
    machine_resolution_logic: {
      if: string;
      then: string;
      else: string;
    };
  };
}

/**
 * Fetch content from a URL
 */
async function fetchEvidence(url: string): Promise<{ content: string; success: boolean; error?: string }> {
  try {
    // Validate URL is allowed (only official sources)
    const urlObj = new URL(url);
    if (!urlObj.protocol.startsWith('https')) {
      return { content: '', success: false, error: 'Only HTTPS URLs are allowed' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PredictionMarketDisputeAgent/1.0)',
        Accept: 'text/html,application/json,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { content: '', success: false, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    let content: string;

    if (contentType.includes('application/json')) {
      const json = await response.json();
      content = JSON.stringify(json, null, 2);
    } else {
      content = await response.text();
    }

    return { content, success: true };
  } catch (error) {
    const err = error as Error;
    return { content: '', success: false, error: err.message };
  }
}

/**
 * Check if evidence URL is in allowed sources
 */
function isAllowedSource(
  url: string,
  allowedSources: { url: string; name: string }[]
): boolean {
  try {
    const checkUrl = new URL(url);
    return allowedSources.some((source) => {
      const sourceUrl = new URL(source.url);
      return sourceUrl.hostname === checkUrl.hostname;
    });
  } catch {
    return false;
  }
}

/**
 * Process dispute
 */
async function processDispute(message: DisputeMessage): Promise<void> {
  const sql = getDb();

  logger.info({ disputeId: message.dispute_id }, 'Processing dispute');

  // Fetch dispute with resolution and market data
  const [dispute] = await sql`
    SELECT
      d.*,
      r.id as resolution_id,
      r.final_result as original_result,
      r.evidence_hash,
      r.evidence_raw,
      r.must_meet_all_results,
      r.must_not_count_results,
      r.resolution_source,
      m.id as market_id,
      m.title as market_title,
      m.resolution as market_resolution,
      m.market_address
    FROM disputes d
    JOIN resolutions r ON r.id = d.resolution_id
    JOIN ai_markets m ON m.id = r.market_id
    WHERE d.id = ${message.dispute_id}
  `;

  if (!dispute) {
    throw new Error(`Dispute not found: ${message.dispute_id}`);
  }

  if (!['pending', 'reviewing'].includes(dispute.status)) {
    logger.warn({ disputeId: message.dispute_id, status: dispute.status }, 'Dispute not in reviewable status');
    return;
  }

  // Update status to reviewing
  await sql`
    UPDATE disputes
    SET status = 'reviewing'
    WHERE id = ${message.dispute_id}
  `;

  const resolution = dispute.market_resolution as MarketResolution;
  const allowedSources = resolution.criteria.allowed_sources || [];

  // Fetch new evidence from user-provided URLs
  const evidenceUrls = dispute.evidence_urls || [];
  const newEvidenceContent: string[] = [];
  const invalidUrls: string[] = [];

  for (const url of evidenceUrls) {
    // Check if URL is from an allowed source
    if (!isAllowedSource(url, allowedSources)) {
      invalidUrls.push(url);
      continue;
    }

    const result = await fetchEvidence(url);
    if (result.success) {
      newEvidenceContent.push(`=== Source: ${url} ===\n${result.content}`);
    } else {
      logger.warn({ url, error: result.error }, 'Failed to fetch evidence URL');
    }
  }

  if (invalidUrls.length > 0) {
    logger.info(
      { disputeId: message.dispute_id, invalidUrls },
      'Some evidence URLs not from allowed sources'
    );
  }

  // Also re-fetch from original allowed sources for comparison
  const refetchedContent: string[] = [];
  for (const source of allowedSources) {
    const result = await fetchEvidence(source.url);
    if (result.success) {
      refetchedContent.push(`=== Re-fetch: ${source.name} (${source.url}) ===\n${result.content}`);
    }
  }

  // Combine all evidence
  const combinedNewEvidence = [
    ...newEvidenceContent,
    '--- Re-fetched Original Sources ---',
    ...refetchedContent,
  ].join('\n\n');

  // Parse stored results
  const mustMeetAllResults = (dispute.must_meet_all_results || []) as {
    condition: string;
    met: boolean;
    evidence: string;
  }[];
  const mustNotCountResults = (dispute.must_not_count_results || []) as {
    condition: string;
    triggered: boolean;
    evidence: string | null;
  }[];

  // Call LLM for dispute review
  const prompt = buildDisputeReviewPrompt({
    marketTitle: dispute.market_title,
    exactQuestion: resolution.exact_question,
    mustMeetAll: resolution.criteria.must_meet_all || [],
    mustNotCount: resolution.criteria.must_not_count || [],
    originalResult: dispute.original_result,
    originalEvidenceHash: dispute.evidence_hash,
    originalSource: dispute.resolution_source,
    originalMustMeetAllResults: mustMeetAllResults,
    originalMustNotCountResults: mustNotCountResults,
    disputeReason: dispute.reason || '',
    disputeEvidenceUrls: evidenceUrls,
    userAddress: dispute.user_address,
    newEvidenceContent: combinedNewEvidence,
  });

  const llmResponse = await llmJsonRequest<DisputeReviewResponse>({
    systemPrompt: DISPUTE_REVIEW_SYSTEM_PROMPT,
    userPrompt: prompt,
    temperature: 0.2,
    maxTokens: 2000,
  });

  const result = llmResponse.content;

  logger.info(
    {
      disputeId: message.dispute_id,
      decision: result.decision,
      confidence: result.confidence,
    },
    'LLM dispute review completed'
  );

  // Determine final status based on decision and confidence
  let finalStatus: string;
  let newResult: 'YES' | 'NO' | null = null;

  if (result.decision === 'escalate') {
    finalStatus = 'escalated';
  } else if (result.confidence < CONFIDENCE_THRESHOLD_FOR_AUTO_DECISION) {
    // Low confidence - escalate to human review
    finalStatus = 'escalated';
    logger.info(
      { disputeId: message.dispute_id, confidence: result.confidence },
      'Low confidence, escalating to human review'
    );
  } else if (result.decision === 'upheld') {
    finalStatus = 'upheld';
  } else if (result.decision === 'overturned') {
    finalStatus = 'overturned';
    newResult = result.new_result;
  } else {
    finalStatus = 'escalated';
  }

  // Update dispute record
  await sql`
    UPDATE disputes
    SET
      status = ${finalStatus},
      ai_review = ${JSON.stringify({
        decision: result.decision,
        reasoning: result.reasoning,
        confidence: result.confidence,
        new_evidence_relevant: result.new_evidence_relevant,
        new_evidence_analysis: result.new_evidence_analysis,
        escalation_reason: result.escalation_reason,
        llm_request_id: llmResponse.requestId,
      })},
      new_result = ${newResult},
      resolved_at = ${finalStatus !== 'escalated' ? new Date() : null}
    WHERE id = ${message.dispute_id}
  `;

  // If overturned, update resolution and market
  if (finalStatus === 'overturned' && newResult) {
    // Update resolution
    await sql`
      UPDATE resolutions
      SET final_result = ${newResult}
      WHERE id = ${dispute.resolution_id}
    `;

    // Log audit entry
    await sql`
      INSERT INTO audit_logs (action, entity_type, entity_id, actor, details)
      VALUES (
        'dispute_overturned',
        'dispute',
        ${message.dispute_id},
        'dispute_agent',
        ${JSON.stringify({
          original_result: dispute.original_result,
          new_result: newResult,
          reasoning: result.reasoning,
          llm_request_id: llmResponse.requestId,
        })}
      )
    `;

    // TODO: Submit on-chain resolution update
    if (env.DRY_RUN) {
      logger.info(
        { marketId: dispute.market_id, newResult },
        'DRY RUN: Would submit on-chain resolution update'
      );
    } else {
      logger.info(
        { marketId: dispute.market_id, newResult },
        'TODO: Submit on-chain resolution update'
      );
    }
  } else if (finalStatus === 'upheld') {
    // Log audit entry for upheld dispute
    await sql`
      INSERT INTO audit_logs (action, entity_type, entity_id, actor, details)
      VALUES (
        'dispute_upheld',
        'dispute',
        ${message.dispute_id},
        'dispute_agent',
        ${JSON.stringify({
          reasoning: result.reasoning,
          confidence: result.confidence,
          llm_request_id: llmResponse.requestId,
        })}
      )
    `;
  } else if (finalStatus === 'escalated') {
    // Log audit entry for escalated dispute
    await sql`
      INSERT INTO audit_logs (action, entity_type, entity_id, actor, details)
      VALUES (
        'dispute_escalated',
        'dispute',
        ${message.dispute_id},
        'dispute_agent',
        ${JSON.stringify({
          escalation_reason: result.escalation_reason || 'Low confidence',
          confidence: result.confidence,
          llm_request_id: llmResponse.requestId,
        })}
      )
    `;
  }

  logger.info(
    {
      disputeId: message.dispute_id,
      finalStatus,
      newResult,
    },
    'Dispute processing completed'
  );
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info('Starting Dispute Agent worker');

  // Start heartbeat reporting to backend
  startHeartbeat({ workerType: 'dispute-agent', intervalMs: 30000 });

  // Initialize queue
  await initializeQueues();

  // Mark as idle while waiting for messages
  setIdle();

  // Start consuming
  await consumeMessages<DisputeMessage>(
    QUEUE_NAMES.DISPUTES,
    async (message, msg) => {
      try {
        await processDispute(message);
        recordSuccess();
      } catch (error) {
        const err = error as Error;
        logger.error({ error: { message: err.message, stack: err.stack, name: err.name }, disputeId: message.dispute_id }, 'Failed to process dispute');
        recordFailure(err.message);
        throw error; // Let the queue handler deal with retry
      }
    }
  );

  logger.info('Dispute Agent worker is running');
}

// Handle graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down dispute-agent worker...');
  await stopHeartbeat();
  await closeQueue();
  await closeDb();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the worker
main().catch((error) => {
  logger.error({ error }, 'Fatal error in Dispute Agent worker');
  process.exit(1);
});
