import type { ChainType, IBlockchainAdapter } from '../types';
import { getSolanaAdapter } from '../solana/client';

// Adapter registry for future multi-chain support
const adapterRegistry: Map<ChainType, () => IBlockchainAdapter> = new Map([
  ['solana', getSolanaAdapter],
  // Future chains can be added here:
  // ['evm', getEvmAdapter],
  // ['sui', getSuiAdapter],
]);

/**
 * Get a blockchain adapter by chain type
 */
export function getAdapter(chain: ChainType): IBlockchainAdapter | null {
  const factory = adapterRegistry.get(chain);
  return factory ? factory() : null;
}

/**
 * Get all available chain types
 */
export function getAvailableChains(): ChainType[] {
  return Array.from(adapterRegistry.keys());
}

/**
 * Register a new adapter (for plugin-based chain support)
 */
export function registerAdapter(
  chain: ChainType,
  factory: () => IBlockchainAdapter
) {
  adapterRegistry.set(chain, factory);
}

// Re-export types
export type { ChainType, IBlockchainAdapter } from '../types';
