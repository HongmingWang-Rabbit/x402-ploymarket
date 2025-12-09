import { env } from './env';

export const contractConfig = {
  programId: env.programId,

  // USDC mints for different Solana networks
  usdcMint: {
    devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  } as const,

  get currentUsdcMint() {
    return this.usdcMint[env.network as keyof typeof this.usdcMint] || '';
  },

  // PDA seeds (must match contract/programs/prediction-market/src/constants.rs)
  seeds: {
    CONFIG: 'config',
    GLOBAL: 'global',
    MARKET: 'market',
    MARKET_USDC_VAULT: 'market_usdc_vault',
    USERINFO: 'userinfo',
    METADATA: 'metadata',
    WHITELIST: 'wl-seed', // Contract uses 'wl-seed' not 'whitelist'
    LP_POSITION: 'lp_position',
  } as const,

  // Trading constants
  defaultSlippage: 5, // 5%
  minSlippage: 0.1,
  maxSlippage: 50,

  // Market creation
  marketCreationFee: 1.0, // USDC
  defaultBParameter: 500,

  // Decimals
  usdcDecimals: 6,
  tokenDecimals: 6,
} as const;

export type ContractConfig = typeof contractConfig;
