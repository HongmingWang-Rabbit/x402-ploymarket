'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { useBlockchain } from '@/lib/blockchain';

// Dev mode - bypass on-chain checks for development
const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV === 'true';

export function useIsAdmin() {
  const { publicKey, connected } = useWallet();
  const { adapter } = useBlockchain();
  const walletAddress = publicKey?.toBase58();

  // Fetch config to check if wallet is the contract authority (on-chain)
  const { data: authority, isLoading: isLoadingAuthority } = useQuery({
    queryKey: ['admin', 'authority'],
    queryFn: async () => {
      if (!adapter.getAuthority) return null;
      try {
        return await adapter.getAuthority();
      } catch (error) {
        console.error('Failed to fetch authority:', error);
        return null;
      }
    },
    enabled: connected && !!walletAddress && !IS_DEV_MODE && !!adapter.getAuthority,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Check if wallet is whitelisted for market creation (on-chain check)
  const { data: isOnChainWhitelisted, isLoading: isLoadingWhitelist } = useQuery({
    queryKey: ['admin', 'whitelist', walletAddress],
    queryFn: async () => {
      if (!walletAddress || !adapter.isWhitelisted) return false;

      try {
        return await adapter.isWhitelisted(walletAddress);
      } catch (error) {
        console.error('Failed to check whitelist:', error);
        return false;
      }
    },
    enabled: connected && !!walletAddress && !IS_DEV_MODE && !!adapter.isWhitelisted,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Dev mode bypasses all on-chain checks
  if (IS_DEV_MODE) {
    return {
      isAdmin: true,
      isWhitelisted: true,
      canCreateMarket: true,
      walletAddress,
      isLoading: false,
      isDevMode: true,
    };
  }

  // Production: all checks are purely on-chain
  const isAdmin = authority === walletAddress;
  const isWhitelisted = isOnChainWhitelisted || false;
  const isLoading = isLoadingAuthority || isLoadingWhitelist;

  return {
    isAdmin,
    isWhitelisted,
    canCreateMarket: isAdmin || isWhitelisted,
    walletAddress,
    isLoading,
    isDevMode: false,
  };
}
