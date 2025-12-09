import type { Market, SwapParams, MintRedeemParams, AddLiquidityParams, WithdrawLiquidityParams } from '@/types';
import type { ChainType } from '@/config/env';

// Re-export ChainType from env for convenience
export type { ChainType } from '@/config/env';

// Transaction result
export interface TransactionResult {
  signature: string;
  success: boolean;
  error?: string;
  marketAddress?: string; // Set when creating a market
}

// Create market params (matches contract's CreateMarketParams struct)
export interface CreateMarketParams {
  yesSymbol: string; // Token symbol (e.g., "YES-BTC")
  yesUri: string; // Metadata URI
  displayName: string; // Market question (max 64 chars)
  initialYesProb: number; // Initial probability in basis points (2000-8000 = 20-80%)
  startSlot?: number; // Optional trading start slot
  endingSlot?: number; // Optional trading end slot
}

// Blockchain adapter interface
// Each chain implements this interface for consistent API
export interface IBlockchainAdapter {
  readonly chain: ChainType;

  // Connection state
  isConnected(): boolean;
  getAddress(): string | null;

  // Market operations (read-only, no wallet needed)
  getMarkets(limit?: number, offset?: number): Promise<Market[]>;
  getMarketsCount(): Promise<number>;
  getMarket(address: string): Promise<Market | null>;

  // Market operations (wallet required)
  createMarket(params: CreateMarketParams): Promise<TransactionResult>;

  // Fix market mint authority (for markets created before setMintAuthority fix)
  // Only market creator or admin can call this
  fixMarketMintAuthority?(marketAddress: string): Promise<TransactionResult>;

  // Trading operations
  swap(params: SwapParams): Promise<TransactionResult>;
  mintCompleteSet(params: MintRedeemParams): Promise<TransactionResult>;
  redeemCompleteSet(params: MintRedeemParams): Promise<TransactionResult>;

  // Liquidity operations
  addLiquidity(params: AddLiquidityParams): Promise<TransactionResult>;
  withdrawLiquidity(params: WithdrawLiquidityParams): Promise<TransactionResult>;

  // User data
  getUserPositions(userAddress: string): Promise<import('@/types').UserPosition[]>;
  getUserLPPosition?(marketAddress: string, userAddress: string): Promise<import('@/types').UserLPPosition | null>;
  getUserTokenBalances?(marketAddress: string, userAddress: string): Promise<{ yesBalance: number; noBalance: number } | null>;

  // Admin operations (optional - some chains may not support)
  getAuthority?(): Promise<string | null>;
  isWhitelisted?(address: string): Promise<boolean>;
}

// Factory function type for creating adapters
export type BlockchainAdapterFactory = () => IBlockchainAdapter;
