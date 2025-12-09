/**
 * Validator Worker
 *
 * Consumes: drafts.validate queue
 * Produces: markets.publish queue (if approved)
 *
 * Validates draft markets for clarity, fairness, and safety.
 * Routes to: approved -> publish queue, rejected -> stored, needs_human -> admin review
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
  publishMarketPublish,
  QUEUE_NAMES,
  type DraftValidateMessage,
  llmJsonRequest,
  startHeartbeat,
  stopHeartbeat,
  recordSuccess,
  recordFailure,
  setIdle,
} from './shared/index.js';
import {
  VALIDATION_SYSTEM_PROMPT,
  buildValidationPrompt,
  type ValidationResult,
} from './prompts/index.js';

// Override worker type
process.env.WORKER_TYPE = 'validator';

const logger = createWorkerLogger('validator');

// Validation confidence threshold from config
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Get validation confidence threshold from config
 */
async function getConfidenceThreshold(): Promise<number> {
  const sql = getDb();
  const result = await sql`
    SELECT value FROM ai_config WHERE key = 'validation_confidence_threshold'
  `;
  return result[0]?.value ? parseFloat(result[0].value) : DEFAULT_CONFIDENCE_THRESHOLD;
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
 * Fetch draft market from database
 */
async function getDraftMarket(draftMarketId: string) {
  const sql = getDb();
  const [market] = await sql`
    SELECT id, title, description, category, resolution, confidence_score, source_proposal_id
    FROM ai_markets
    WHERE id = ${draftMarketId}
  `;
  return market;
}

/**
 * Process draft market validation
 */
async function processValidation(message: DraftValidateMessage): Promise<void> {
  const sql = getDb();
  const aiVersion = await getAIVersion();
  const confidenceThreshold = await getConfidenceThreshold();

  logger.info({ draftMarketId: message.draft_market_id }, 'Processing validation');

  // Fetch draft market
  const market = await getDraftMarket(message.draft_market_id);
  if (!market) {
    logger.error({ draftMarketId: message.draft_market_id }, 'Draft market not found');
    return;
  }

  // Build prompt
  const userPrompt = buildValidationPrompt({
    title: market.title,
    description: market.description,
    category: market.category,
    resolution: market.resolution,
  });

  // Call LLM for validation
  const response = await llmJsonRequest<ValidationResult>({
    systemPrompt: VALIDATION_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.2, // Lower temperature for more consistent validation
    maxTokens: 1000,
  });

  const validation = response.content;
  logger.info(
    {
      draftMarketId: message.draft_market_id,
      recommendation: validation.recommendation,
      overallValid: validation.overall_valid,
      llmRequestId: response.requestId,
    },
    'Validation completed'
  );

  // Determine final status based on validation and confidence
  let finalStatus: 'approved' | 'rejected' | 'pending_review';
  let proposalStatus: string;

  if (validation.is_forbidden) {
    finalStatus = 'rejected';
    proposalStatus = 'rejected';
  } else if (!validation.overall_valid) {
    if (validation.recommendation === 'needs_human') {
      finalStatus = 'pending_review';
      proposalStatus = 'needs_human';
    } else {
      finalStatus = 'rejected';
      proposalStatus = 'rejected';
    }
  } else if (market.confidence_score < confidenceThreshold) {
    finalStatus = 'pending_review';
    proposalStatus = 'needs_human';
  } else {
    finalStatus = 'approved';
    proposalStatus = 'approved';
  }

  // Update draft market with validation decision
  await sql`
    UPDATE ai_markets
    SET
      status = ${finalStatus === 'approved' ? 'active' : finalStatus === 'rejected' ? 'canceled' : 'pending_review'},
      validation_decision = ${JSON.stringify(validation)}
    WHERE id = ${message.draft_market_id}
  `;

  // Update proposal status if this came from a user proposal
  if (market.source_proposal_id) {
    await sql`
      UPDATE proposals
      SET status = ${proposalStatus}, processed_at = NOW()
      WHERE id = ${market.source_proposal_id}
    `;
  }

  // Log audit
  await sql`
    INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, ai_version, llm_request_id)
    VALUES (
      'validation_completed',
      'market',
      ${message.draft_market_id},
      'validator',
      ${JSON.stringify({
        recommendation: validation.recommendation,
        overall_valid: validation.overall_valid,
        final_status: finalStatus,
        confidence_score: market.confidence_score,
        has_ambiguity: validation.has_ambiguity,
        is_forbidden: validation.is_forbidden,
      })},
      ${aiVersion},
      ${response.requestId}
    )
  `;

  // If approved, publish to markets.publish queue
  if (finalStatus === 'approved') {
    await publishMarketPublish({
      draft_market_id: message.draft_market_id,
      validation_id: response.requestId,
    });

    logger.info(
      { draftMarketId: message.draft_market_id },
      'Market approved and queued for publishing'
    );
  } else if (finalStatus === 'rejected') {
    logger.info(
      {
        draftMarketId: message.draft_market_id,
        reasons: [
          ...validation.ambiguity_details,
          ...validation.fairness_issues,
          ...validation.forbidden_reason,
        ],
      },
      'Market rejected'
    );
  } else {
    logger.info(
      { draftMarketId: message.draft_market_id },
      'Market queued for human review'
    );
  }
}

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info('Starting validator worker');

  // Validate required environment variables
  validateEnv(['DATABASE_URL', 'RABBITMQ_URL', 'OPENAI_API_KEY']);

  // Start heartbeat reporting to backend
  startHeartbeat({ workerType: 'validator', intervalMs: 30000 });

  // Connect to services and initialize queues
  await initializeQueues();
  logger.info('Connected to RabbitMQ and queues initialized');

  // Test database connection
  const sql = getDb();
  await sql`SELECT 1`;
  logger.info('Connected to database');

  // Mark as idle while waiting for messages
  setIdle();

  // Start consuming draft validations
  await consumeQueue<DraftValidateMessage>(
    QUEUE_NAMES.DRAFTS_VALIDATE,
    async (message, ack, nack) => {
      try {
        await processValidation(message);
        recordSuccess();
        ack();
      } catch (error) {
        const err = error as Error;
        logger.error({ error: { message: err.message, stack: err.stack, name: err.name }, draftMarketId: message.draft_market_id }, 'Failed to validate draft');
        recordFailure(err.message);
        throw error;
      }
    }
  );

  logger.info('Validator worker started, waiting for messages...');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down validator worker');
    await stopHeartbeat();
    await closeQueue();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error({ error }, 'Validator worker failed to start');
  process.exit(1);
});
