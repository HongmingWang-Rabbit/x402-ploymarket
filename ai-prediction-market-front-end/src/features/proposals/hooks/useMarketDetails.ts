'use client';

import { useQuery } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface MarketResolution {
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
}

export interface ResolutionRecord {
  id: string;
  final_result: 'YES' | 'NO';
  resolution_source: string;
  evidence_hash: string;
  must_meet_all_results: Record<string, boolean>;
  must_not_count_results: Record<string, boolean>;
  status: string;
  resolved_by: string;
  resolved_at: string;
  tx_signature: string | null;
  dispute_window_ends: string;
  finalized_at: string | null;
}

export interface MarketDispute {
  id: string;
  user_address: string;
  reason: string;
  status: string;
  ai_review: {
    decision: string;
    confidence: number;
    reasoning: string;
  } | null;
  admin_review: {
    decision: string;
    reason: string;
    reviewed_by: string;
    reviewed_at: string;
  } | null;
  new_result: 'YES' | 'NO' | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AIMarketDetails {
  id: string;
  market_address: string | null;
  title: string;
  description: string;
  category: string;
  image_url: string | null;
  ai_version: string;
  confidence_score: number;
  resolution: MarketResolution;
  status: string;
  validation_decision: {
    status: string;
    reason: string;
    evidence?: Record<string, unknown>;
  } | null;
  created_at: string;
  published_at: string | null;
  resolved_at: string | null;
  finalized_at: string | null;
  source_news_id: string | null;
  source_proposal_id: string | null;
  resolution_record: ResolutionRecord | null;
  disputes: MarketDispute[];
}

async function fetchMarketDetails(address: string): Promise<AIMarketDetails> {
  const response = await fetch(`${API_BASE}/api/v1/markets/${address}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch market details');
  }

  const result = await response.json();
  return result.data;
}

export function useMarketDetails(marketAddress: string | undefined) {
  return useQuery({
    queryKey: ['ai-market', marketAddress],
    queryFn: () => fetchMarketDetails(marketAddress!),
    enabled: !!marketAddress,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}

export default useMarketDetails;
