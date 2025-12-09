/**
 * Proposal-related types for user-submitted market proposals
 */

import { MarketCategory } from './market';

export type ProposalStatus =
  | 'pending'
  | 'processing'
  | 'matched'
  | 'draft_created'
  | 'approved'
  | 'rejected'
  | 'needs_human'
  | 'published';

export type ValidationStatus = 'approved' | 'rejected' | 'needs_human';

export interface Proposal {
  id: string;
  user_id?: string;
  proposal_text: string;
  category_hint?: MarketCategory;
  status: ProposalStatus;
  matched_market_id?: string;
  draft_market_id?: string;
  confidence_score?: number;
  rejection_reason?: string;
  created_at: string;
  processed_at?: string;
  ip_address?: string;
}

export interface ProposalWithDraft extends Proposal {
  draft_market?: {
    id: string;
    title: string;
    confidence_score: number;
    resolution: unknown; // ResolutionRules - avoid circular import
  };
  validation_decision?: {
    status: ValidationStatus;
    reason: string;
    evidence: string[];
  };
}
