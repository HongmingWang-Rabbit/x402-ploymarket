/**
 * Market-related constants
 */

/**
 * Market status values
 */
export const MARKET_STATUS = {
  /** Market is active and accepting trades */
  ACTIVE: 'active',
  /** Market is paused (no trading) */
  PAUSED: 'paused',
  /** Market has been resolved */
  RESOLVED: 'resolved',
} as const;

export type MarketStatusValue = (typeof MARKET_STATUS)[keyof typeof MARKET_STATUS];

/**
 * Market resolution outcomes
 */
export const RESOLUTION_OUTCOME = {
  YES: 'YES',
  NO: 'NO',
  INVALID: 'INVALID',
} as const;

export type ResolutionOutcome = (typeof RESOLUTION_OUTCOME)[keyof typeof RESOLUTION_OUTCOME];

/**
 * Maximum lengths for market fields
 */
export const MARKET_FIELD_LIMITS = {
  /** Maximum length for market question/title */
  QUESTION_LENGTH: 64,
  /** Maximum length for token symbol */
  TOKEN_SYMBOL_LENGTH: 10,
  /** Maximum length for market description */
  DESCRIPTION_LENGTH: 1000,
} as const;

/**
 * Dispute window duration in hours
 */
export const DISPUTE_WINDOW_HOURS = 24;

/**
 * Minimum market duration in hours
 */
export const MIN_MARKET_DURATION_HOURS = 1;

/**
 * Maximum market duration in days
 */
export const MAX_MARKET_DURATION_DAYS = 365;
