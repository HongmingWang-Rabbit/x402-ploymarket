/**
 * Publisher Worker
 *
 * Consumes: markets.publish queue
 * Produces: On-chain market creation
 *
 * Creates markets on the Solana blockchain for approved draft markets.
 * Single instance to ensure transaction ordering.
 */

import { Keypair } from '@solana/web3.js';
import {
  env,
  validateEnv,
  createWorkerLogger,
  getDb,
  closeDb,
  initializeQueues,
  closeQueue,
  consumeQueue,
  QUEUE_NAMES,
  type MarketPublishMessage,
  startHeartbeat,
  stopHeartbeat,
  recordSuccess,
  recordFailure,
  setIdle,
  isValidPrivateKey,
  getSolanaClient,
} from './shared/index.js';

// Override worker type
process.env.WORKER_TYPE = 'publisher';

const logger = createWorkerLogger('publisher');

/**
 * Get AI version from database config
 */
async function getAIVersion(): Promise<string> {
  const sql = getDb();
  const result = await sql`
    SELECT value FROM ai_config WHERE key = 'ai_version'
  `;
  // Value is stored as a plain string or JSON - handle both cases
  if (!result[0]?.value) return 'v1.0';
  try {
    return JSON.parse(result[0].value);
  } catch {
    return result[0].value;
  }
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
 * Generate YES/NO token metadata URI (can be expanded with IPFS in future)
 */
function generateMetadataUri(title: string, isYes: boolean): string {
  // For now, return a placeholder URI - in production, upload to IPFS/Arweave
  const type = isYes ? 'YES' : 'NO';
  return `https://api.polymarket.com/metadata/${type}/${encodeURIComponent(title)}`;
}

/**
 * Generate token symbol from market title
 */
function generateSymbol(title: string, isYes: boolean): string {
  // Create a short symbol from the title
  const prefix = title
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 6);
  return `${prefix}${isYes ? 'Y' : 'N'}`;
}

/**
 * Process market publishing
 */
async function processPublish(message: MarketPublishMessage): Promise<void> {
  const sql = getDb();
  const aiVersion = await getAIVersion();

  logger.info({ draftMarketId: message.draft_market_id }, 'Processing market publish');

  // Fetch draft market
  const market = await getDraftMarket(message.draft_market_id);
  if (!market) {
    logger.error({ draftMarketId: message.draft_market_id }, 'Draft market not found');
    return;
  }

  // Check if already published
  const [existing] = await sql`
    SELECT market_address FROM ai_markets WHERE id = ${message.draft_market_id}
  `;
  if (existing?.market_address) {
    logger.warn(
      { draftMarketId: message.draft_market_id, marketAddress: existing.market_address },
      'Market already published'
    );
    return;
  }

  // Check if in dry run mode (BEFORE initializing Solana)
  if (env.DRY_RUN) {
    // Generate a mock market address for dry run
    const mockMarketKeypair = Keypair.generate();
    const marketAddress = mockMarketKeypair.publicKey.toBase58();

    logger.info({ marketAddress }, 'DRY RUN: Would create market on-chain');

    // Update database with mock address
    await sql`
      UPDATE ai_markets
      SET
        market_address = ${marketAddress},
        status = 'active',
        published_at = NOW()
      WHERE id = ${message.draft_market_id}
    `;

    // Update proposal if applicable
    if (market.source_proposal_id) {
      await sql`
        UPDATE proposals
        SET status = 'published'
        WHERE id = ${market.source_proposal_id}
      `;
    }

    logger.info({ draftMarketId: message.draft_market_id, marketAddress }, 'Market published (dry run)');
    return;
  }

  // Create market on-chain using Solana client
  const solanaClient = getSolanaClient();

  // Prepare market parameters
  const title = market.title as string;
  const displayName = title.substring(0, 64); // Max 64 chars for display name
  const yesSymbol = generateSymbol(title, true);
  const noSymbol = generateSymbol(title, false);
  const yesUri = generateMetadataUri(title, true);
  const noUri = generateMetadataUri(title, false);

  logger.info(
    { draftMarketId: message.draft_market_id, displayName, yesSymbol, noSymbol },
    'Creating market on-chain'
  );

  try {
    // Create market on-chain
    const result = await solanaClient.createMarket({
      displayName,
      yesSymbol,
      yesUri,
      noSymbol,
      noUri,
      initialYesProb: 5000, // 50%
    });

    logger.info(
      {
        draftMarketId: message.draft_market_id,
        marketAddress: result.marketAddress,
        yesTokenMint: result.yesTokenMint,
        noTokenMint: result.noTokenMint,
        txSignature: result.txSignature,
      },
      'Market created on-chain successfully'
    );

    // Update database with market address
    await sql`
      UPDATE ai_markets
      SET
        market_address = ${result.marketAddress},
        yes_token_mint = ${result.yesTokenMint},
        no_token_mint = ${result.noTokenMint},
        status = 'active',
        published_at = NOW()
      WHERE id = ${message.draft_market_id}
    `;

    // Update proposal status if this came from a user proposal
    if (market.source_proposal_id) {
      await sql`
        UPDATE proposals
        SET status = 'published'
        WHERE id = ${market.source_proposal_id}
      `;
    }

    // Log audit
    await sql`
      INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, ai_version)
      VALUES (
        'market_published',
        'market',
        ${message.draft_market_id},
        'publisher',
        ${JSON.stringify({
          market_address: result.marketAddress,
          yes_token_mint: result.yesTokenMint,
          no_token_mint: result.noTokenMint,
          tx_signature: result.txSignature,
          title: market.title,
          expiry: market.resolution?.expiry,
        })},
        ${aiVersion}
      )
    `;

    logger.info(
      {
        draftMarketId: message.draft_market_id,
        marketAddress: result.marketAddress,
        txSignature: result.txSignature,
      },
      'Market published successfully'
    );
  } catch (error) {
    const err = error as Error;
    logger.error(
      { error: { message: err.message, stack: err.stack, name: err.name }, draftMarketId: message.draft_market_id },
      'Failed to create market on-chain'
    );
    throw error;
  }
}

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info('Starting publisher worker');

  // Validate required environment variables
  validateEnv(['DATABASE_URL', 'RABBITMQ_URL', 'SOLANA_RPC_URL', 'PROGRAM_ID']);

  // Start heartbeat reporting to backend
  startHeartbeat({ workerType: 'publisher', intervalMs: 30000 });

  // Check if private key is valid, otherwise use dry run mode
  if (!isValidPrivateKey()) {
    logger.warn('PUBLISHER_PRIVATE_KEY not set or invalid, running in DRY_RUN mode');
    process.env.DRY_RUN = 'true';
  } else {
    logger.info('PUBLISHER_PRIVATE_KEY validated, running in LIVE mode');
  }

  // Connect to services
  await initializeQueues();
  logger.info('Connected to RabbitMQ and queues initialized');

  // Test database connection
  const sql = getDb();
  await sql`SELECT 1`;
  logger.info('Connected to database');

  // Mark as idle while waiting for messages
  setIdle();

  // Start consuming market publish requests
  await consumeQueue<MarketPublishMessage>(
    QUEUE_NAMES.MARKETS_PUBLISH,
    async (message, ack, nack) => {
      try {
        await processPublish(message);
        recordSuccess();
        ack();
      } catch (error) {
        const err = error as Error;
        logger.error({ error: { message: err.message, stack: err.stack, name: err.name }, draftMarketId: message.draft_market_id }, 'Failed to publish market');
        recordFailure(err.message);
        throw error;
      }
    }
  );

  logger.info('Publisher worker started, waiting for messages...');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down publisher worker');
    await stopHeartbeat();
    await closeQueue();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error({ error }, 'Publisher worker failed to start');
  process.exit(1);
});
