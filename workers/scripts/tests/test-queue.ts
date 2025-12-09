/**
 * Queue Tests
 *
 * Tests RabbitMQ connectivity and queue functionality:
 * - Connection test
 * - Queue existence
 * - Publish/consume cycle
 * - Dead letter queue setup
 */

import amqp from 'amqplib';
import path from 'path';
import { config } from 'dotenv';

// Load env from workers directory
config({ path: path.resolve(import.meta.dirname, '../../.env') });

interface TestResult {
  passed: boolean;
  error?: string;
}

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const EXCHANGE_NAME = 'prediction.market';

// Expected queues
const EXPECTED_QUEUES = [
  'news.raw',
  'candidates',
  'drafts.validate',
  'markets.publish',
  'markets.resolve',
  'disputes',
  'config.refresh',
];

export async function testQueue(): Promise<TestResult> {
  if (!RABBITMQ_URL) {
    console.log('  ⚠️  RABBITMQ_URL not set, skipping queue tests');
    return { passed: true };
  }

  let connection: amqp.ChannelModel | null = null;
  let channel: amqp.Channel | null = null;
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // Test 1: Connection
    console.log('  Testing RabbitMQ connection...');
    try {
      connection = await amqp.connect(RABBITMQ_URL);
      console.log('    ✅ RabbitMQ connection successful');
      passed++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ❌ RabbitMQ connection failed: ${msg}`);
      errors.push(`Connection: ${msg}`);
      failed++;
      return { passed: false, error: errors.join('; ') };
    }

    // Create channel
    channel = await connection.createChannel();

    // Test 2: Exchange existence
    console.log('\n  Testing exchange...');
    try {
      await channel.checkExchange(EXCHANGE_NAME);
      console.log(`    ✅ Exchange '${EXCHANGE_NAME}' exists`);
      passed++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ❌ Exchange '${EXCHANGE_NAME}' check failed: ${msg}`);
      errors.push(`Exchange: ${msg}`);
      failed++;

      // Recreate channel after checkExchange failure (channel gets closed)
      channel = await connection.createChannel();
    }

    // Test 3: Queue existence
    console.log('\n  Testing queues...');
    for (const queue of EXPECTED_QUEUES) {
      try {
        const result = await channel.checkQueue(queue);
        console.log(`    ✅ Queue '${queue}' exists (${result.messageCount} messages, ${result.consumerCount} consumers)`);
        passed++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`    ❌ Queue '${queue}' check failed: ${msg}`);
        errors.push(`Queue '${queue}': ${msg}`);
        failed++;

        // Recreate channel after checkQueue failure
        channel = await connection.createChannel();
      }
    }

    // Test 4: Dead letter queues
    console.log('\n  Testing dead letter queues...');
    const dlqQueues = EXPECTED_QUEUES.filter(q => q !== 'config.refresh').map(q => `${q}.dlq`);
    for (const dlq of dlqQueues) {
      try {
        const result = await channel.checkQueue(dlq);
        console.log(`    ✅ DLQ '${dlq}' exists (${result.messageCount} messages)`);
        passed++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`    ⚠️  DLQ '${dlq}' not found (may not be configured): ${msg}`);
        // DLQs are optional, don't count as failure

        // Recreate channel after checkQueue failure
        channel = await connection.createChannel();
      }
    }

    // Test 5: Publish test message
    console.log('\n  Testing publish/consume cycle...');
    const testQueue = 'test.queue.' + Date.now();
    try {
      // Create temporary test queue
      await channel.assertQueue(testQueue, { durable: false, autoDelete: true });
      console.log(`    ✅ Created test queue '${testQueue}'`);
      passed++;

      // Publish a message
      const testMessage = { test: true, timestamp: Date.now() };
      const published = channel.sendToQueue(
        testQueue,
        Buffer.from(JSON.stringify(testMessage)),
        { persistent: false }
      );

      if (published) {
        console.log('    ✅ Published test message');
        passed++;
      } else {
        console.log('    ❌ Failed to publish test message');
        errors.push('Publish failed');
        failed++;
      }

      // Consume the message
      const consumed = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 5000);

        channel!.consume(
          testQueue,
          (msg) => {
            if (msg) {
              clearTimeout(timeout);
              channel!.ack(msg);
              const content = JSON.parse(msg.content.toString());
              if (content.test === true) {
                resolve(true);
              } else {
                resolve(false);
              }
            }
          },
          { noAck: false }
        );
      });

      if (consumed) {
        console.log('    ✅ Consumed and verified test message');
        passed++;
      } else {
        console.log('    ❌ Failed to consume test message');
        errors.push('Consume failed');
        failed++;
      }

      // Delete test queue
      await channel.deleteQueue(testQueue);
      console.log(`    ✅ Deleted test queue`);
      passed++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ❌ Publish/consume test failed: ${msg}`);
      errors.push(`Publish/consume: ${msg}`);
      failed++;

      // Cleanup
      try {
        await channel?.deleteQueue(testQueue);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Test 6: Queue message counts
    console.log('\n  Queue message summary...');
    for (const queue of EXPECTED_QUEUES) {
      try {
        const result = await channel.checkQueue(queue);
        if (result.messageCount > 0) {
          console.log(`    📊 ${queue}: ${result.messageCount} pending messages`);
        }
      } catch {
        // Already reported, skip
        channel = await connection.createChannel();
      }
    }

    console.log(`\n  Results: ${passed} passed, ${failed} failed`);

    return {
      passed: failed === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { passed: false, error: msg };
  } finally {
    if (channel) {
      try {
        await channel.close();
      } catch {
        // Ignore close errors
      }
    }
    if (connection) {
      try {
        await connection.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}
