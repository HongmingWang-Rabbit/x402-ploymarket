/**
 * Worker Heartbeat Client
 *
 * Sends periodic heartbeats to the backend API to report worker status.
 * This allows the admin panel to monitor worker health in real-time.
 */

import { env } from './env.js';
import { logger } from './logger.js';
import { randomUUID } from 'crypto';
import os from 'os';

// Instance ID is unique per worker process
const instanceId = randomUUID();
const hostname = os.hostname();
const pid = process.pid;

interface HeartbeatConfig {
  workerType: string;
  intervalMs?: number; // Default: 30 seconds
}

interface HeartbeatPayload {
  instance_id: string;
  status: 'starting' | 'running' | 'idle' | 'error' | 'stopped';
  messages_processed?: number;
  messages_failed?: number;
  current_queue_size?: number;
  last_error?: string;
  hostname?: string;
  pid?: number;
}

// Heartbeat state
let heartbeatInterval: NodeJS.Timeout | null = null;
let currentStatus: HeartbeatPayload['status'] = 'starting';
let messagesProcessed = 0;
let messagesFailed = 0;
let lastError: string | null = null;
let workerType = 'unknown';
let isEnabled = true;

/**
 * Send a heartbeat to the backend
 */
async function sendHeartbeat(): Promise<void> {
  const apiBaseUrl = env.API_BASE_URL;
  if (!apiBaseUrl) {
    logger.debug('API_BASE_URL not set, skipping heartbeat');
    return;
  }

  const payload: HeartbeatPayload = {
    instance_id: instanceId,
    status: currentStatus,
    messages_processed: messagesProcessed,
    messages_failed: messagesFailed,
    hostname,
    pid,
  };

  if (lastError) {
    payload.last_error = lastError;
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/api/v1/admin/workers/${workerType}/heartbeat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      const data = (await response.json()) as { data?: { enabled?: boolean } };
      // Check if worker should be disabled
      if (data.data && data.data.enabled === false) {
        logger.warn({ workerType }, 'Worker disabled via admin panel');
        isEnabled = false;
        // Optionally trigger graceful shutdown
      } else {
        isEnabled = true;
      }
      // Reset counters after successful report
      messagesProcessed = 0;
      messagesFailed = 0;
    } else {
      logger.debug(
        { status: response.status, workerType },
        'Failed to send heartbeat'
      );
    }
  } catch (error) {
    logger.debug({ error, workerType }, 'Error sending heartbeat');
  }
}

/**
 * Start sending periodic heartbeats
 */
export function startHeartbeat(config: HeartbeatConfig): void {
  workerType = config.workerType;
  const intervalMs = config.intervalMs || 30000; // Default 30 seconds

  logger.info(
    { workerType, instanceId, intervalMs },
    'Starting heartbeat'
  );

  // Send initial heartbeat
  sendHeartbeat();

  // Set up periodic heartbeat
  heartbeatInterval = setInterval(() => {
    sendHeartbeat();
  }, intervalMs);
}

/**
 * Stop sending heartbeats
 */
export async function stopHeartbeat(): Promise<void> {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Send final "stopped" heartbeat
  currentStatus = 'stopped';
  await sendHeartbeat();

  logger.info({ workerType, instanceId }, 'Heartbeat stopped');
}

/**
 * Update worker status
 */
export function setWorkerStatus(status: HeartbeatPayload['status']): void {
  currentStatus = status;
}

/**
 * Record a successfully processed message
 */
export function recordSuccess(): void {
  messagesProcessed++;
  currentStatus = 'running';
}

/**
 * Record a failed message
 */
export function recordFailure(error?: string): void {
  messagesFailed++;
  if (error) {
    lastError = error;
  }
  currentStatus = 'error';
}

/**
 * Set worker to idle status
 */
export function setIdle(): void {
  currentStatus = 'idle';
}

/**
 * Check if worker is enabled (from admin panel)
 */
export function isWorkerEnabled(): boolean {
  return isEnabled;
}

/**
 * Get the unique instance ID for this worker process
 */
export function getInstanceId(): string {
  return instanceId;
}
