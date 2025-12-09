export type MarketStatus = 'active' | 'paused' | 'resolved';

export interface Market {
  address: string;
  name: string;
  metadataUri: string;
  creator: string;
  yesMint: string;
  noMint: string;
  collateralVault: string;
  status: MarketStatus;
  bParameter: number;
  // Liquidity breakdown
  totalLiquidity: number; // USDC collateral reserve (pool_collateral_reserve)
  poolYesReserve: number; // YES tokens held by pool
  poolNoReserve: number; // NO tokens held by pool
  totalLpShares: number; // Total LP shares issued
  // Calculated total pool value (USDC + YES value + NO value)
  totalPoolValue: number;
  // Prices
  yesPrice: number;
  noPrice: number;
  createdAt: number;
}

export interface MarketMetadata {
  question: string;
  description?: string;
  category?: string;
  resolutionSource?: string;
  resolutionDate?: string;
  imageUrl?: string;
}

export interface UserPosition {
  marketAddress: string;
  yesBalance: number;
  noBalance: number;
  lpBalance: number;
  realizedPnl: number;
}

export interface UserLPPosition {
  marketAddress: string;
  userAddress: string;
  lpShares: number;
  investedUsdc: number;
  // Calculated fields
  sharePercentage: number; // % of total pool owned
  estimatedValue: number; // Current value based on pool value
  unrealizedPnl: number; // estimatedValue - investedUsdc
  unrealizedPnlPercent: number; // PnL as percentage
  // Time-based info
  createdAt: number;
  lastAddAt: number;
  holdingDays: number;
  // Early exit penalty info
  earlyExitPenaltyPercent: number; // Current penalty rate based on holding period
}

export interface CreateMarketParams {
  name: string;
  metadataUri: string;
  bParameter: number;
}

export interface SwapParams {
  marketAddress: string;
  direction: 'buy' | 'sell';
  tokenType: 'yes' | 'no';
  amount: number;
  slippage?: number;
}

export interface MintRedeemParams {
  marketAddress: string;
  amount: number;
}

export interface AddLiquidityParams {
  marketAddress: string;
  amount: number;
}

export interface WithdrawLiquidityParams {
  marketAddress: string;
  lpAmount: number;
}
