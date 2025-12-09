/**
 * API request/response types
 */

import { MarketCategory, ResolutionRules, ValidationDecision } from './market';

// ============================================================================
// Common Response Types
// ============================================================================

export interface ApiMeta {
  request_id: string;
  timestamp: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiPaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    has_more: boolean;
    next_cursor: string | null;
  };
  meta: ApiMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================================
// Proposal API
// ============================================================================

export interface ProposeRequest {
  proposal_text: string;
  category_hint?: MarketCategory;
}

export interface ProposeResponseData {
  proposal_id: string;
  status: string;
  existing_market: {
    id: string;
    market_address: string;
    title: string;
    similarity_score: number;
  } | null;
  draft_market: {
    id: string;
    title: string;
    description: string;
    category: MarketCategory;
    confidence_score: number;
    resolution: ResolutionRules;
  } | null;
  validation_status: string | null;
  rules_summary: {
    must_meet_all: string[];
    must_not_count: string[];
    allowed_sources: string[];
  } | null;
}

// ============================================================================
// Dispute API
// ============================================================================

export interface DisputeRequest {
  market_address: string;
  reason: string;
  evidence_urls?: string[];
}

export interface DisputeResponseData {
  dispute_id: string;
  status: string;
  market_address: string;
  created_at: string;
  estimated_review_time: string;
}

// ============================================================================
// Admin API
// ============================================================================

export interface IngestNewsRequest {
  source: string;
  url: string;
  title: string;
  content: string;
  published_at: string;
}

export interface ReviewProposalRequest {
  decision: 'approve' | 'reject';
  modifications?: {
    title?: string;
    resolution?: Partial<ResolutionRules>;
  };
  reason: string;
}

export interface ReviewDisputeRequest {
  decision: 'uphold' | 'overturn';
  new_result?: 'YES' | 'NO';
  reason: string;
}

export interface AIConfigData {
  ai_version: string;
  llm_model: string;
  validation_confidence_threshold: number;
  categories: MarketCategory[];
  rate_limits: {
    propose_per_minute: number;
    propose_per_hour: number;
    propose_per_day: number;
    dispute_per_hour: number;
    dispute_per_day: number;
  };
  dispute_window_hours: number;
  max_retries: number;
  updated_at: string;
}

export interface UpdateAIConfigRequest {
  ai_version?: string;
  llm_model?: string;
  validation_confidence_threshold?: number;
  rate_limits?: Partial<AIConfigData['rate_limits']>;
  dispute_window_hours?: number;
  max_retries?: number;
}

// ============================================================================
// Worker API
// ============================================================================

export interface WorkerTokenRequest {
  // Headers: X-Worker-API-Key, X-Worker-Type
}

export interface WorkerTokenResponseData {
  token: string;
  expires_at: string;
  worker_type: string;
  permissions: string[];
}

export interface ReportDraftRequest {
  candidate_id: string;
  draft_market: {
    title: string;
    description: string;
    category: MarketCategory;
    confidence_score: number;
    resolution: ResolutionRules;
  };
  llm_request_id: string;
}

export interface ReportValidationRequest {
  draft_market_id: string;
  decision: 'approved' | 'rejected' | 'needs_human';
  reason: string;
  evidence: string[];
  llm_request_id: string;
}

export interface ReportPublishedRequest {
  market_address: string;
  tx_signature: string;
  initial_liquidity_usdc?: number;
}

export interface ReportResolutionRequest {
  market_id: string;
  market_address: string;
  final_result: 'YES' | 'NO';
  resolution_source: string;
  evidence_hash: string;
  evidence_raw: string;
  must_meet_all_results: Array<{
    condition: string;
    met: boolean;
    evidence: string;
  }>;
  must_not_count_results: Array<{
    condition: string;
    triggered: boolean;
  }>;
  tx_signature: string;
  llm_request_id: string;
}

export interface ReportDisputeReviewRequest {
  decision: 'upheld' | 'overturned' | 'escalate';
  reasoning: string;
  llm_request_id: string;
}

// ============================================================================
// Audit Types
// ============================================================================

export type AuditAction =
  | 'proposal_submitted'
  | 'draft_generated'
  | 'validation_completed'
  | 'market_published'
  | 'resolution_started'
  | 'resolution_completed'
  | 'dispute_submitted'
  | 'dispute_resolved'
  | 'admin_action'
  | 'config_updated';

export type AuditEntityType = 'proposal' | 'market' | 'resolution' | 'dispute' | 'config';

export interface AuditLog {
  id: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  actor: string;
  details: Record<string, unknown>;
  ai_version?: string;
  llm_request_id?: string;
  created_at: string;
}

// ============================================================================
// AI Config (Database)
// ============================================================================

export interface AIConfigRecord {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  updated_by: string;
}

// ============================================================================
// Error Codes
// ============================================================================

export const ERROR_CODES = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_EVIDENCE: 'invalid_evidence',
  UNSAFE_CONTENT: 'unsafe_content',
  UNAUTHORIZED: 'unauthorized',
  INVALID_API_KEY: 'invalid_api_key',
  TOKEN_EXPIRED: 'token_expired',
  FORBIDDEN: 'forbidden',
  NOT_PARTICIPANT: 'not_participant',
  NOT_FOUND: 'not_found',
  DUPLICATE_CONTENT: 'duplicate_content',
  DISPUTE_WINDOW_CLOSED: 'dispute_window_closed',
  ALREADY_RESOLVED: 'already_resolved',
  UNPROCESSABLE_ENTITY: 'unprocessable_entity',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  INTERNAL_ERROR: 'internal_error',
  LLM_ERROR: 'llm_error',
  SERVICE_UNAVAILABLE: 'service_unavailable',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
