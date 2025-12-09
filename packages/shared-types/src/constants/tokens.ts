/**
 * Token-related constants
 */

/**
 * USDC token decimals
 */
export const USDC_DECIMALS = 6;

/**
 * Prediction market token decimals (YES/NO tokens)
 */
export const TOKEN_DECIMALS = 6;

/**
 * Decimal multiplier for token amounts
 * Used for converting between UI amounts and on-chain amounts
 */
export const DECIMAL_MULTIPLIER = 10 ** TOKEN_DECIMALS;

/**
 * Minimum trade amount in USDC (UI units)
 */
export const MIN_TRADE_AMOUNT = 0.01;

/**
 * Maximum trade amount in USDC (UI units)
 */
export const MAX_TRADE_AMOUNT = 1_000_000;

/**
 * Minimum liquidity deposit in USDC (UI units)
 */
export const MIN_LIQUIDITY_AMOUNT = 1;

/**
 * Convert UI amount to on-chain amount
 */
export function toOnChainAmount(uiAmount: number): bigint {
  return BigInt(Math.floor(uiAmount * DECIMAL_MULTIPLIER));
}

/**
 * Convert on-chain amount to UI amount
 */
export function toUiAmount(onChainAmount: bigint | number): number {
  return Number(onChainAmount) / DECIMAL_MULTIPLIER;
}
