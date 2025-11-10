import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

/**
 * Market outcome types
 */
export enum MarketOutcome {
  Invalid = 0,
  Yes = 1,
  No = 2,
}

/**
 * Market status
 */
export enum MarketStatus {
  Active = 0,
  Paused = 1,
  Resolved = 2,
}

/**
 * Trade direction
 */
export enum TradeDirection {
  Buy = 0,
  Sell = 1,
}

/**
 * Token type (matches contract enum)
 */
export enum TokenType {
  No = 0,   // Contract has NO as 0
  Yes = 1,  // Contract has YES as 1
}

/**
 * Market data structure
 */
export interface Market {
  yesTokenMint: PublicKey;  // was yesToken
  noTokenMint: PublicKey;   // was noToken
  creator: PublicKey;
  totalCollateralLocked: BN;
  totalYesMinted: BN;
  totalNoMinted: BN;
  poolCollateralReserve: BN;
  poolYesReserve: BN;  // was yesReserve
  poolNoReserve: BN;   // was noReserve
  totalLpShares: BN;   // was lpShares
  lmsrB: BN;
  lmsrQYes: BN;
  lmsrQNo: BN;
  initialYesTokenReserves: BN;
  realYesTokenReserves: BN;
  realYesSolReserves: BN;
  tokenYesTotalSupply: BN;
  initialNoTokenReserves: BN;
  realNoTokenReserves: BN;
  realNoSolReserves: BN;
  tokenNoTotalSupply: BN;
  isCompleted: boolean;
  startSlot: BN | null;
  endingSlot: BN | null;
  resolutionYesRatio: BN;
  resolutionNoRatio: BN;
  winnerTokenType: number;
  swapInProgress: boolean;
  addLiquidityInProgress: boolean;
  accumulatedLpFees: BN;
  feePerShareCumulative: BN;
  poolSettled: boolean;
  displayName: string;
  withdrawInProgress: boolean;
  claimInProgress: boolean;
  initialYesProb: number;
  createdAt: BN;
  insurancePoolContribution: BN;
  circuitBreakerActive: boolean;
  circuitBreakerTriggeredAt: BN;
  withdrawLast24h: BN;
  withdrawTrackingStart: BN;
  initialYesReserve: BN;
  initialNoReserve: BN;
  hasFeeOverride: boolean;
  platformBuyFeeOverride: BN;
  platformSellFeeOverride: BN;
  lpBuyFeeOverride: BN;
  lpSellFeeOverride: BN;
  marketPaused: boolean;
  sentinelNoMinted: boolean;

  // Legacy aliases for backwards compatibility
  yesToken?: PublicKey;
  noToken?: PublicKey;
  yesReserve?: BN;
  noReserve?: BN;
  lpShares?: BN;
  status?: MarketStatus;
  outcome?: MarketOutcome;
  usdcMint?: PublicKey;
}

/**
 * Global config structure
 */
export interface Config {
  authority: PublicKey;
  pendingAuthority: PublicKey;
  teamWallet: PublicKey;
  platformBuyFee: BN;
  platformSellFee: BN;
  lpBuyFee: BN;
  lpSellFee: BN;
  tokenSupplyConfig: BN;
  tokenDecimalsConfig: number;
  initialRealTokenReservesConfig: BN;
  minSolLiquidity: BN;
  minTradingLiquidity: BN;
  initialized: boolean;
  isPaused: boolean;
  whitelistEnabled: boolean;
  usdcMint: PublicKey;
  usdcVaultMinBalance: BN;
  minUsdcLiquidity: BN;
  lpInsurancePoolBalance: BN;
  lpInsuranceAllocationBps: number;
  insuranceLossThresholdBps: number;
  insuranceMaxCompensationBps: number;
  insurancePoolEnabled: boolean;
}

/**
 * User position info
 */
export interface UserInfo {
  market: PublicKey;
  user: PublicKey;
  yesAmount: BN;
  noAmount: BN;
  lpShares: BN;
  realizedPnl: BN;
}

/**
 * LP Position info
 */
export interface LPPosition {
  market: PublicKey;
  owner: PublicKey;
  lpShares: BN;
  depositTime: BN;
  initialUsdcValue: BN;
}

/**
 * Market creation parameters
 */
export interface CreateMarketParams {
  yesSymbol: string;
  yesUri: string;
  startSlot?: number;
  endingSlot?: number;
  lmsrB?: number;
}

/**
 * Swap parameters
 */
export interface SwapParams {
  market: PublicKey;
  tokenType: TokenType;
  direction: TradeDirection;
  amount: number; // in USDC
  minOutput?: number; // slippage protection
  recipient?: PublicKey; // Optional: recipient address (defaults to wallet.publicKey)
}

/**
 * Add liquidity parameters
 */
export interface AddLiquidityParams {
  market: PublicKey;
  usdcAmount: number;
}

/**
 * Withdraw liquidity parameters
 */
export interface WithdrawLiquidityParams {
  market: PublicKey;
  lpSharesAmount: number;
}

/**
 * Mint complete set parameters
 */
export interface MintCompleteSetParams {
  market: PublicKey;
  usdcAmount: number;
}

/**
 * Redeem complete set parameters
 */
export interface RedeemCompleteSetParams {
  market: PublicKey;
  amount: number; // number of sets to redeem
}

/**
 * Market statistics
 */
export interface MarketStats {
  totalLiquidity: number; // in USDC
  yesPrice: number; // percentage 0-100
  noPrice: number; // percentage 0-100
  volume24h: number; // in USDC
  totalVolume: number; // in USDC
  tvl: number; // total value locked in USDC
}

/**
 * Transaction result
 */
export interface TransactionResult {
  signature: string;
  success: boolean;
  error?: string;
}

/**
 * Market list item (for UI display)
 */
export interface MarketListItem {
  address: PublicKey;
  question: string;
  yesPrice: number;
  noPrice: number;
  totalLiquidity: number;
  volume: number;
  endDate: Date;
  status: MarketStatus;
  outcome?: MarketOutcome;
}

// Re-export for convenience
export type { PredictionMarket } from './prediction_market';
