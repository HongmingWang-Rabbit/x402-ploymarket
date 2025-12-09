export * from './market';
export * from './api';

// Re-export blockchain types
export type { CreateMarketParams, TransactionResult } from '@/lib/blockchain/types';

// Blockchain types
export type ChainType = 'solana' | 'evm' | 'sui' | 'aptos';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainType: ChainType;
}

// UI types
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}
