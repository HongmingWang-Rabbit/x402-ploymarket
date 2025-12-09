/**
 * Resolver Worker
 *
 * Determines market outcomes using deterministic rules.
 * Consumes from markets.resolve queue.
 */

import crypto from 'crypto';
import { env } from './shared/env.js';
import { logger } from './shared/logger.js';
import { getDb, closeDb } from './shared/db.js';
import { consumeMessages, initializeQueues, closeQueue, QUEUE_NAMES } from './shared/queue.js';
import { llmJsonRequest } from './shared/llm.js';
import { startHeartbeat, stopHeartbeat, recordSuccess, recordFailure, setIdle } from './shared/heartbeat.js';
import {
  RESOLUTION_SYSTEM_PROMPT,
  buildResolutionPrompt,
  type ResolutionResponse,
} from './prompts/resolution.js';
import type { MarketResolveMessage } from '@x402/shared-types';

const FETCH_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const DISPUTE_WINDOW_HOURS = 24;

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

interface FetchedEvidence {
  sourceUrl: string;
  sourceName: string;
  content: string;
  fetchedAt: string;
  contentHash: string;
  httpStatus: number;
  success: boolean;
  error?: string;
}

/**
 * Fetch content from a URL with retries
 */
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<FetchedEvidence> {
  const fetchedAt = new Date().toISOString();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info({ url, attempt }, 'Fetching source');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PredictionMarketResolver/1.0)',
          Accept: 'text/html,application/json,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      let content: string;

      if (contentType.includes('application/json')) {
        const json = await response.json();
        content = JSON.stringify(json, null, 2);
      } else {
        content = await response.text();
      }

      const contentHash = crypto.createHash('sha256').update(content).digest('hex');

      return {
        sourceUrl: url,
        sourceName: new URL(url).hostname,
        content,
        fetchedAt,
        contentHash,
        httpStatus: response.status,
        success: response.ok,
      };
    } catch (error) {
      const err = error as Error;
      logger.warn({ url, attempt, error: err.message }, 'Fetch attempt failed');

      if (attempt === retries) {
        return {
          sourceUrl: url,
          sourceName: new URL(url).hostname,
          content: '',
          fetchedAt,
          contentHash: '',
          httpStatus: 0,
          success: false,
          error: err.message,
        };
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  // Should never reach here
  throw new Error('Unexpected error in fetchWithRetry');
}

/**
 * Process market resolution
 */
async function processResolution(message: MarketResolveMessage): Promise<void> {
  const sql = getDb();

  logger.info({ marketId: message.market_id }, 'Processing market resolution');

  // Fetch market from database
  const [market] = await sql`
    SELECT id, title, description, market_address, resolution, status
    FROM ai_markets
    WHERE id = ${message.market_id}
  `;

  if (!market) {
    throw new Error(`Market not found: ${message.market_id}`);
  }

  if (market.status !== 'resolving') {
    logger.warn({ marketId: message.market_id, status: market.status }, 'Market not in resolving status');
    return;
  }

  const resolution = market.resolution as MarketResolution;

  // Fetch evidence from allowed sources
  const evidenceResults: FetchedEvidence[] = [];

  for (const source of resolution.criteria.allowed_sources) {
    const evidence = await fetchWithRetry(source.url);
    evidenceResults.push({
      ...evidence,
      sourceName: source.name,
    });
  }

  // Check if we have at least one successful fetch
  const successfulFetches = evidenceResults.filter((e) => e.success);
  if (successfulFetches.length === 0) {
    logger.error({ marketId: message.market_id }, 'All source fetches failed');

    // Update market status to failed
    await sql`
      UPDATE ai_markets
      SET status = 'failed'
      WHERE id = ${message.market_id}
    `;

    // Log audit entry
    await sql`
      INSERT INTO audit_logs (action, entity_type, entity_id, actor, details)
      VALUES (
        'resolution_failed',
        'market',
        ${message.market_id},
        'resolver_worker',
        ${JSON.stringify({
          reason: 'All source fetches failed',
          sources: evidenceResults.map((e) => ({
            url: e.sourceUrl,
            success: e.success,
            error: e.error,
          })),
        })}
      )
    `;

    throw new Error('All source fetches failed');
  }

  // Combine evidence for LLM
  const combinedEvidence = successfulFetches
    .map((e) => `=== Source: ${e.sourceName} (${e.sourceUrl}) ===\n${e.content}`)
    .join('\n\n');

  // Call LLM for resolution
  const prompt = buildResolutionPrompt({
    marketTitle: market.title,
    exactQuestion: resolution.exact_question,
    mustMeetAll: resolution.criteria.must_meet_all || [],
    mustNotCount: resolution.criteria.must_not_count || [],
    machineResolutionLogic: resolution.criteria.machine_resolution_logic,
    allowedSources: resolution.criteria.allowed_sources,
    sourceUrl: successfulFetches.map((e) => e.sourceUrl).join(', '),
    fetchTime: new Date().toISOString(),
    content: combinedEvidence,
  });

  const llmResponse = await llmJsonRequest<ResolutionResponse>({
    systemPrompt: RESOLUTION_SYSTEM_PROMPT,
    userPrompt: prompt,
    temperature: 0.1, // Very low for deterministic results
    maxTokens: 2000,
  });

  const result = llmResponse.content;

  // Compute evidence hash (hash of all evidence hashes)
  const evidenceHash = crypto
    .createHash('sha256')
    .update(successfulFetches.map((e) => e.contentHash).join(''))
    .digest('hex');

  // Store resolution record
  const disputeWindowEnds = new Date(Date.now() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000);

  const [resolutionRecord] = await sql`
    INSERT INTO resolutions (
      market_id,
      final_result,
      evidence_hash,
      evidence_raw,
      must_meet_all_results,
      must_not_count_results,
      resolution_source,
      status
    )
    VALUES (
      ${message.market_id},
      ${result.final_result},
      ${evidenceHash},
      ${JSON.stringify(
        successfulFetches.map((e) => ({
          url: e.sourceUrl,
          name: e.sourceName,
          fetchedAt: e.fetchedAt,
          contentHash: e.contentHash,
          httpStatus: e.httpStatus,
        }))
      )},
      ${JSON.stringify(result.must_meet_all_results)},
      ${JSON.stringify(result.must_not_count_results)},
      ${successfulFetches[0].sourceUrl},
      'resolved'
    )
    RETURNING id
  `;

  // Update market status
  await sql`
    UPDATE ai_markets
    SET
      status = 'resolved',
      resolved_at = NOW(),
      dispute_window_ends = ${disputeWindowEnds}
    WHERE id = ${message.market_id}
  `;

  // Log audit entry
  await sql`
    INSERT INTO audit_logs (action, entity_type, entity_id, actor, details)
    VALUES (
      'market_resolved',
      'market',
      ${message.market_id},
      'resolver_worker',
      ${JSON.stringify({
        resolution_id: resolutionRecord.id,
        final_result: result.final_result,
        evidence_hash: evidenceHash,
        reasoning: result.reasoning,
        llm_request_id: llmResponse.requestId,
        sources_fetched: successfulFetches.length,
        dispute_window_ends: disputeWindowEnds.toISOString(),
      })}
    )
  `;

  // TODO: Submit on-chain resolution
  // This would call the Solana program to set the market result
  // For now, just log it
  if (env.DRY_RUN) {
    logger.info(
      { marketId: message.market_id, result: result.final_result },
      'DRY RUN: Would submit on-chain resolution'
    );
  } else {
    logger.info(
      { marketId: message.market_id, result: result.final_result },
      'TODO: Submit on-chain resolution'
    );
    // Implement on-chain resolution here
  }

  logger.info(
    {
      marketId: message.market_id,
      resolutionId: resolutionRecord.id,
      result: result.final_result,
      disputeWindowEnds: disputeWindowEnds.toISOString(),
    },
    'Market resolution completed'
  );
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info('Starting Resolver worker');

  // Start heartbeat reporting to backend
  startHeartbeat({ workerType: 'resolver', intervalMs: 30000 });

  // Initialize queue
  await initializeQueues();

  // Mark as idle while waiting for messages
  setIdle();

  // Start consuming
  await consumeMessages<MarketResolveMessage>(
    QUEUE_NAMES.MARKETS_RESOLVE,
    async (message, msg) => {
      try {
        await processResolution(message);
        recordSuccess();
      } catch (error) {
        const err = error as Error;
        logger.error({ error: { message: err.message, stack: err.stack, name: err.name }, marketId: message.market_id }, 'Failed to process resolution');
        recordFailure(err.message);
        throw error; // Let the queue handler deal with retry
      }
    }
  );

  logger.info('Resolver worker is running');
}

// Handle graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down resolver worker...');
  await stopHeartbeat();
  await closeQueue();
  await closeDb();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the worker
main().catch((error) => {
  logger.error({ error }, 'Fatal error in Resolver worker');
  process.exit(1);
});
