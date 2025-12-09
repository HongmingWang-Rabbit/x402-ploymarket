/**
 * Cache duration constants (in milliseconds)
 */

/**
 * Cache durations for different data types
 */
export const CACHE_DURATIONS = {
  /** Markets list cache: 5 minutes */
  MARKETS_LIST: 5 * 60 * 1000,
  /** Single market detail cache: 30 seconds */
  MARKET_DETAIL: 30 * 1000,
  /** User balances cache: 10 seconds */
  USER_BALANCES: 10 * 1000,
  /** Admin data cache: 5 minutes */
  ADMIN_DATA: 5 * 60 * 1000,
  /** Config data cache: 10 minutes */
  CONFIG: 10 * 60 * 1000,
} as const;

/**
 * Stale time for React Query (in milliseconds)
 */
export const STALE_TIMES = {
  /** Markets are considered stale after 1 minute */
  MARKETS: 60 * 1000,
  /** User data is considered stale after 30 seconds */
  USER_DATA: 30 * 1000,
  /** Static config never goes stale */
  STATIC: Infinity,
} as const;
