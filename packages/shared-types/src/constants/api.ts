/**
 * API-related constants
 */

/**
 * API route paths
 */
export const API_ROUTES = {
  // Health
  HEALTH: '/health',
  READY: '/ready',

  // Markets
  MARKETS: '/api/markets',
  MARKET_BY_ADDRESS: '/api/markets/:address',
  MARKETS_SEARCH: '/api/markets/search',

  // Trading
  SWAP: '/api/trading/swap',
  MINT: '/api/trading/mint',
  REDEEM: '/api/trading/redeem',

  // Liquidity
  ADD_LIQUIDITY: '/api/liquidity/add',
  WITHDRAW_LIQUIDITY: '/api/liquidity/withdraw',

  // Portfolio
  PORTFOLIO: '/api/portfolio',
  POSITIONS: '/api/portfolio/positions',
  BALANCES: '/api/portfolio/balances',

  // Proposals
  PROPOSE: '/api/propose',
  PROPOSALS: '/api/proposals',
  PROPOSAL_BY_ID: '/api/proposals/:id',

  // Disputes
  DISPUTE: '/api/dispute',
  DISPUTES: '/api/disputes',
  DISPUTE_BY_ID: '/api/disputes/:id',

  // Admin
  ADMIN_CONFIG: '/api/admin/config',
  ADMIN_WHITELIST: '/api/admin/whitelist',
  ADMIN_PROPOSALS: '/api/admin/proposals',
  ADMIN_DISPUTES: '/api/admin/disputes',

  // Worker
  WORKER_TOKEN: '/api/worker/token',
  WORKER_DRAFT: '/api/worker/draft',
  WORKER_VALIDATION: '/api/worker/validation',
  WORKER_PUBLISHED: '/api/worker/published',
  WORKER_RESOLUTION: '/api/worker/resolution',
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Rate limit configurations
 */
export const RATE_LIMITS = {
  /** Proposals per minute */
  PROPOSE_PER_MINUTE: 5,
  /** Proposals per hour */
  PROPOSE_PER_HOUR: 20,
  /** Proposals per day */
  PROPOSE_PER_DAY: 50,
  /** Disputes per hour */
  DISPUTE_PER_HOUR: 3,
  /** Disputes per day */
  DISPUTE_PER_DAY: 10,
  /** General API requests per minute */
  API_PER_MINUTE: 100,
} as const;

/**
 * Request timeout in milliseconds
 */
export const REQUEST_TIMEOUT = 30_000;
