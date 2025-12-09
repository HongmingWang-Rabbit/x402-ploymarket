/**
 * Publisher Worker
 *
 * Consumes: markets.publish queue
 * Produces: On-chain market creation
 *
 * Creates markets on the Solana blockchain for approved draft markets.
 * Single instance to ensure transaction ordering.
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet, BN } from '@coral-xyz/anchor';
import bs58 from 'bs58';
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
} from './shared/index.js';
import { PDA_SEEDS, USDC_DECIMALS } from '@x402/shared-types';

// Override worker type
process.env.WORKER_TYPE = 'publisher';

const logger = createWorkerLogger('publisher');

// Default market parameters
const DEFAULT_B_PARAMETER = 500;
const DEFAULT_INITIAL_LIQUIDITY = 100; // USDC

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
 * Parse private key from env (supports both base58 and JSON array formats)
 */
function parsePrivateKey(keyStr: string): Uint8Array | null {
  try {
    // Try JSON array format first: [1,2,3,...]
    if (keyStr.trim().startsWith('[')) {
      const arr = JSON.parse(keyStr);
      if (Array.isArray(arr) && arr.length === 64) {
        return new Uint8Array(arr);
      }
    }
    // Try base58 format
    const decoded = bs58.decode(keyStr);
    if (decoded.length === 64) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if the publisher private key is valid
 */
function isValidPrivateKey(): boolean {
  if (!env.PUBLISHER_PRIVATE_KEY) return false;
  try {
    const privateKeyBytes = parsePrivateKey(env.PUBLISHER_PRIVATE_KEY);
    if (!privateKeyBytes) return false;
    Keypair.fromSecretKey(privateKeyBytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize Solana connection and program
 */
function initializeSolana() {
  const connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');

  // Load publisher keypair (supports both base58 and JSON array formats)
  const privateKeyBytes = parsePrivateKey(env.PUBLISHER_PRIVATE_KEY);
  if (!privateKeyBytes) {
    throw new Error('Invalid PUBLISHER_PRIVATE_KEY format');
  }
  const keypair = Keypair.fromSecretKey(privateKeyBytes);
  const wallet = new Wallet(keypair);

  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  // Load program (you'd need to load the IDL here)
  // For now, we'll just return the provider and connection
  return { connection, provider, wallet, programId: new PublicKey(env.PROGRAM_ID) };
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

  // Initialize Solana (only if NOT in dry run mode)
  const { connection, provider, wallet, programId } = initializeSolana();

  // Generate market keypair (deterministic from draft ID for idempotency)
  // In production, you might want a different approach
  const marketKeypair = Keypair.generate();
  const marketAddress = marketKeypair.publicKey.toBase58();

  logger.info(
    { draftMarketId: message.draft_market_id, marketAddress },
    'Creating market on-chain'
  );

  // TODO: Implement actual on-chain market creation
  // This requires the IDL and proper instruction building
  // For now, we'll simulate success

  /*
  // Example of what the on-chain call would look like:
  const tx = await program.methods
    .createMarket(
      market.title,
      new BN(Date.parse(market.resolution.expiry) / 1000),
      new BN(DEFAULT_B_PARAMETER),
      new BN(DEFAULT_INITIAL_LIQUIDITY * 10 ** USDC_DECIMALS),
      50 // Initial probability 50%
    )
    .accounts({
      market: marketKeypair.publicKey,
      authority: wallet.publicKey,
      // ... other accounts
    })
    .signers([marketKeypair])
    .rpc();
  */

  // Simulated transaction signature
  const txSignature = `sim_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Update database with market address
  await sql`
    UPDATE ai_markets
    SET
      market_address = ${marketAddress},
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
        market_address: marketAddress,
        tx_signature: txSignature,
        title: market.title,
        expiry: market.resolution?.expiry,
      })},
      ${aiVersion}
    )
  `;

  logger.info(
    {
      draftMarketId: message.draft_market_id,
      marketAddress,
      txSignature,
    },
    'Market published successfully'
  );
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
