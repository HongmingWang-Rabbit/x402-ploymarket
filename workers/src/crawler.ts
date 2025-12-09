/**
 * Crawler Worker
 *
 * Collects news from official sources for market candidate extraction.
 * Initial scope: Manual ingest API + basic RSS polling.
 *
 * Produces: news.raw queue
 */

import crypto from 'crypto';
import Parser from 'rss-parser';
import {
  env,
  validateEnv,
  createWorkerLogger,
  getDb,
  closeDb,
  initializeQueues,
  closeQueue,
  publishNewsRaw,
  type NewsRawMessage,
  startHeartbeat,
  stopHeartbeat,
  recordSuccess,
  recordFailure,
  setIdle,
} from './shared/index.js';

// Override worker type
process.env.WORKER_TYPE = 'crawler';

const logger = createWorkerLogger('crawler');

// RSS polling interval (15 minutes)
const RSS_POLL_INTERVAL_MS = 15 * 60 * 1000;

// Parser instance
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'PredictX-Crawler/1.0',
  },
});

interface RssFeed {
  id: string;
  name: string;
  url: string;
  category?: string;
  last_polled_at?: Date | null;
}

/**
 * Get active RSS feeds from database
 */
async function getActiveFeeds(): Promise<RssFeed[]> {
  const sql = getDb();
  const result = await sql`
    SELECT id, name, url, category, last_polled_at
    FROM rss_feeds
    WHERE active = true
  `;
  return result as unknown as RssFeed[];
}

/**
 * Compute SHA-256 hash of content
 */
function computeContentHash(title: string, content: string): string {
  return crypto
    .createHash('sha256')
    .update(`${title}${content}`)
    .digest('hex');
}

/**
 * Check if news item already exists
 */
async function isDuplicate(contentHash: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`
    SELECT id FROM news_items WHERE content_hash = ${contentHash}
  `;
  return result.length > 0;
}

/**
 * Save news item to database
 */
async function saveNewsItem(item: {
  source: string;
  sourceUrl: string;
  title: string;
  content: string;
  publishedAt: Date;
  contentHash: string;
  categoryHint?: string;
}): Promise<string> {
  const sql = getDb();
  const [result] = await sql`
    INSERT INTO news_items (
      source,
      source_url,
      title,
      content,
      published_at,
      content_hash,
      category_hint,
      status
    )
    VALUES (
      ${item.source},
      ${item.sourceUrl},
      ${item.title},
      ${item.content},
      ${item.publishedAt},
      ${item.contentHash},
      ${item.categoryHint || null},
      'ingested'
    )
    RETURNING id
  `;
  return result.id;
}

/**
 * Update feed's last_polled_at timestamp
 */
async function updateFeedTimestamp(feedId: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE rss_feeds
    SET last_polled_at = NOW()
    WHERE id = ${feedId}
  `;
}

/**
 * Process a single RSS feed
 */
async function processFeed(feed: RssFeed): Promise<number> {
  let processedCount = 0;

  try {
    logger.info({ feedName: feed.name, url: feed.url }, 'Polling RSS feed');

    const result = await parser.parseURL(feed.url);

    for (const item of result.items) {
      try {
        const title = item.title || '';
        const content = item.contentSnippet || item.content || '';
        const contentHash = computeContentHash(title, content);

        // Check for duplicates
        if (await isDuplicate(contentHash)) {
          continue;
        }

        // Parse published date
        const publishedAt = item.pubDate
          ? new Date(item.pubDate)
          : new Date();

        // Save to database
        const newsId = await saveNewsItem({
          source: feed.name,
          sourceUrl: item.link || feed.url,
          title,
          content,
          publishedAt,
          contentHash,
          categoryHint: feed.category,
        });

        // Publish to queue
        const message: NewsRawMessage = {
          news_id: newsId,
          source: feed.name,
          url: item.link || feed.url,
          title,
          content,
          published_at: publishedAt.toISOString(),
          category_hint: feed.category,
        };

        await publishNewsRaw(message);
        processedCount++;

        logger.debug(
          { newsId, title: title.slice(0, 50) },
          'Published news item to queue'
        );
      } catch (itemError) {
        logger.warn(
          { error: itemError, title: item.title },
          'Failed to process feed item'
        );
      }
    }

    // Update feed timestamp
    await updateFeedTimestamp(feed.id);

    logger.info(
      { feedName: feed.name, processedCount, totalItems: result.items.length },
      'Completed polling feed'
    );
  } catch (error) {
    logger.error(
      { error, feedName: feed.name, url: feed.url },
      'Failed to poll RSS feed'
    );
  }

  return processedCount;
}

/**
 * Poll all active RSS feeds
 */
async function pollAllFeeds(): Promise<void> {
  logger.info('Starting RSS polling cycle');

  const feeds = await getActiveFeeds();

  if (feeds.length === 0) {
    logger.info('No active RSS feeds configured');
    return;
  }

  let totalProcessed = 0;

  for (const feed of feeds) {
    const count = await processFeed(feed);
    totalProcessed += count;
  }

  logger.info(
    { feedCount: feeds.length, totalProcessed },
    'Completed RSS polling cycle'
  );
}

/**
 * Manual ingest of a news item (called via API)
 */
export async function ingestNewsItem(item: {
  source: string;
  url: string;
  title: string;
  content: string;
  publishedAt?: string;
  categoryHint?: string;
}): Promise<{ newsId: string; queued: boolean }> {
  const contentHash = computeContentHash(item.title, item.content);

  // Check for duplicates
  if (await isDuplicate(contentHash)) {
    throw new Error('Duplicate content detected');
  }

  const publishedAt = item.publishedAt
    ? new Date(item.publishedAt)
    : new Date();

  // Save to database
  const newsId = await saveNewsItem({
    source: item.source,
    sourceUrl: item.url,
    title: item.title,
    content: item.content,
    publishedAt,
    contentHash,
    categoryHint: item.categoryHint,
  });

  // Publish to queue
  const message: NewsRawMessage = {
    news_id: newsId,
    source: item.source,
    url: item.url,
    title: item.title,
    content: item.content,
    published_at: publishedAt.toISOString(),
    category_hint: item.categoryHint,
  };

  await publishNewsRaw(message);

  return { newsId, queued: true };
}

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info('Starting crawler worker');

  // Validate required environment variables
  validateEnv(['DATABASE_URL', 'RABBITMQ_URL']);

  // Start heartbeat reporting to backend
  startHeartbeat({ workerType: 'crawler', intervalMs: 30000 });

  // Connect to services
  await initializeQueues();
  logger.info('Connected to RabbitMQ and queues initialized');

  // Test database connection
  const sql = getDb();
  await sql`SELECT 1`;
  logger.info('Connected to database');

  // Mark as idle while waiting for poll interval
  setIdle();

  // Initial poll
  try {
    await pollAllFeeds();
    recordSuccess();
  } catch (error) {
    const err = error as Error;
    recordFailure(err.message);
  }

  // Set up periodic polling
  const pollInterval = setInterval(async () => {
    try {
      await pollAllFeeds();
      recordSuccess();
    } catch (error) {
      const err = error as Error;
      recordFailure(err.message);
    }
  }, RSS_POLL_INTERVAL_MS);
  logger.info(
    { intervalMs: RSS_POLL_INTERVAL_MS },
    'Started RSS polling scheduler'
  );

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down crawler worker');
    clearInterval(pollInterval);
    await stopHeartbeat();
    await closeQueue();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error({ error }, 'Crawler worker failed to start');
  process.exit(1);
});
