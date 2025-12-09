import { useQuery } from '@tanstack/react-query';
import { useBlockchain } from '@/lib/blockchain';
import type { UserPosition } from '@/types';

export const portfolioKeys = {
  all: ['portfolio'] as const,
  user: (address: string) => [...portfolioKeys.all, address] as const,
};

export function usePortfolio() {
  const { adapter, address, isConnected } = useBlockchain();

  return useQuery({
    queryKey: portfolioKeys.user(address || ''),
    queryFn: async (): Promise<UserPosition[]> => {
      if (!address) return [];
      return adapter.getUserPositions(address);
    },
    enabled: isConnected && !!address,
    staleTime: 1000 * 30, // 30 seconds
  });
}
