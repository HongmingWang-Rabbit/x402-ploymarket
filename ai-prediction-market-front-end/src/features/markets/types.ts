import type { Market, MarketMetadata, CreateMarketParams } from '@/types';

// Query keys for React Query
export const marketKeys = {
  all: ['markets'] as const,
  lists: () => [...marketKeys.all, 'list'] as const,
  list: (filters: { limit?: number; offset?: number }) =>
    [...marketKeys.lists(), filters] as const,
  details: () => [...marketKeys.all, 'detail'] as const,
  detail: (address: string) => [...marketKeys.details(), address] as const,
};

// Extended market with metadata
export interface MarketWithMetadata extends Market {
  metadata?: MarketMetadata;
}

// Create market form values
export interface CreateMarketFormValues {
  // Required contract fields
  question: string; // maps to display_name (max 64 chars)
  yesSymbol: string; // Token symbol for YES token (e.g., "YES-BTC")
  initialYesProb: number; // Initial YES probability (20-80%)

  // Optional contract fields
  startDate?: string; // Trading start date (converted to slot)
  endDate?: string; // Trading end date (converted to slot)

  // Metadata fields (bundled into JSON, URI auto-generated)
  description?: string;
  category?: string;
  resolutionSource?: string;
}

// Pagination state
export interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

export type { Market, MarketMetadata, CreateMarketParams };
