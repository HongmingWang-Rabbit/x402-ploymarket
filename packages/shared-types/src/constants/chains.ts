/**
 * Chain and network configuration constants
 */

/**
 * Supported chain IDs
 */
export const CHAIN_IDS = {
  SOLANA_MAINNET: 'solana-mainnet',
  SOLANA_DEVNET: 'solana-devnet',
  SOLANA_LOCALNET: 'solana-localnet',
} as const;

export type ChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS];

/**
 * USDC mint addresses per network
 */
export const USDC_MINTS = {
  [CHAIN_IDS.SOLANA_MAINNET]: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  [CHAIN_IDS.SOLANA_DEVNET]: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  [CHAIN_IDS.SOLANA_LOCALNET]: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
} as const;

/**
 * RPC endpoints per network
 */
export const RPC_ENDPOINTS = {
  [CHAIN_IDS.SOLANA_MAINNET]: 'https://api.mainnet-beta.solana.com',
  [CHAIN_IDS.SOLANA_DEVNET]: 'https://api.devnet.solana.com',
  [CHAIN_IDS.SOLANA_LOCALNET]: 'http://localhost:8899',
} as const;

/**
 * Network display names
 */
export const NETWORK_NAMES = {
  [CHAIN_IDS.SOLANA_MAINNET]: 'Solana Mainnet',
  [CHAIN_IDS.SOLANA_DEVNET]: 'Solana Devnet',
  [CHAIN_IDS.SOLANA_LOCALNET]: 'Solana Localnet',
} as const;
