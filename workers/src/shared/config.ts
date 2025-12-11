/**
 * Worker Configuration Manager
 *
 * Loads and caches AI configuration from the database
 */

import { getDb } from './db.js';
import { logger } from './logger.js';

export interface AIConfig {
  ai_version: string;
  llm_model: string;
  validation_confidence_threshold: number;
  categories: string[];
  rate_limits: {
    propose_per_minute: number;
    propose_per_hour: number;
    propose_per_day: number;
    dispute_per_hour: number;
    dispute_per_day: number;
    auto_publish_per_hour: number; // Limit for AI-generated markets (not user proposals)
  };
  dispute_window_hours: number;
  max_retries: number;
}

// Default configuration
const DEFAULT_CONFIG: AIConfig = {
  ai_version: 'v1.0',
  llm_model: 'gpt-4o-mini',
  validation_confidence_threshold: 0.7,
  categories: ['politics', 'product_launch', 'finance', 'sports', 'entertainment', 'technology', 'misc'],
  rate_limits: {
    propose_per_minute: 5,
    propose_per_hour: 20,
    propose_per_day: 50,
    dispute_per_hour: 3,
    dispute_per_day: 10,
    auto_publish_per_hour: 3, // Max AI-generated markets per hour (not user proposals)
  },
  dispute_window_hours: 24,
  max_retries: 3,
};

// Cache
let configCache: AIConfig | null = null;
let cacheExpiresAt: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load configuration from database
 */
async function loadConfigFromDb(): Promise<AIConfig> {
  const sql = getDb();

  const result = await sql`SELECT key, value FROM ai_config`;

  const config: Partial<AIConfig> = {};

  for (const row of result) {
    const key = row.key as keyof AIConfig;
    let value = row.value;

    // Handle JSON parsing if needed
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        // Value is already parsed or is a plain string
      }
    }

    (config as any)[key] = value;
  }

  // Merge with defaults
  return {
    ...DEFAULT_CONFIG,
    ...config,
  };
}

/**
 * Get AI configuration (with caching)
 */
export async function getConfig(): Promise<AIConfig> {
  const now = Date.now();

  if (configCache && cacheExpiresAt > now) {
    return configCache;
  }

  try {
    configCache = await loadConfigFromDb();
    cacheExpiresAt = now + CACHE_TTL_MS;
    logger.debug({ config: configCache }, 'Configuration loaded from database');
    return configCache;
  } catch (error) {
    logger.error({ error }, 'Failed to load configuration from database, using defaults');
    return DEFAULT_CONFIG;
  }
}

/**
 * Get a specific configuration value
 */
export async function getConfigValue<K extends keyof AIConfig>(key: K): Promise<AIConfig[K]> {
  const config = await getConfig();
  return config[key];
}

/**
 * Refresh configuration cache
 */
export function refreshConfig(): void {
  configCache = null;
  cacheExpiresAt = 0;
  logger.info('Configuration cache cleared');
}

/**
 * Get current AI version
 */
export async function getAIVersion(): Promise<string> {
  return getConfigValue('ai_version');
}

/**
 * Get LLM model to use
 */
export async function getLLMModel(): Promise<string> {
  return getConfigValue('llm_model');
}

/**
 * Get validation confidence threshold
 */
export async function getValidationThreshold(): Promise<number> {
  return getConfigValue('validation_confidence_threshold');
}

/**
 * Get max retries for operations
 */
export async function getMaxRetries(): Promise<number> {
  return getConfigValue('max_retries');
}

/**
 * Get dispute window duration in hours
 */
export async function getDisputeWindowHours(): Promise<number> {
  return getConfigValue('dispute_window_hours');
}

/**
 * Check if a category is valid
 */
export async function isValidCategory(category: string): Promise<boolean> {
  const categories = await getConfigValue('categories');
  return categories.includes(category);
}

/**
 * Get the number of auto-published markets in the last hour
 * (markets where source_proposal_id is NULL, meaning AI-generated not user-proposed)
 */
export async function getAutoPublishCountInLastHour(): Promise<number> {
  const sql = getDb();
  const result = await sql`
    SELECT COUNT(*) as count
    FROM ai_markets
    WHERE source_proposal_id IS NULL
      AND published_at >= NOW() - INTERVAL '1 hour'
      AND status = 'active'
  `;
  return parseInt(result[0]?.count || '0', 10);
}

/**
 * Get the auto-publish rate limit from config
 */
export async function getAutoPublishRateLimit(): Promise<number> {
  const config = await getConfig();
  return config.rate_limits.auto_publish_per_hour;
}

/**
 * Check if we can auto-publish a new market (not from user proposal)
 * Returns { allowed: boolean, currentCount: number, limit: number }
 */
export async function canAutoPublish(): Promise<{
  allowed: boolean;
  currentCount: number;
  limit: number;
}> {
  const [currentCount, limit] = await Promise.all([
    getAutoPublishCountInLastHour(),
    getAutoPublishRateLimit(),
  ]);

  return {
    allowed: currentCount < limit,
    currentCount,
    limit,
  };
}
