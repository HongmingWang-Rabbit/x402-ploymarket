import { env, contractConfig } from '@/config';

export const solanaConfig = {
  rpcUrl: env.solanaRpcUrl,
  network: env.network,
  programId: env.programId,

  // USDC mints - re-export from contractConfig
  usdcMint: contractConfig.usdcMint,

  get currentUsdcMint() {
    return contractConfig.currentUsdcMint;
  },

  // PDA seeds - re-export from contractConfig
  seeds: contractConfig.seeds,
} as const;

export type SolanaConfig = typeof solanaConfig;
