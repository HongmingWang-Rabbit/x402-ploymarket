/**
 * Trading-related constants
 */

/**
 * Slippage tolerance settings (in percentage)
 */
export const SLIPPAGE = {
  /** Default slippage tolerance (5%) */
  DEFAULT: 5,
  /** Minimum allowed slippage (0.1%) */
  MIN: 0.1,
  /** Maximum allowed slippage (50%) */
  MAX: 50,
} as const;

/**
 * LMSR B-parameter settings
 * Controls market liquidity depth
 */
export const B_PARAMETER = {
  /** Default B parameter for new markets */
  DEFAULT: 500,
  /** Minimum B parameter */
  MIN: 1,
  /** Maximum B parameter */
  MAX: 10000,
} as const;

/**
 * Initial probability constraints (in percentage)
 */
export const INITIAL_PROBABILITY = {
  /** Minimum initial probability for YES outcome */
  MIN: 20,
  /** Maximum initial probability for YES outcome */
  MAX: 80,
  /** Default initial probability (50/50) */
  DEFAULT: 50,
} as const;

/**
 * Trade direction
 */
export const TRADE_DIRECTION = {
  BUY: 'buy',
  SELL: 'sell',
} as const;

export type TradeDirection = (typeof TRADE_DIRECTION)[keyof typeof TRADE_DIRECTION];

/**
 * Token types for prediction markets
 */
export const TOKEN_TYPE = {
  YES: 'yes',
  NO: 'no',
} as const;

export type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];
