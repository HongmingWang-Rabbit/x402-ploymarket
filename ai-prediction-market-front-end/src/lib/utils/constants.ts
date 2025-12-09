// Application constants

export const APP_NAME = 'AI Prediction Market';

// Trading
export const DEFAULT_SLIPPAGE = 5; // 5%
export const MIN_SLIPPAGE = 0.1;
export const MAX_SLIPPAGE = 50;
export const MAX_TRADE_SIZE_PERCENT = 0.1; // 10% of pool reserve
export const TRANSACTION_DEADLINE_SECONDS = 300; // 5 minutes

// Market creation
export const MARKET_CREATION_FEE = 1.0; // USDC
export const DEFAULT_B_PARAMETER = 500;
export const MIN_B_PARAMETER = 1;
export const MAX_B_PARAMETER = 10000;
export const MAX_MARKET_QUESTION_LENGTH = 64;
export const MAX_TOKEN_SYMBOL_LENGTH = 10;
export const MIN_INITIAL_PROBABILITY = 20; // 20%
export const MAX_INITIAL_PROBABILITY = 80; // 80%

// Pagination
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

// Timeouts
export const TRANSACTION_TIMEOUT = 60000; // 60 seconds
export const API_TIMEOUT = 30000; // 30 seconds

// Decimals
export const USDC_DECIMALS = 6;
export const TOKEN_DECIMALS = 6;
export const DECIMAL_MULTIPLIER = 10 ** USDC_DECIMALS;

// Early exit penalty schedule (holding days -> penalty %)
export const EARLY_EXIT_PENALTIES = {
  TIER_1_DAYS: 7,
  TIER_1_PENALTY: 3.0,
  TIER_2_DAYS: 14,
  TIER_2_PENALTY: 1.5,
  TIER_3_DAYS: 30,
  TIER_3_PENALTY: 0.5,
} as const;

// Cache durations (in milliseconds)
export const CACHE_DURATIONS = {
  MARKETS_LIST: 5 * 60 * 1000, // 5 minutes
  MARKET_DETAIL: 30 * 1000, // 30 seconds
  USER_BALANCES: 10 * 1000, // 10 seconds
  ADMIN_DATA: 5 * 60 * 1000, // 5 minutes
} as const;

// Routes
export const ROUTES = {
  HOME: '/',
  MARKETS: '/markets',
  MARKET_DETAIL: (address: string) => `/markets/${address}`,
  CREATE_MARKET: '/markets/create',
  PORTFOLIO: '/portfolio',
  ADMIN: '/admin',
  ADMIN_INITIALIZE: '/admin/initialize',
} as const;

// External links
export const EXTERNAL_LINKS = {
  SOLANA_EXPLORER: (signature: string, network: string) =>
    `https://explorer.solana.com/tx/${signature}${network === 'devnet' ? '?cluster=devnet' : ''}`,
  SOLSCAN: (signature: string, network: string) =>
    `https://solscan.io/tx/${signature}${network === 'devnet' ? '?cluster=devnet' : ''}`,
} as const;
