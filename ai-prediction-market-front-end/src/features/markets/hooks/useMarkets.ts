import { useQuery } from '@tanstack/react-query';
import { marketKeys } from '../types';
import { fetchMarkets } from '../api';

interface UseMarketsOptions {
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

export function useMarkets(options: UseMarketsOptions = {}) {
  const { limit = 10, offset = 0, enabled = true } = options;

  return useQuery({
    queryKey: marketKeys.list({ limit, offset }),
    queryFn: () => fetchMarkets(limit, offset),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes - on-chain data doesn't change frequently
    gcTime: 1000 * 60 * 10, // 10 minutes cache
  });
}
