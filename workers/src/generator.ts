/**
 * Generator Worker
 *
 * Consumes: candidates queue
 * Produces: drafts.validate queue
 *
 * Generates draft market definitions from news candidates or user proposals
 * using LLM.
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
  publishDraftValidate,
  QUEUE_NAMES,
  type CandidateMessage,
  llmJsonRequest,
  startHeartbeat,
  stopHeartbeat,
  recordSuccess,
  recordFailure,
  setIdle,
} from './shared/index.js';
import {
  MARKET_GENERATION_SYSTEM_PROMPT,
  buildMarketGenerationPrompt,
} from './prompts/index.js';
import type { MarketCategory, ResolutionRules } from '@x402/shared-types';

// Override worker type
process.env.WORKER_TYPE = 'generator';

const logger = createWorkerLogger('generator');

// Generated market structure from LLM
interface GeneratedMarket {
  title: string;
  description: string;
  category: MarketCategory;
  resolution: ResolutionRules;
  confidence_score: number;
}

/**
 * Get AI version from database config
 */
async function getAIVersion(): Promise<string> {
  const sql = getDb();
  const result = await sql`
    SELECT value FROM ai_config WHERE key = 'ai_version'
  `;
  // Value is stored as a plain string - return as-is
  const value = result[0]?.value;
  if (!value) return 'v1.0';
  // If value is already a string, return it directly
  if (typeof value === 'string') {
    // Check if it's a JSON-encoded string (starts with quote)
    if (value.startsWith('"')) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
  return String(value);
}

/**
 * Process candidate message and generate draft market
 */
async function processCandidate(candidate: CandidateMessage): Promise<void> {
  const sql = getDb();
  const aiVersion = await getAIVersion();

  logger.info({ candidateId: candidate.candidate_id }, 'Processing candidate');

  // Build prompt
  const userPrompt = buildMarketGenerationPrompt({
    entities: candidate.entities,
    eventType: candidate.event_type,
    category: candidate.category_hint,
    relevantText: candidate.relevant_text,
  });

  // Call LLM
  const response = await llmJsonRequest<GeneratedMarket>({
    systemPrompt: MARKET_GENERATION_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.3,
    maxTokens: 2000,
  });

  const market = response.content;
  logger.info(
    {
      candidateId: candidate.candidate_id,
      title: market.title,
      confidence: market.confidence_score,
      llmRequestId: response.requestId,
    },
    'Market generated'
  );

  // Insert draft market into database
  const [inserted] = await sql`
    INSERT INTO ai_markets (
      title,
      description,
      category,
      ai_version,
      confidence_score,
      source_news_id,
      source_proposal_id,
      resolution,
      status,
      created_by
    ) VALUES (
      ${market.title},
      ${market.description},
      ${market.category},
      ${aiVersion},
      ${market.confidence_score},
      ${candidate.news_id},
      ${candidate.proposal_id || null},
      ${JSON.stringify(market.resolution)},
      'draft',
      'generator'
    )
    RETURNING id
  `;

  const draftMarketId = inserted.id;

  // Update candidate as processed
  await sql`
    UPDATE candidates
    SET processed = true, draft_market_id = ${draftMarketId}
    WHERE id = ${candidate.candidate_id}
  `;

  // Log audit
  await sql`
    INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, ai_version, llm_request_id)
    VALUES (
      'draft_generated',
      'market',
      ${draftMarketId},
      'generator',
      ${JSON.stringify({
        candidate_id: candidate.candidate_id,
        confidence_score: market.confidence_score,
        title: market.title,
      })},
      ${aiVersion},
      ${response.requestId}
    )
  `;

  // Publish to validation queue
  await publishDraftValidate({
    draft_market_id: draftMarketId,
    source_type: candidate.news_id ? 'news' : 'proposal',
    source_id: candidate.news_id || candidate.proposal_id || '',
  });

  logger.info(
    { candidateId: candidate.candidate_id, draftMarketId },
    'Draft market created and queued for validation'
  );
}

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info('Starting generator worker');

  // Validate required environment variables
  validateEnv(['DATABASE_URL', 'RABBITMQ_URL', 'OPENAI_API_KEY']);

  // Start heartbeat reporting to backend
  startHeartbeat({ workerType: 'generator', intervalMs: 30000 });

  // Connect to services and initialize queues
  await initializeQueues();
  logger.info('Connected to RabbitMQ and queues initialized');

  // Test database connection
  const sql = getDb();
  await sql`SELECT 1`;
  logger.info('Connected to database');

  // Mark as idle while waiting for messages
  setIdle();

  // Start consuming candidates
  await consumeQueue<CandidateMessage>(
    QUEUE_NAMES.CANDIDATES,
    async (message, ack, nack) => {
      try {
        await processCandidate(message);
        recordSuccess();
        ack();
      } catch (error) {
        const err = error as Error;
        logger.error({
          error: { message: err.message, stack: err.stack, name: err.name },
          candidateId: message.candidate_id
        }, 'Failed to process candidate');
        recordFailure(err.message);
        // Let the queue handle retry logic
        throw error;
      }
    }
  );

  logger.info('Generator worker started, waiting for messages...');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down generator worker');
    await stopHeartbeat();
    await closeQueue();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error({ error }, 'Generator worker failed to start');
  process.exit(1);
});
