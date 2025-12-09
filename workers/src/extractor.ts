/**
 * Extractor Worker
 *
 * Consumes: news.raw queue
 * Produces: candidates queue
 *
 * Identifies market-worthy events and extracts entities from news items.
 * Uses keyword-based detection with LLM fallback for complex cases.
 */

import {
  env,
  validateEnv,
  createWorkerLogger,
  getDb,
  closeDb,
  initializeQueues,
  closeQueue,
  consumeQueue,
  publishCandidate,
  QUEUE_NAMES,
  type NewsRawMessage,
  type CandidateMessage,
  llmJsonRequest,
  startHeartbeat,
  stopHeartbeat,
  recordSuccess,
  recordFailure,
  setIdle,
} from './shared/index.js';
import type { MarketCategory } from '@x402/shared-types';

// Override worker type
process.env.WORKER_TYPE = 'extractor';

const logger = createWorkerLogger('extractor');

// Event type keyword mappings
const EVENT_KEYWORDS: Record<string, string[]> = {
  product_launch: [
    'launch', 'release', 'announce', 'unveil', 'introduce', 'rollout',
    'debut', 'available', 'shipping', 'pre-order',
  ],
  finance: [
    'earnings', 'quarterly', 'revenue', 'profit', 'financial results',
    'ipo', 'stock', 'market cap', 'valuation', 'acquisition', 'merger',
  ],
  politics: [
    'election', 'vote', 'senate', 'congress', 'president', 'governor',
    'legislation', 'bill', 'law', 'policy', 'campaign',
  ],
  sports: [
    'championship', 'finals', 'tournament', 'match', 'game', 'playoffs',
    'world cup', 'super bowl', 'olympics', 'mvp', 'draft',
  ],
  entertainment: [
    'movie', 'film', 'album', 'concert', 'tour', 'award', 'grammy',
    'oscar', 'emmy', 'premiere', 'box office',
  ],
  technology: [
    'ai', 'artificial intelligence', 'software', 'hardware', 'chip',
    'processor', 'update', 'version', 'feature', 'api', 'platform',
  ],
};

// Forbidden topics that should not become markets
const FORBIDDEN_TOPICS = [
  'death', 'assassination', 'suicide', 'terrorism', 'war crimes',
  'child abuse', 'illegal activities', 'hate speech',
];

// System prompt for entity extraction
const EXTRACTOR_SYSTEM_PROMPT = `You are an entity extractor for prediction markets.

Analyze the provided news content and determine if it could become a prediction market.

A good market candidate:
- Has a specific, verifiable event with a clear date or deadline
- Has official sources that can be checked
- Is about a significant event (product launches, elections, earnings, sports, etc.)
- Can be resolved with a binary YES/NO outcome

Respond with JSON:
{
  "is_market_worthy": boolean,
  "event_type": "product_launch" | "finance" | "politics" | "sports" | "entertainment" | "technology" | "misc",
  "category": string,
  "entities": [
    { "name": string, "type": "company" | "product" | "person" | "event" | "date" | "location" }
  ],
  "potential_questions": string[],
  "confidence": number (0-1),
  "reasoning": string
}`;

interface ExtractorResponse {
  is_market_worthy: boolean;
  event_type: string;
  category: string;
  entities: Array<{ name: string; type: string }>;
  potential_questions: string[];
  confidence: number;
  reasoning: string;
}

/**
 * Check if content contains forbidden topics
 */
function containsForbiddenTopic(text: string): boolean {
  const lowerText = text.toLowerCase();
  return FORBIDDEN_TOPICS.some(topic => lowerText.includes(topic));
}

/**
 * Detect event type using keywords
 */
function detectEventType(text: string): { eventType: string | null; category: MarketCategory } {
  const lowerText = text.toLowerCase();

  for (const [type, keywords] of Object.entries(EVENT_KEYWORDS)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      return { eventType: type, category: type as MarketCategory };
    }
  }

  return { eventType: null, category: 'misc' };
}

/**
 * Extract candidate from news using LLM
 */
async function extractWithLLM(
  title: string,
  content: string
): Promise<ExtractorResponse | null> {
  try {
    const userPrompt = `Analyze this news item:

TITLE: ${title}

CONTENT: ${content.slice(0, 2000)}

Extract entities and determine if this could become a prediction market.`;

    const response = await llmJsonRequest<ExtractorResponse>({
      systemPrompt: EXTRACTOR_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.3,
      maxTokens: 1000,
    });

    return response.content;
  } catch (error) {
    logger.error({ error }, 'LLM extraction failed');
    return null;
  }
}

/**
 * Save candidate to database
 */
async function saveCandidate(candidate: {
  id: string;
  newsId: string;
  entities: string[];
  eventType: string;
  categoryHint: MarketCategory;
  relevantText: string;
}): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO candidates (
      id,
      news_id,
      entities,
      event_type,
      category_hint,
      relevant_text,
      created_at
    )
    VALUES (
      ${candidate.id},
      ${candidate.newsId},
      ${JSON.stringify(candidate.entities)},
      ${candidate.eventType},
      ${candidate.categoryHint},
      ${candidate.relevantText},
      NOW()
    )
  `;
}

/**
 * Update news item status
 */
async function updateNewsStatus(
  newsId: string,
  status: 'extracted' | 'skipped' | 'forbidden'
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE news_items
    SET status = ${status}, processed_at = NOW()
    WHERE id = ${newsId}
  `;
}

/**
 * Process news item and extract candidate
 */
async function processNewsItem(message: NewsRawMessage): Promise<void> {
  logger.info({ newsId: message.news_id, title: message.title.slice(0, 50) }, 'Processing news item');

  const fullText = `${message.title} ${message.content}`;

  // Check for forbidden topics
  if (containsForbiddenTopic(fullText)) {
    logger.info({ newsId: message.news_id }, 'News contains forbidden topic, skipping');
    await updateNewsStatus(message.news_id, 'forbidden');
    return;
  }

  // Try keyword detection first
  let { eventType, category } = detectEventType(fullText);
  let entities: string[] = [];
  let relevantText = message.content.slice(0, 500);

  // If no event type detected, use LLM
  if (!eventType) {
    const llmResult = await extractWithLLM(message.title, message.content);

    if (!llmResult || !llmResult.is_market_worthy) {
      logger.info({ newsId: message.news_id }, 'Not market worthy, skipping');
      await updateNewsStatus(message.news_id, 'skipped');
      return;
    }

    eventType = llmResult.event_type;
    category = llmResult.category as MarketCategory;
    entities = llmResult.entities.map(e => e.name);
  }

  // Create candidate
  const candidateId = crypto.randomUUID();

  await saveCandidate({
    id: candidateId,
    newsId: message.news_id,
    entities,
    eventType: eventType!,
    categoryHint: category,
    relevantText,
  });

  // Publish to candidates queue
  const candidateMessage: CandidateMessage = {
    candidate_id: candidateId,
    news_id: message.news_id,
    entities,
    event_type: eventType!,
    category_hint: category,
    relevant_text: relevantText,
  };

  await publishCandidate(candidateMessage);

  // Update news status
  await updateNewsStatus(message.news_id, 'extracted');

  logger.info(
    { newsId: message.news_id, candidateId, eventType, category },
    'Candidate extracted and queued'
  );
}

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info('Starting extractor worker');

  // Validate required environment variables
  validateEnv(['DATABASE_URL', 'RABBITMQ_URL', 'OPENAI_API_KEY']);

  // Start heartbeat reporting to backend
  startHeartbeat({ workerType: 'extractor', intervalMs: 30000 });

  // Connect to services
  await initializeQueues();
  logger.info('Connected to RabbitMQ and queues initialized');

  // Test database connection
  const sql = getDb();
  await sql`SELECT 1`;
  logger.info('Connected to database');

  // Mark as idle while waiting for messages
  setIdle();

  // Start consuming news items
  await consumeQueue<NewsRawMessage>(
    QUEUE_NAMES.NEWS_RAW,
    async (message, ack, nack) => {
      try {
        await processNewsItem(message);
        recordSuccess();
        ack();
      } catch (error) {
        const err = error as Error;
        logger.error({ error: { message: err.message, stack: err.stack, name: err.name }, newsId: message.news_id }, 'Failed to process news item');
        recordFailure(err.message);
        throw error;
      }
    }
  );

  logger.info('Extractor worker started, waiting for messages...');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down extractor worker');
    await stopHeartbeat();
    await closeQueue();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error({ error }, 'Extractor worker failed to start');
  process.exit(1);
});
