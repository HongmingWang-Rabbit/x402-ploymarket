// Export types
export type {
  ChainType,
  IBlockchainAdapter,
  TransactionResult,
  CreateMarketParams,
} from './types';

// Export Solana adapter
export { SolanaAdapter, getSolanaAdapter } from './solana/client';
export { solanaConfig } from './solana/config';

// Export adapter utilities
export { getAdapter, getAvailableChains, registerAdapter } from './adapters';

// Export provider and hooks
export { BlockchainProvider, useBlockchain, useIsConnected, useAddress } from './provider';
