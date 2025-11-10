/**
 * Solana Configuration
 * Non-sensitive configuration values
 */

export const SOLANA_CONFIG = {
  // RPC endpoints
  rpcUrl: process.env.NODE_ENV === 'production'
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com',

  // Commitment level
  commitment: 'confirmed' as const,

  // Transaction confirmation timeout (ms)
  confirmTimeout: 60000,

  // Maximum retry attempts for failed transactions
  maxRetries: 3,

  // USDC mint addresses
  usdcMint: {
    devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
};
