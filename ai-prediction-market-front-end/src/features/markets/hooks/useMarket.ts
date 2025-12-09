import { useQuery } from '@tanstack/react-query';
import { marketKeys } from '../types';
import { fetchMarket } from '../api';

interface UseMarketOptions {
  enabled?: boolean;
}

export function useMarket(address: string, options: UseMarketOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: marketKeys.detail(address),
    queryFn: () => fetchMarket(address),
    enabled: enabled && !!address,
    staleTime: 1000 * 30, // 30 seconds
  });
}
