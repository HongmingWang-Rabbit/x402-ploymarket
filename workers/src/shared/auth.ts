/**
 * Worker Authentication Utilities
 *
 * Handles API key exchange and JWT token management for workers
 */

import { createHash } from 'crypto';
import { logger } from './logger.js';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

interface TokenResponse {
  token: string;
  expires_in: number;
  token_type: string;
}

interface AuthState {
  token: string | null;
  expiresAt: number;
}

// Token cache per worker type
const tokenCache: Map<string, AuthState> = new Map();

/**
 * Get authentication token for worker
 * Caches token and refreshes before expiry
 */
export async function getWorkerToken(workerType: string, apiKey: string): Promise<string> {
  const cached = tokenCache.get(workerType);

  // Return cached token if still valid (with 1 minute buffer)
  if (cached && cached.token && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  // Request new token
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/worker/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        worker_type: workerType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json() as { error?: { message?: string } };
      throw new Error(errorData.error?.message || `Authentication failed: ${response.status}`);
    }

    const result = await response.json() as { data: TokenResponse };
    const data: TokenResponse = result.data;

    // Cache the token
    tokenCache.set(workerType, {
      token: data.token,
      expiresAt: Date.now() + data.expires_in * 1000,
    });

    logger.info({ workerType }, 'Worker authenticated successfully');
    return data.token;
  } catch (error) {
    logger.error({ error, workerType }, 'Worker authentication failed');
    throw error;
  }
}

/**
 * Create authenticated headers for API requests
 */
export async function getAuthHeaders(
  workerType: string,
  apiKey: string
): Promise<Record<string, string>> {
  const token = await getWorkerToken(workerType, apiKey);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Clear cached token (e.g., on auth failure)
 */
export function clearTokenCache(workerType: string): void {
  tokenCache.delete(workerType);
}

/**
 * Hash API key for secure storage/comparison
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Generate a new random API key
 */
export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Worker API client with automatic authentication
 */
export class WorkerApiClient {
  private workerType: string;
  private apiKey: string;

  constructor(workerType: string, apiKey: string) {
    this.workerType = workerType;
    this.apiKey = apiKey;
  }

  /**
   * Make authenticated API request
   */
  async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: unknown;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body } = options;

    try {
      const headers = await getAuthHeaders(this.workerType, this.apiKey);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 401) {
        // Token expired, clear cache and retry once
        clearTokenCache(this.workerType);
        const newHeaders = await getAuthHeaders(this.workerType, this.apiKey);

        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          method,
          headers: newHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!retryResponse.ok) {
          const errorData = await retryResponse.json() as { error?: { message?: string } };
          throw new Error(errorData.error?.message || `Request failed: ${retryResponse.status}`);
        }

        const retryResult = await retryResponse.json() as { data: T };
        return retryResult.data;
      }

      if (!response.ok) {
        const errorData = await response.json() as { error?: { message?: string } };
        throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
      }

      const result = await response.json() as { data: T };
      return result.data;
    } catch (error) {
      logger.error({ error, endpoint, workerType: this.workerType }, 'Worker API request failed');
      throw error;
    }
  }

  /**
   * Report draft market creation
   */
  async reportDraft(params: {
    candidate_id?: string;
    proposal_id?: string;
    draft_market: {
      title: string;
      description: string;
      category: string;
      image_url?: string;
      resolution: {
        type: 'binary';
        exact_question: string;
        criteria: {
          must_meet_all: string[];
          must_not_count: string[];
          allowed_sources: Array<{
            name: string;
            url: string;
            method?: string;
            condition?: string;
          }>;
        };
        expiry: string;
      };
      confidence_score: number;
    };
    llm_request_id?: string;
  }): Promise<{ draft_market_id: string }> {
    return this.request('/api/v1/worker/drafts', {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Report validation decision
   */
  async reportValidation(params: {
    draft_market_id: string;
    decision: 'approved' | 'rejected' | 'needs_human';
    reason: string;
    evidence?: Record<string, unknown>;
    llm_request_id?: string;
  }): Promise<{ draft_market_id: string; decision: string; new_status: string }> {
    return this.request('/api/v1/worker/validations', {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Report market published on-chain
   */
  async reportPublished(
    draftMarketId: string,
    params: {
      market_address: string;
      tx_signature: string;
      initial_liquidity_usdc?: number;
    }
  ): Promise<{ draft_market_id: string; market_address: string }> {
    return this.request(`/api/v1/worker/markets/${draftMarketId}/published`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Report market resolution
   */
  async reportResolution(params: {
    market_id: string;
    market_address: string;
    final_result: 'YES' | 'NO';
    resolution_source: string;
    evidence_hash: string;
    evidence_raw: string;
    must_meet_all_results: Record<string, boolean>;
    must_not_count_results: Record<string, boolean>;
    tx_signature?: string;
    llm_request_id?: string;
  }): Promise<{ resolution_id: string; market_id: string; final_result: string }> {
    return this.request('/api/v1/worker/resolutions', {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Report dispute AI review
   */
  async reportDisputeReview(
    disputeId: string,
    params: {
      decision: 'upheld' | 'overturned' | 'escalate';
      new_result?: 'YES' | 'NO';
      reasoning: string;
      confidence?: number;
      llm_request_id?: string;
    }
  ): Promise<{ dispute_id: string; decision: string; new_status: string }> {
    return this.request(`/api/v1/worker/disputes/${disputeId}/review`, {
      method: 'POST',
      body: params,
    });
  }
}
