/**
 * Solana Client for Workers
 *
 * Handles blockchain interactions for market creation
 */

import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import bs58 from 'bs58';
import { env } from '../env.js';
import { createWorkerLogger } from '../logger.js';
import idl from './prediction_market.json' with { type: 'json' };

const logger = createWorkerLogger('solana-client');

// PDA seeds (matching the contract)
const SEEDS = {
  CONFIG: 'config',
  GLOBAL: 'global',
  MARKET: 'market',
  WHITELIST: 'wl-seed',
  MARKET_USDC_VAULT: 'market_usdc_vault',
} as const;

// Metaplex Token Metadata Program ID
const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

/**
 * Parse private key from string (supports both base58 and JSON array formats)
 */
export function parsePrivateKey(keyStr: string): Uint8Array | null {
  try {
    // Try JSON array format first: [1,2,3,...]
    if (keyStr.trim().startsWith('[')) {
      const arr = JSON.parse(keyStr);
      if (Array.isArray(arr) && arr.length === 64) {
        return new Uint8Array(arr);
      }
    }
    // Try base58 format
    const decoded = bs58.decode(keyStr);
    if (decoded.length === 64) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if the publisher private key is valid
 */
export function isValidPrivateKey(): boolean {
  if (!env.PUBLISHER_PRIVATE_KEY) return false;
  try {
    const privateKeyBytes = parsePrivateKey(env.PUBLISHER_PRIVATE_KEY);
    if (!privateKeyBytes) return false;
    Keypair.fromSecretKey(privateKeyBytes);
    return true;
  } catch {
    return false;
  }
}

export interface CreateMarketResult {
  success: boolean;
  marketAddress: string;
  yesTokenMint: string;
  noTokenMint: string;
  txSignature: string;
}

export interface CreateMarketParams {
  displayName: string;
  yesSymbol: string;
  yesUri: string;
  noSymbol: string;
  noUri: string;
  initialYesProb?: number; // 0-10000 basis points, default 5000 (50%)
  startSlot?: number;
  endingSlot?: number;
}

export class SolanaClient {
  private connection: Connection;
  private wallet: Wallet;
  private keypair: Keypair;
  private program: Program;
  private provider: AnchorProvider;

  constructor() {
    this.connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');

    const privateKeyBytes = parsePrivateKey(env.PUBLISHER_PRIVATE_KEY);
    if (!privateKeyBytes) {
      throw new Error('Invalid PUBLISHER_PRIVATE_KEY format');
    }

    this.keypair = Keypair.fromSecretKey(privateKeyBytes);
    this.wallet = new Wallet(this.keypair);

    this.provider = new AnchorProvider(this.connection, this.wallet, {
      commitment: 'confirmed',
    });

    this.program = new Program(idl as any, this.provider);

    logger.info(
      { walletAddress: this.keypair.publicKey.toBase58() },
      'Solana client initialized'
    );
  }

  /**
   * Get Global Config PDA
   */
  private getGlobalConfigPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.CONFIG)],
      new PublicKey(env.PROGRAM_ID)
    );
  }

  /**
   * Get Global Vault PDA
   */
  private getGlobalVaultPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.GLOBAL)],
      new PublicKey(env.PROGRAM_ID)
    );
  }

  /**
   * Get Market PDA from YES and NO token mints
   */
  private getMarketPDA(yesMint: PublicKey, noMint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.MARKET), yesMint.toBuffer(), noMint.toBuffer()],
      new PublicKey(env.PROGRAM_ID)
    );
  }

  /**
   * Get Creator Whitelist PDA
   */
  private getWhitelistPDA(creator: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.WHITELIST), creator.toBuffer()],
      new PublicKey(env.PROGRAM_ID)
    );
  }

  /**
   * Get Token Metadata PDA
   */
  private getMetadataPDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      MPL_TOKEN_METADATA_PROGRAM_ID
    );
  }

  /**
   * Create a market on-chain
   *
   * This involves two transactions:
   * 1. mint_no_token - Create the NO token
   * 2. create_market - Create the market with YES token
   */
  async createMarket(params: CreateMarketParams): Promise<CreateMarketResult> {
    logger.info({ displayName: params.displayName }, 'Creating market on-chain');

    const [globalConfig] = this.getGlobalConfigPDA();
    const [globalVault] = this.getGlobalVaultPDA();

    // Generate keypairs for YES and NO tokens
    const yesTokenKeypair = Keypair.generate();
    const noTokenKeypair = Keypair.generate();

    // Step 1: Mint NO token first
    logger.info({ noToken: noTokenKeypair.publicKey.toBase58() }, 'Minting NO token');

    const [noMetadata] = this.getMetadataPDA(noTokenKeypair.publicKey);
    const globalNoAta = getAssociatedTokenAddressSync(
      noTokenKeypair.publicKey,
      globalVault,
      true
    );

    try {
      const mintNoTx = await (this.program.methods as any)
        .mintNoToken(params.noSymbol, params.noUri)
        .accounts({
          globalConfig,
          globalVault,
          creator: this.keypair.publicKey,
          noToken: noTokenKeypair.publicKey,
          noTokenMetadataAccount: noMetadata,
          globalNoTokenAccount: globalNoAta,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          mplTokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        })
        .signers([noTokenKeypair])
        .rpc();

      logger.info({ txSignature: mintNoTx }, 'NO token minted');
    } catch (error) {
      logger.error({ error }, 'Failed to mint NO token');
      throw error;
    }

    // Step 2: Create the market with YES token
    logger.info({ yesToken: yesTokenKeypair.publicKey.toBase58() }, 'Creating market');

    const [market] = this.getMarketPDA(yesTokenKeypair.publicKey, noTokenKeypair.publicKey);
    const [yesMetadata] = this.getMetadataPDA(yesTokenKeypair.publicKey);
    const [creatorWhitelist] = this.getWhitelistPDA(this.keypair.publicKey);

    const globalYesAta = getAssociatedTokenAddressSync(
      yesTokenKeypair.publicKey,
      globalVault,
      true
    );

    // Get team wallet from env or use creator as fallback
    const teamWallet = env.TEAM_WALLET_ADDRESS
      ? new PublicKey(env.TEAM_WALLET_ADDRESS)
      : this.keypair.publicKey;

    // Prepare create market params
    const createMarketParams = {
      yesSymbol: params.yesSymbol,
      yesUri: params.yesUri,
      startSlot: params.startSlot ? new BN(params.startSlot) : null,
      endingSlot: params.endingSlot ? new BN(params.endingSlot) : null,
      displayName: params.displayName.substring(0, 64), // Max 64 chars
      initialYesProb: params.initialYesProb ?? 5000, // Default 50%
    };

    try {
      const createMarketTx = await (this.program.methods as any)
        .createMarket(createMarketParams)
        .accounts({
          globalConfig,
          globalVault,
          creator: this.keypair.publicKey,
          creatorWhitelist, // Will be ignored if whitelist is disabled
          yesToken: yesTokenKeypair.publicKey,
          noToken: noTokenKeypair.publicKey,
          market,
          yesTokenMetadataAccount: yesMetadata,
          noTokenMetadataAccount: noMetadata,
          globalYesTokenAccount: globalYesAta,
          globalNoTokenAccount: globalNoAta,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          mplTokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
          teamWallet,
        })
        .signers([yesTokenKeypair])
        .rpc();

      logger.info({
        txSignature: createMarketTx,
        marketAddress: market.toBase58(),
        yesToken: yesTokenKeypair.publicKey.toBase58(),
        noToken: noTokenKeypair.publicKey.toBase58(),
      }, 'Market created successfully');

      return {
        success: true,
        marketAddress: market.toBase58(),
        yesTokenMint: yesTokenKeypair.publicKey.toBase58(),
        noTokenMint: noTokenKeypair.publicKey.toBase58(),
        txSignature: createMarketTx,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to create market');
      throw error;
    }
  }

  /**
   * Get publisher wallet address
   */
  getPublisherAddress(): string {
    return this.keypair.publicKey.toBase58();
  }
}

// Singleton instance
let solanaClientInstance: SolanaClient | null = null;

export function getSolanaClient(): SolanaClient {
  if (!solanaClientInstance) {
    solanaClientInstance = new SolanaClient();
  }
  return solanaClientInstance;
}
