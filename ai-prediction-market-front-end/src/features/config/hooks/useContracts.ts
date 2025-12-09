'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ChainContract } from '@/lib/api/client';
import { env } from '@/config';
import { contractConfig } from '@/config';

// Fallback contracts if backend is unavailable - uses values from env/config
const FALLBACK_CONTRACTS: ChainContract[] = [
  {
    chainId: env.chainId,
    chainName: 'Solana',
    network: env.network,
    programId: env.programId,
    rpcUrl: env.solanaRpcUrl,
    explorerUrl: 'https://explorer.solana.com',
    usdcMint: contractConfig.usdcMint[env.network as keyof typeof contractConfig.usdcMint] || '',
    enabled: true,
  },
];

const CONTRACTS_QUERY_KEY = ['config', 'contracts'];

export function useContracts() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: CONTRACTS_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.getContracts();
      if (response.success && response.data?.contracts) {
        return response.data.contracts;
      }
      return FALLBACK_CONTRACTS;
    },
    staleTime: Infinity, // Cache forever - only refetch on error via invalidateOnError()
    gcTime: Infinity,
    retry: 1,
  });

  // Call this when a contract call fails - forces refetch
  const invalidateOnError = () => {
    queryClient.invalidateQueries({ queryKey: CONTRACTS_QUERY_KEY });
  };

  // Get contract for a specific chain
  const getContract = (chainId: string): ChainContract | undefined => {
    return (data || FALLBACK_CONTRACTS).find((c) => c.chainId === chainId);
  };

  // Get current active contract based on env.chainId
  const getCurrentContract = (): ChainContract | undefined => {
    return getContract(env.chainId);
  };

  return {
    contracts: data || FALLBACK_CONTRACTS,
    isLoading,
    error,
    refetch,
    invalidateOnError,
    getContract,
    getCurrentContract,
  };
}

// Hook to get a single contract by chain ID
export function useContract(chainId: string) {
  const { getContract, invalidateOnError, isLoading } = useContracts();

  return {
    contract: getContract(chainId),
    isLoading,
    invalidateOnError,
  };
}
