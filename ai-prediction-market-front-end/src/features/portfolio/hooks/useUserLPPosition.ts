'use client';

import { useQuery } from '@tanstack/react-query';
import { useBlockchain } from '@/lib/blockchain';
import { marketKeys } from '@/features/markets/types';
import type { UserLPPosition } from '@/types';

export function useUserLPPosition(marketAddress: string) {
  const { adapter, address, isConnected } = useBlockchain();

  return useQuery({
    queryKey: [...marketKeys.detail(marketAddress), 'lpPosition', address],
    queryFn: async (): Promise<UserLPPosition | null> => {
      if (!address || !adapter.getUserLPPosition) return null;
      return adapter.getUserLPPosition(marketAddress, address);
    },
    enabled: isConnected && !!address && !!marketAddress,
    staleTime: 1000 * 10, // 10 seconds
  });
}
