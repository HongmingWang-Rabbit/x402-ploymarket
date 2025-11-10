import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import type { PredictionMarket } from './types';
import IDL from './prediction_market.json';
import { CONTRACT_CONFIG, PDA_SEEDS, TOKEN_NAMES } from '@/app/configs/contract';
import { SOLANA_CONFIG } from '@/app/configs/solana';

/**
 * Prediction Market Program Configuration
 * @deprecated Use CONTRACT_CONFIG from @/app/configs/contract instead
 */
export const PROGRAM_CONFIG = {
  ...CONTRACT_CONFIG,
  rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || SOLANA_CONFIG.rpcUrl,
};

// Re-export from configs for backward compatibility
export { PDA_SEEDS, TOKEN_NAMES };

/**
 * Get Prediction Market Program instance
 */
export function getPredictionMarketProgram(
  connection: Connection,
  wallet: any
): Program<PredictionMarket> {
  const provider = new AnchorProvider(
    connection,
    wallet,
    AnchorProvider.defaultOptions()
  );

  // Use IDL directly without type casting to avoid type inference issues
  return new Program(IDL as any, provider) as Program<PredictionMarket>;
}

/**
 * PDA Derivation Helpers
 */
export class PDAHelper {
  /**
   * Get Config PDA
   */
  static getConfigPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.CONFIG],
      PROGRAM_CONFIG.programId
    );
  }

  /**
   * Get Global Vault PDA
   */
  static getGlobalVaultPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.GLOBAL],
      PROGRAM_CONFIG.programId
    );
  }

  /**
   * Get Market PDA
   */
  static getMarketPDA(yesToken: PublicKey, noToken: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        PDA_SEEDS.MARKET,
        yesToken.toBuffer(),
        noToken.toBuffer(),
      ],
      PROGRAM_CONFIG.programId
    );
  }

  /**
   * Get UserInfo PDA
   */
  static getUserInfoPDA(user: PublicKey, market: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        PDA_SEEDS.USERINFO,
        user.toBuffer(),
        market.toBuffer(),
      ],
      PROGRAM_CONFIG.programId
    );
  }

  /**
   * Get Whitelist PDA
   */
  static getWhitelistPDA(creator: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        PDA_SEEDS.WHITELIST,
        creator.toBuffer(),
      ],
      PROGRAM_CONFIG.programId
    );
  }

  /**
   * Get LP Position PDA
   */
  static getLPPositionPDA(market: PublicKey, user: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        PDA_SEEDS.LP_POSITION,
        market.toBuffer(),
        user.toBuffer(),
      ],
      PROGRAM_CONFIG.programId
    );
  }

  /**
   * Get Market USDC Vault PDA
   */
  static getMarketUsdcVaultPDA(market: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        PDA_SEEDS.MARKET_USDC_VAULT,
        market.toBuffer(),
      ],
      PROGRAM_CONFIG.programId
    );
  }
}

/**
 * Format amounts for display (USDC has 6 decimals)
 */
export function formatUSDC(amount: BN | number | undefined | null): string {
  if (amount === undefined || amount === null) {
    return '0.00';
  }
  const num = typeof amount === 'number' ? amount : amount.toNumber();
  return (num / 1_000_000).toFixed(2);
}

/**
 * Parse USDC amount to smallest unit
 */
export function parseUSDC(amount: string | number): BN {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new BN(Math.floor(num * 1_000_000));
}

/**
 * Format percentage
 */
export function formatPercentage(numerator: BN | number | undefined | null, denominator: BN | number | undefined | null): string {
  if (numerator === undefined || numerator === null || denominator === undefined || denominator === null) {
    return '0.00';
  }
  const num = typeof numerator === 'number' ? numerator : numerator.toNumber();
  const denom = typeof denominator === 'number' ? denominator : denominator.toNumber();

  if (denom === 0) return '0.00';
  return ((num / denom) * 100).toFixed(2);
}
