import { PublicKey } from '@solana/web3.js';

/**
 * Prediction Market Smart Contract Configuration
 */
export const CONTRACT_CONFIG = {
  // Program ID (smart contract address)
  programId: new PublicKey('CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM'),

  // Program data address
  programDataAddress: new PublicKey('3jbSDdUupCHdM3ygqRDy3FfavndnNPay9bSad4voZVpq'),

  // Authority address
  authority: new PublicKey('2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr'),

  // Network
  network: 'devnet' as const,
};

/**
 * PDA Seeds for account derivation
 */
export const PDA_SEEDS = {
  CONFIG: Buffer.from('config'),
  GLOBAL: Buffer.from('global'),
  MARKET: Buffer.from('market'),
  MARKET_USDC_VAULT: Buffer.from('market_usdc_vault'),
  USERINFO: Buffer.from('userinfo'),
  METADATA: Buffer.from('metadata'),
  WHITELIST: Buffer.from('wl-seed'),
  LP_POSITION: Buffer.from('lp_position'),
} as const;

/**
 * Token names used in the program
 */
export const TOKEN_NAMES = {
  YES: 'agree',
  NO: 'disagree',
} as const;
