/**
 * Scheduler Worker
 *
 * Cron-based scheduler that:
 * 1. Checks for markets ready for resolution (past expiry)
 * 2. Checks for markets past dispute window (ready for finalization)
 * 3. Cleans up stale rate limit entries
 */

import cron from 'node-cron';
import { env } from './shared/env.js';
import { logger } from './shared/logger.js';
import { getDb, closeDb } from './shared/db.js';
import { initializeQueues, publishMarketResolve, publishConfigRefresh, closeQueue } from './shared/queue.js';
import { startHeartbeat, stopHeartbeat, recordSuccess, recordFailure, setIdle } from './shared/heartbeat.js';

/**
 * Check for markets that need resolution
 * Runs every minute
 */
async function checkMarketsForResolution(): Promise<void> {
  const sql = getDb();

  try {
    // Find active markets past expiry
    const markets = await sql`
      SELECT id, market_address, resolution->>'expiry' as expiry
      FROM ai_markets
      WHERE status = 'active'
        AND resolution->>'expiry' IS NOT NULL
        AND (resolution->>'expiry')::timestamptz < NOW()
        AND market_address IS NOT NULL
    `;

    if (markets.length === 0) {
      return;
    }

    logger.info({ count: markets.length }, 'Found markets ready for resolution');

    for (const market of markets) {
      // Update status to resolving
      await sql`
        UPDATE ai_markets
        SET status = 'resolving'
        WHERE id = ${market.id}
          AND status = 'active'
      `;

      // Publish to resolve queue
      await publishMarketResolve({
        market_id: market.id,
        market_address: market.market_address,
        expiry: market.expiry,
      });

      logger.info({ marketId: market.id }, 'Market queued for resolution');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to check markets for resolution');
  }
}

/**
 * Check for markets past dispute window that can be finalized
 * Runs every 5 minutes
 */
async function checkMarketsForFinalization(): Promise<void> {
  const sql = getDb();

  try {
    // Find resolved markets past dispute window with no active disputes
    const markets = await sql`
      SELECT m.id, m.market_address
      FROM ai_markets m
      INNER JOIN resolutions r ON r.market_id = m.id
      LEFT JOIN disputes d ON d.resolution_id = r.id
      WHERE m.status = 'resolved'
        AND r.dispute_window_ends < NOW()
        AND (d.id IS NULL OR d.status IN ('upheld', 'overturned'))
    `;

    if (markets.length === 0) {
      return;
    }

    logger.info({ count: markets.length }, 'Found markets ready for finalization');

    for (const market of markets) {
      // Update status to finalized
      await sql`
        UPDATE ai_markets
        SET status = 'finalized', finalized_at = NOW()
        WHERE id = ${market.id}
          AND status = 'resolved'
      `;

      // Update resolution status
      await sql`
        UPDATE resolutions
        SET status = 'finalized', finalized_at = NOW()
        WHERE market_id = ${market.id}
          AND status = 'resolved'
      `;

      // Log audit entry
      await sql`
        INSERT INTO audit_logs (action, entity_type, entity_id, actor, details)
        VALUES (
          'market_finalized',
          'market',
          ${market.id},
          'scheduler',
          ${JSON.stringify({ auto_finalized: true })}
        )
      `;

      logger.info({ marketId: market.id }, 'Market finalized');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to check markets for finalization');
  }
}

/**
 * Clean up old rate limit entries
 * Runs every hour
 */
async function cleanupRateLimits(): Promise<void> {
  const sql = getDb();

  try {
    // Delete rate limit entries older than 24 hours
    const result = await sql`
      DELETE FROM rate_limits
      WHERE window_start < NOW() - INTERVAL '24 hours'
    `;

    if (result.count > 0) {
      logger.info({ deleted: result.count }, 'Cleaned up old rate limit entries');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to cleanup rate limits');
  }
}

/**
 * Refresh AI config from database
 * Runs every 15 minutes
 */
async function refreshConfig(): Promise<void> {
  try {
    // Publish config refresh message
    await publishConfigRefresh({
      key: 'all',
      timestamp: new Date().toISOString(),
    });

    logger.debug('Published config refresh message');
  } catch (error) {
    logger.error({ error }, 'Failed to refresh config');
  }
}

/**
 * Check for stale processing jobs
 * Runs every 10 minutes
 */
async function checkStaleJobs(): Promise<void> {
  const sql = getDb();

  try {
    // Find proposals stuck in 'processing' for more than 30 minutes
    const staleProposals = await sql`
      UPDATE proposals
      SET status = 'failed'
      WHERE status = 'processing'
        AND created_at < NOW() - INTERVAL '30 minutes'
      RETURNING id
    `;

    if (staleProposals.length > 0) {
      logger.warn(
        { count: staleProposals.length, ids: staleProposals.map((p) => p.id) },
        'Marked stale proposals as failed'
      );
    }

    // Find markets stuck in 'resolving' for more than 1 hour
    const staleResolutions = await sql`
      UPDATE ai_markets
      SET status = 'failed'
      WHERE status = 'resolving'
        AND resolved_at IS NULL
        AND created_at < NOW() - INTERVAL '1 hour'
      RETURNING id
    `;

    if (staleResolutions.length > 0) {
      logger.warn(
        { count: staleResolutions.length, ids: staleResolutions.map((m) => m.id) },
        'Marked stale resolution attempts as failed'
      );
    }
  } catch (error) {
    logger.error({ error }, 'Failed to check for stale jobs');
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info('Starting Scheduler');

  // Start heartbeat reporting to backend
  startHeartbeat({ workerType: 'scheduler', intervalMs: 30000 });

  // Initialize queue connection
  await initializeQueues();

  // Mark as idle (scheduler is always "idle" between cron runs)
  setIdle();

  // Schedule jobs
  // Check for markets to resolve - every minute
  cron.schedule('* * * * *', async () => {
    logger.debug('Running: checkMarketsForResolution');
    try {
      await checkMarketsForResolution();
      recordSuccess();
    } catch (error) {
      const err = error as Error;
      recordFailure(err.message);
    }
  });

  // Check for markets to finalize - every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.debug('Running: checkMarketsForFinalization');
    try {
      await checkMarketsForFinalization();
      recordSuccess();
    } catch (error) {
      const err = error as Error;
      recordFailure(err.message);
    }
  });

  // Cleanup rate limits - every hour
  cron.schedule('0 * * * *', async () => {
    logger.debug('Running: cleanupRateLimits');
    try {
      await cleanupRateLimits();
      recordSuccess();
    } catch (error) {
      const err = error as Error;
      recordFailure(err.message);
    }
  });

  // Refresh config - every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.debug('Running: refreshConfig');
    try {
      await refreshConfig();
      recordSuccess();
    } catch (error) {
      const err = error as Error;
      recordFailure(err.message);
    }
  });

  // Check for stale jobs - every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    logger.debug('Running: checkStaleJobs');
    try {
      await checkStaleJobs();
      recordSuccess();
    } catch (error) {
      const err = error as Error;
      recordFailure(err.message);
    }
  });

  // Run initial checks
  logger.info('Running initial checks...');
  await checkMarketsForResolution();
  await checkMarketsForFinalization();
  await checkStaleJobs();

  logger.info('Scheduler is running');
}

// Handle graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down scheduler...');
  await stopHeartbeat();
  await closeQueue();
  await closeDb();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the scheduler
main().catch((error) => {
  logger.error({ error }, 'Fatal error in Scheduler');
  process.exit(1);
});
