'use client';

import { useQuery } from '@tanstack/react-query';
import { useBlockchain } from '@/lib/blockchain';
import { marketKeys } from '@/features/markets/types';

export interface TokenBalances {
  yesBalance: number;
  noBalance: number;
}

export function useUserTokenBalances(marketAddress: string) {
  const { adapter, address, isConnected } = useBlockchain();

  return useQuery({
    queryKey: [...marketKeys.detail(marketAddress), 'tokenBalances', address],
    queryFn: async (): Promise<TokenBalances | null> => {
      if (!address || !adapter.getUserTokenBalances) return null;
      return adapter.getUserTokenBalances(marketAddress, address);
    },
    enabled: isConnected && !!address && !!marketAddress,
    staleTime: 1000 * 10, // 10 seconds - refresh frequently for trading
  });
}
