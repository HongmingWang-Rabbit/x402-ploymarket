/**
 * Resolution and dispute-related types
 */

export type ResolutionStatus = 'pending' | 'resolved' | 'disputed' | 'finalized';

export type DisputeStatus = 'pending' | 'reviewing' | 'upheld' | 'overturned' | 'escalated';

export type ResolutionResult = 'YES' | 'NO';

export interface ConditionResult {
  condition: string;
  met: boolean;
  evidence: string;
}

export interface ExclusionResult {
  condition: string;
  triggered: boolean;
  evidence?: string;
}

export interface ResolutionRecord {
  id: string;
  market_id: string;
  market_address: string;
  final_result: ResolutionResult;
  resolution_source: string;
  evidence_hash: string;
  evidence_raw: string;
  must_meet_all_results: ConditionResult[];
  must_not_count_results: ExclusionResult[];
  status: ResolutionStatus;
  resolved_by: string;
  resolved_at: string;
  tx_signature?: string;
  dispute_window_ends: string;
  finalized_at?: string;
}

export interface AIReview {
  decision: 'upheld' | 'overturned' | 'escalate';
  reasoning: string;
  reviewed_at: string;
}

export interface AdminReview {
  decision: 'upheld' | 'overturned';
  reasoning: string;
  admin_id: string;
  reviewed_at: string;
}

export interface UserTokenBalance {
  yes: number;
  no: number;
}

export interface Dispute {
  id: string;
  resolution_id: string;
  market_address: string;
  user_address: string;
  user_token_balance: UserTokenBalance;
  reason: string;
  evidence_urls?: string[];
  status: DisputeStatus;
  ai_review?: AIReview;
  admin_review?: AdminReview;
  new_result?: ResolutionResult;
  created_at: string;
  resolved_at?: string;
}

export interface DisputeWithMarket extends Dispute {
  market_title?: string;
  original_result?: ResolutionResult;
}
