/**
 * Program Derived Address (PDA) seed constants
 * Used for deterministic account derivation on Solana
 */

export const PDA_SEEDS = {
  /** Global config account seed */
  CONFIG: 'config',
  /** Global state account seed */
  GLOBAL: 'global',
  /** Market account seed */
  MARKET: 'market',
  /** Market USDC vault seed */
  MARKET_USDC_VAULT: 'market_usdc_vault',
  /** User info account seed */
  USERINFO: 'userinfo',
  /** Metadata account seed */
  METADATA: 'metadata',
  /** Whitelist account seed */
  WHITELIST: 'whitelist',
  /** LP position account seed */
  LP_POSITION: 'lp_position',
} as const;

export type PdaSeed = (typeof PDA_SEEDS)[keyof typeof PDA_SEEDS];
