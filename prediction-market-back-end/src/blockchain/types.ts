// Blockchain abstraction types
// This allows for future multi-chain support

export type ChainType = 'solana' | 'evm' | 'sui' | 'aptos';

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
  totalLiquidity: number;
  yesPrice: number;
  noPrice: number;
  createdAt: number;
}

export type MarketStatus = 'active' | 'paused' | 'resolved';

export interface TransactionResult {
  signature: string;
  success: boolean;
  blockNumber?: number;
}

export interface CreateMarketParams {
  name: string;
  metadataUri: string;
  bParameter: number;
  creatorAddress?: string;
}

export interface QuoteParams {
  marketAddress: string;
  tokenType: 'yes' | 'no';
  amount: number;
  direction: 'buy' | 'sell';
}

export interface QuoteResult {
  inputAmount: number;
  outputAmount: number;
  price: number;
  priceImpact: number;
  fee: number;
}

export interface SwapParams {
  marketAddress: string;
  direction: 'buy' | 'sell';
  tokenType: 'yes' | 'no';
  amount: number;
  slippage: number;
  userAddress: string;
}

export interface MintRedeemParams {
  marketAddress: string;
  amount: number;
  userAddress: string;
}

export interface AddLiquidityParams {
  marketAddress: string;
  amount: number;
  userAddress: string;
}

export interface WithdrawLiquidityParams {
  marketAddress: string;
  lpAmount: number;
  userAddress: string;
}

// Blockchain adapter interface for future multi-chain support
export interface IBlockchainAdapter {
  readonly chain: ChainType;

  // Markets
  getMarkets(limit?: number, offset?: number): Promise<Market[]>;
  getMarketsCount(): Promise<number>;
  getMarket(address: string): Promise<Market | null>;
  createMarket(params: CreateMarketParams): Promise<TransactionResult>;

  // Trading
  swap(params: SwapParams): Promise<TransactionResult>;
  mintCompleteSet(params: MintRedeemParams): Promise<TransactionResult>;
  redeemCompleteSet(params: MintRedeemParams): Promise<TransactionResult>;

  // Liquidity
  addLiquidity(params: AddLiquidityParams): Promise<TransactionResult>;
  withdrawLiquidity(params: WithdrawLiquidityParams): Promise<TransactionResult>;
}
