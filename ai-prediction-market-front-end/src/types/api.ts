export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiTransactionResult {
  signature: string;
  success: boolean;
}

// Market API types
export interface ListMarketsResponse {
  markets: import('./market').Market[];
  total: number;
  limit: number;
  offset: number;
}

export interface GetMarketResponse {
  market: import('./market').Market;
}

export interface CreateMarketRequest {
  yesSymbol: string;
  yesUri: string;
  displayName: string;
  initialYesProb: number;
  startSlot?: number;
  endingSlot?: number;
  creatorAddress?: string;
}

export interface CreateMarketResponse {
  signature: string;
  marketAddress: string;
}

// Trading API types
export interface SwapRequest {
  marketAddress: string;
  direction: 'buy' | 'sell';
  tokenType: 'yes' | 'no';
  amount: number;
  slippage?: number;
  userAddress: string;
}

export interface SwapResponse {
  signature: string;
  amountIn: number;
  amountOut: number;
}

export interface MintRedeemRequest {
  marketAddress: string;
  amount: number;
  userAddress: string;
}

export interface MintRedeemResponse {
  signature: string;
  amount: number;
}

// Liquidity API types
export interface AddLiquidityRequest {
  marketAddress: string;
  amount: number;
  userAddress: string;
}

export interface WithdrawLiquidityRequest {
  marketAddress: string;
  lpAmount: number;
  userAddress: string;
}

export interface LiquidityResponse {
  signature: string;
  lpTokens?: number;
  usdcAmount?: number;
}
