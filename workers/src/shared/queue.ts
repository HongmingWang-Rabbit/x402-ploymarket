import amqp from 'amqplib';
import type { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { env } from './env.js';
import { logger } from './logger.js';
import {
  QUEUE_NAMES,
  QueueName,
  NewsRawMessage,
  CandidateMessage,
  DraftValidateMessage,
  MarketPublishMessage,
  MarketResolveMessage,
  DisputeMessage,
  ConfigRefreshMessage,
} from '@x402/shared-types';

// Re-export for convenience
export {
  QUEUE_NAMES,
  type QueueName,
  type NewsRawMessage,
  type CandidateMessage,
  type DraftValidateMessage,
  type MarketPublishMessage,
  type MarketResolveMessage,
  type DisputeMessage,
  type ConfigRefreshMessage,
};

const EXCHANGE_NAME = 'prediction.market';
const RETRY_DELAYS = [1000, 5000, 30000]; // 1s, 5s, 30s

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

// Dead letter queue suffix
const DLQ_SUFFIX = '.dlq';

// Queue configurations
const QUEUE_CONFIGS: Record<QueueName, { durable: boolean; deadLetter: boolean }> = {
  [QUEUE_NAMES.NEWS_RAW]: { durable: true, deadLetter: true },
  [QUEUE_NAMES.CANDIDATES]: { durable: true, deadLetter: true },
  [QUEUE_NAMES.DRAFTS_VALIDATE]: { durable: true, deadLetter: true },
  [QUEUE_NAMES.MARKETS_PUBLISH]: { durable: true, deadLetter: true },
  [QUEUE_NAMES.MARKETS_RESOLVE]: { durable: true, deadLetter: true },
  [QUEUE_NAMES.DISPUTES]: { durable: true, deadLetter: true },
  [QUEUE_NAMES.CONFIG_REFRESH]: { durable: false, deadLetter: false },
};

/**
 * Connect to RabbitMQ
 */
export async function connectQueue(): Promise<void> {
  if (!env.RABBITMQ_URL) {
    throw new Error('RABBITMQ_URL is not configured');
  }

  const conn = await amqp.connect(env.RABBITMQ_URL);
  connection = conn;

  conn.on('error', (err: Error) => {
    logger.error({ err }, 'RabbitMQ connection error');
    connection = null;
    channel = null;
  });

  conn.on('close', () => {
    logger.warn('RabbitMQ connection closed');
    connection = null;
    channel = null;
  });

  channel = await conn.createChannel();
  await channel.prefetch(1);

  logger.info('RabbitMQ connected');
}

/**
 * Initialize queues and exchange
 */
export async function initializeQueues(): Promise<void> {
  await connectQueue();
  const ch = getChannel();

  // Create topic exchange
  await ch.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
  logger.info({ exchange: EXCHANGE_NAME }, 'Exchange created');

  // Create queues
  for (const [queueName, config] of Object.entries(QUEUE_CONFIGS)) {
    const queueOptions: amqp.Options.AssertQueue = {
      durable: config.durable,
    };

    // Set up dead letter queue if configured
    if (config.deadLetter) {
      const dlqName = `${queueName}${DLQ_SUFFIX}`;

      // Create DLQ first
      await ch.assertQueue(dlqName, { durable: true });
      await ch.bindQueue(dlqName, EXCHANGE_NAME, dlqName);

      // Configure main queue to use DLQ
      queueOptions.deadLetterExchange = EXCHANGE_NAME;
      queueOptions.deadLetterRoutingKey = dlqName;
    }

    // Create main queue
    await ch.assertQueue(queueName, queueOptions);
    await ch.bindQueue(queueName, EXCHANGE_NAME, queueName);

    logger.info({ queue: queueName, config }, 'Queue created');
  }

  logger.info('All queues initialized');
}

/**
 * Get channel (throws if not connected)
 */
function getChannel(): Channel {
  if (!channel) {
    throw new Error('RabbitMQ not connected. Call connectQueue() first.');
  }
  return channel;
}

/**
 * Publish message to queue
 */
export async function publishMessage<T>(
  queueName: QueueName,
  message: T,
  options?: { headers?: Record<string, unknown> }
): Promise<boolean> {
  const ch = getChannel();
  const content = Buffer.from(JSON.stringify(message));

  return ch.publish(EXCHANGE_NAME, queueName, content, {
    persistent: true,
    contentType: 'application/json',
    headers: options?.headers,
    timestamp: Date.now(),
  });
}

/**
 * Message handler type (with manual ack/nack control)
 */
export type MessageHandler<T> = (message: T, ack: () => void, nack: (requeue?: boolean) => void) => Promise<void>;

/**
 * Simple message handler type (auto ack on success, auto retry on failure)
 */
export type SimpleMessageHandler<T> = (message: T, msg: ConsumeMessage) => Promise<void>;

/**
 * Consume messages from queue with retry logic (manual ack/nack)
 */
export async function consumeQueue<T>(
  queueName: QueueName,
  handler: MessageHandler<T>
): Promise<string> {
  const ch = getChannel();

  const { consumerTag } = await ch.consume(queueName, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;

    const ack = () => ch.ack(msg);
    const nack = (requeue = false) => ch.nack(msg, false, requeue);

    try {
      const content = JSON.parse(msg.content.toString()) as T;
      logger.debug({ queue: queueName, retryCount }, 'Processing message');

      await handler(content, ack, nack);
    } catch (error) {
      const err = error as Error;
      logger.error({ queue: queueName, error: { message: err.message, stack: err.stack, name: err.name }, retryCount }, 'Message processing failed');

      if (retryCount < RETRY_DELAYS.length) {
        // Schedule retry
        const delay = RETRY_DELAYS[retryCount];
        logger.info({ queue: queueName, delay, nextRetry: retryCount + 1 }, 'Scheduling retry');

        setTimeout(async () => {
          try {
            const content = JSON.parse(msg.content.toString());
            await publishMessage(queueName, content, {
              headers: { 'x-retry-count': retryCount + 1 },
            });
          } catch (e) {
            logger.error({ error: e }, 'Failed to schedule retry');
          }
        }, delay);

        ch.ack(msg);
      } else {
        // Max retries exceeded - send to DLQ
        logger.warn({ queue: queueName }, 'Max retries exceeded, moving to DLQ');
        ch.reject(msg, false);
      }
    }
  });

  logger.info({ queue: queueName, consumerTag }, 'Consumer started');
  return consumerTag;
}

/**
 * Consume messages from queue with automatic ack/retry (simpler interface)
 */
export async function consumeMessages<T>(
  queueName: QueueName,
  handler: SimpleMessageHandler<T>,
  options?: { noAck?: boolean }
): Promise<string> {
  const ch = getChannel();

  const { consumerTag } = await ch.consume(
    queueName,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;

      try {
        const content = JSON.parse(msg.content.toString()) as T;
        logger.debug({ queue: queueName, content }, 'Processing message');

        await handler(content, msg);

        if (!options?.noAck) {
          ch.ack(msg);
        }
      } catch (error) {
        logger.error({ queue: queueName, error, retryCount }, 'Message processing failed');

        if (retryCount < RETRY_DELAYS.length) {
          // Retry with delay
          const delay = RETRY_DELAYS[retryCount];
          logger.info({ queue: queueName, delay, retryCount: retryCount + 1 }, 'Scheduling retry');

          // Republish with incremented retry count
          setTimeout(async () => {
            try {
              const content = JSON.parse(msg.content.toString());
              await publishMessage(queueName, content, {
                headers: { 'x-retry-count': retryCount + 1 },
              });
            } catch (e) {
              logger.error({ error: e }, 'Failed to schedule retry');
            }
          }, delay);

          ch.ack(msg);
        } else {
          // Max retries exceeded - reject to DLQ
          logger.warn({ queue: queueName }, 'Max retries exceeded, moving to DLQ');
          ch.reject(msg, false);
        }
      }
    },
    { noAck: options?.noAck ?? false }
  );

  logger.info({ queue: queueName, consumerTag }, 'Consumer started');
  return consumerTag;
}

/**
 * Close connection
 */
export async function closeQueue(): Promise<void> {
  if (channel) {
    await channel.close();
    channel = null;
  }
  if (connection) {
    await connection.close();
    connection = null;
  }
  logger.info('RabbitMQ connection closed');
}

// Convenience publish functions
export const publishNewsRaw = (msg: NewsRawMessage) =>
  publishMessage(QUEUE_NAMES.NEWS_RAW, msg);

export const publishCandidate = (msg: CandidateMessage) =>
  publishMessage(QUEUE_NAMES.CANDIDATES, msg);

export const publishDraftValidate = (msg: DraftValidateMessage) =>
  publishMessage(QUEUE_NAMES.DRAFTS_VALIDATE, msg);

export const publishMarketPublish = (msg: MarketPublishMessage) =>
  publishMessage(QUEUE_NAMES.MARKETS_PUBLISH, msg);

export const publishMarketResolve = (msg: MarketResolveMessage) =>
  publishMessage(QUEUE_NAMES.MARKETS_RESOLVE, msg);

export const publishDispute = (msg: DisputeMessage) =>
  publishMessage(QUEUE_NAMES.DISPUTES, msg);

export const publishConfigRefresh = (msg: ConfigRefreshMessage) =>
  publishMessage(QUEUE_NAMES.CONFIG_REFRESH, msg);
