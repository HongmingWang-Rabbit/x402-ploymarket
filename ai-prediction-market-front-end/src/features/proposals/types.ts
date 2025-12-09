// Proposal types matching backend API

export type ProposalStatus =
  | 'pending'
  | 'processing'
  | 'matched'
  | 'draft_created'
  | 'approved'
  | 'rejected'
  | 'needs_human'
  | 'published';

export type MarketCategory =
  | 'politics'
  | 'product_launch'
  | 'finance'
  | 'sports'
  | 'entertainment'
  | 'technology'
  | 'misc';

export interface ResolutionCriteria {
  exact_question: string;
  expiry: string;
  criteria: {
    must_meet_all: string[];
    must_not_count: string[];
    allowed_sources: Array<{
      name: string;
      url: string;
      type: string;
    }>;
  };
}

export interface DraftMarket {
  id: string;
  title: string;
  description: string;
  category: MarketCategory;
  confidence_score: number;
  resolution: ResolutionCriteria;
  market_address?: string;
  validation_decision?: {
    status: string;
    reason: string;
    evidence: string[];
  };
}

export interface ExistingMarket {
  id: string;
  market_address: string;
  title: string;
  similarity_score: number;
}

export interface RulesSummary {
  must_meet_all: string[];
  must_not_count: string[];
  allowed_sources: string[];
}

export interface ProposeRequest {
  proposal_text: string;
  category_hint?: MarketCategory;
}

export interface ProposeResponse {
  proposal_id: string;
  status: ProposalStatus;
  existing_market: ExistingMarket | null;
  draft_market: DraftMarket | null;
  validation_status?: string;
  rules_summary?: RulesSummary;
}

export interface Proposal {
  id: string;
  proposal_text: string;
  category_hint?: MarketCategory;
  status: ProposalStatus;
  draft_market?: DraftMarket;
  created_at: string;
  processed_at?: string;
}

// Query key factory
export const proposalKeys = {
  all: ['proposals'] as const,
  lists: () => [...proposalKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...proposalKeys.lists(), filters] as const,
  details: () => [...proposalKeys.all, 'detail'] as const,
  detail: (id: string) => [...proposalKeys.details(), id] as const,
};
