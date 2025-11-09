'use client';

import { useCallback } from 'react';
import { useSolanaWallet } from './useSolanaWallet';
import { BlockchainType, Wallet, EVMWallet, SolanaWallet } from '@/app/utils/wallet';
import { useAccount } from 'wagmi';
import { useChainType } from '@/app/providers';

/**
 * Options for the unified wallet hook
 */
export interface UseWalletOptions {
  defaultChainType?: BlockchainType;
}

/**
 * Return type for the unified wallet hook
 */
export interface UseWalletReturn {
  chainType: BlockchainType;
  evmWallet: EVMWallet;
  solanaWallet: SolanaWallet;
  activeWallet: Wallet;
  switchChainType: (type: BlockchainType) => void;
  isConnected: boolean;
  address: string | null;
}

/**
 * Unified wallet hook that manages both EVM and Solana wallets
 *
 * This hook provides a single interface to interact with both blockchain types,
 * allowing users to switch between them seamlessly.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     activeWallet,
 *     chainType,
 *     switchChainType,
 *     isConnected,
 *     address
 *   } = useWallet({ defaultChainType: BlockchainType.EVM });
 *
 *   const handleConnect = async () => {
 *     await activeWallet.connect();
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={() => switchChainType(BlockchainType.SOLANA)}>
 *         Switch to Solana
 *       </button>
 *       <button onClick={handleConnect}>Connect Wallet</button>
 *       {isConnected && <p>Connected: {address}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWallet(options?: UseWalletOptions): UseWalletReturn {
  // Use shared chainType from context
  const { chainType, setChainType } = useChainType();

  // EVM wallet via wagmi (works with Reown AppKit)
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const solanaWallet = useSolanaWallet();

  /**
   * Switch between blockchain types
   */
  const switchChainType = useCallback((type: BlockchainType) => {
    setChainType(type);
  }, [setChainType]);

  /**
   * Check if current chain is connected
   */
  const isConnected = chainType === BlockchainType.EVM
    ? evmConnected
    : solanaWallet.connectionState === 'connected';

  /**
   * Get active address based on chain type
   */
  const address = chainType === BlockchainType.EVM
    ? evmAddress || null
    : solanaWallet.address;

  // Create a minimal EVM wallet object for compatibility
  const evmWallet: EVMWallet = {
    chainType: BlockchainType.EVM,
    address: evmAddress || null,
    connectionState: evmConnected ? 'connected' : 'disconnected',
    // Other methods are handled by Reown AppKit directly
  } as EVMWallet;

  const activeWallet: Wallet = chainType === BlockchainType.EVM
    ? evmWallet
    : solanaWallet;

  return {
    chainType,
    evmWallet,
    solanaWallet,
    activeWallet,
    switchChainType,
    isConnected,
    address,
  };
}
