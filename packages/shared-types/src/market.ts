/**
 * Market-related types for AI prediction markets
 */

export type MarketCategory =
  | 'politics'
  | 'product_launch'
  | 'finance'
  | 'sports'
  | 'entertainment'
  | 'technology'
  | 'misc';

export type MarketStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'resolving'
  | 'resolved'
  | 'finalized'
  | 'disputed'
  | 'canceled';

export type SourceMethod = 'html_scrape' | 'api_check' | 'social_post';

export interface AllowedSource {
  name: string;
  url: string;
  method: SourceMethod;
  condition: string;
  selector?: string;
  json_path?: string;
}

export interface MachineResolutionLogic {
  if: string;
  then: 'YES' | 'NO';
  else: 'YES' | 'NO';
}

export interface ResolutionCriteria {
  must_meet_all: string[];
  must_not_count: string[];
  allowed_sources: AllowedSource[];
  machine_resolution_logic: MachineResolutionLogic;
}

export interface ResolutionRules {
  type: 'binary';
  exact_question: string;
  criteria: ResolutionCriteria;
  expiry: string; // ISO 8601 datetime
}

export interface ValidationDecision {
  status: 'approved' | 'rejected' | 'needs_human';
  reason: string;
  evidence: string[];
  validated_at: string;
  validated_by: string;
  rules_summary: {
    must_meet_all: string[];
    must_not_count: string[];
    allowed_sources: string[];
  };
}

export interface AIMarketMetadata {
  id: string;
  market_address: string | null;
  title: string;
  description: string;
  category: MarketCategory;
  image_url?: string;
  ai_version: string;
  confidence_score: number;
  source_proposal_id?: string;
  source_news_id?: string;
  resolution: ResolutionRules;
  status: MarketStatus;
  validation_decision?: ValidationDecision;
  created_at: string;
  published_at?: string;
  resolved_at?: string;
  finalized_at?: string;
  created_by: string;
}

export interface OnChainMarketData {
  yes_price: number;
  no_price: number;
  total_liquidity_usdc: number;
  volume_24h_usdc: number;
  yes_token_supply?: number;
  no_token_supply?: number;
}

export interface MarketWithOnChain extends AIMarketMetadata {
  on_chain: OnChainMarketData | null;
}
