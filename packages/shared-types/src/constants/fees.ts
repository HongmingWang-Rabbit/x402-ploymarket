/**
 * Fee and pricing constants
 */

/**
 * x402 payment prices in USDC
 */
export const X402_PRICES = {
  /** Fee to create a new market */
  CREATE_MARKET: 1.0,
  /** Fee per swap transaction */
  SWAP: 0.01,
  /** Fee per mint transaction */
  MINT: 0.01,
  /** Fee per redeem transaction */
  REDEEM: 0.01,
} as const;

/**
 * Market creation fee in USDC
 */
export const MARKET_CREATION_FEE = 1.0;

/**
 * Early exit penalty tiers
 * Applied when withdrawing liquidity before expiry
 */
export const EARLY_EXIT_PENALTIES = {
  /** 0-7 days: 3% penalty */
  TIER_1: {
    maxDays: 7,
    penaltyPercent: 3,
  },
  /** 7-14 days: 1.5% penalty */
  TIER_2: {
    maxDays: 14,
    penaltyPercent: 1.5,
  },
  /** 14-30 days: 0.5% penalty */
  TIER_3: {
    maxDays: 30,
    penaltyPercent: 0.5,
  },
  /** 30+ days: no penalty */
  TIER_4: {
    maxDays: Infinity,
    penaltyPercent: 0,
  },
} as const;

/**
 * Protocol fee percentage (if applicable)
 */
export const PROTOCOL_FEE_PERCENT = 0;
