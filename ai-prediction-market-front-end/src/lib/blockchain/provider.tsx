'use client';

import { createContext, useContext, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { ChainType, IBlockchainAdapter } from './types';
import { getSolanaAdapter, SolanaAdapter } from './solana/client';
import { useContracts } from '@/features/config/hooks';
import { env } from '@/config';

interface BlockchainContextValue {
  adapter: IBlockchainAdapter;
  chain: ChainType;
  isConnected: boolean;
  address: string | null;
  invalidateContractsOnError: () => void;
}

const BlockchainContext = createContext<BlockchainContextValue | null>(null);

interface BlockchainProviderProps {
  children: ReactNode;
}

export function BlockchainProvider({ children }: BlockchainProviderProps) {
  const wallet = useWallet();
  const adapter = useMemo(() => getSolanaAdapter(), []);
  const { getCurrentContract, invalidateOnError } = useContracts();

  // Update adapter with wallet when it changes
  useEffect(() => {
    if (wallet && adapter instanceof SolanaAdapter) {
      adapter.setWallet(wallet);
    }
  }, [wallet, adapter]);

  // Update adapter config when contracts are fetched from backend
  useEffect(() => {
    const contract = getCurrentContract();
    if (contract && adapter instanceof SolanaAdapter) {
      adapter.updateConfig({
        programId: contract.programId,
        rpcUrl: contract.rpcUrl,
        usdcMint: contract.usdcMint,
      });
    }
  }, [getCurrentContract, adapter]);

  // Wrapper to invalidate contracts cache on error
  const invalidateContractsOnError = useCallback(() => {
    invalidateOnError();
  }, [invalidateOnError]);

  const value = useMemo<BlockchainContextValue>(() => ({
    adapter,
    chain: env.chain as ChainType,
    isConnected: adapter.isConnected(),
    address: adapter.getAddress(),
    invalidateContractsOnError,
  }), [adapter, wallet.connected, wallet.publicKey, invalidateContractsOnError]);

  return (
    <BlockchainContext.Provider value={value}>
      {children}
    </BlockchainContext.Provider>
  );
}

export function useBlockchain(): BlockchainContextValue {
  const context = useContext(BlockchainContext);
  if (!context) {
    throw new Error('useBlockchain must be used within a BlockchainProvider');
  }
  return context;
}

// Convenience hooks
export function useIsConnected(): boolean {
  const { isConnected } = useBlockchain();
  return isConnected;
}

export function useAddress(): string | null {
  const { address } = useBlockchain();
  return address;
}
