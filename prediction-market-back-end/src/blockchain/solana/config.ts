import { config } from '../../config/index.js';

export const solanaConfig = {
  rpcUrl: config.solana.rpcUrl,
  network: config.solana.network,
  programId: config.solana.programId,

  // USDC mints for different networks
  usdcMint: {
    devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  } as const,

  get currentUsdcMint() {
    return this.usdcMint[this.network as keyof typeof this.usdcMint];
  },

  // PDA seeds
  seeds: {
    CONFIG: 'config',
    GLOBAL: 'global',
    MARKET: 'market',
    MARKET_USDC_VAULT: 'market_usdc_vault',
    USERINFO: 'userinfo',
    METADATA: 'metadata',
    WHITELIST: 'whitelist',
    LP_POSITION: 'lp_position',
  } as const,

  // Token decimals
  decimals: {
    USDC: 6,
    OUTCOME_TOKEN: 6,
  } as const,

  // Trading parameters
  trading: {
    /** Default slippage tolerance in percentage (e.g., 5 = 5%) */
    DEFAULT_SLIPPAGE_PERCENT: 5,
    /** Trading fee rate (e.g., 0.003 = 0.3%) */
    FEE_RATE: 0.003,
    /** Default LMSR b parameter for price calculations */
    DEFAULT_B_PARAMETER: 500,
    /** Basis points multiplier for slippage conversion */
    SLIPPAGE_BASIS_POINTS_MULTIPLIER: 100,
  } as const,
};
