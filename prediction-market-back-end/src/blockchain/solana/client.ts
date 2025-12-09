import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import BN from 'bn.js';
import bs58 from 'bs58';
import { config } from '../../config/index.js';
import { solanaConfig } from './config.js';
import { logger } from '../../utils/logger.js';
import idl from './idl/prediction_market.json' with { type: 'json' };

// Import shared types from blockchain types
import type {
  Market,
  TransactionResult,
  CreateMarketParams,
  SwapParams,
  MintRedeemParams,
  AddLiquidityParams,
  WithdrawLiquidityParams,
  QuoteParams,
  QuoteResult,
} from '../types.js';

// Re-export for consumers
export type { Market, TransactionResult } from '../types.js';

export class SolanaClient {
  private connection: Connection;
  private backendWallet: Keypair;
  private program: Program;
  private provider: AnchorProvider;

  constructor() {
    this.connection = new Connection(solanaConfig.rpcUrl, 'confirmed');
    // Support both base58 string and JSON byte array formats
    const privateKey = config.solana.backendPrivateKey;
    let secretKey: Uint8Array;

    if (privateKey.startsWith('[')) {
      // JSON byte array format: [153,163,2,214,...]
      secretKey = Uint8Array.from(JSON.parse(privateKey));
    } else {
      // Base58 encoded format
      secretKey = bs58.decode(privateKey);
    }

    this.backendWallet = Keypair.fromSecretKey(secretKey);

    const wallet = new Wallet(this.backendWallet);
    this.provider = new AnchorProvider(this.connection, wallet, {
      commitment: 'confirmed',
    });

    this.program = new Program(idl as any, this.provider);

    logger.info(
      { walletAddress: this.backendWallet.publicKey.toBase58() },
      'Solana client initialized'
    );
  }

  // Helper to get PDAs
  private getMarketPDA(name: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(solanaConfig.seeds.MARKET), Buffer.from(name)],
      new PublicKey(solanaConfig.programId)
    );
  }

  private getGlobalPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(solanaConfig.seeds.GLOBAL)],
      new PublicKey(solanaConfig.programId)
    );
  }

  // Market operations
  async getMarkets(limit: number, offset: number): Promise<Market[]> {
    try {
      const accounts = await (this.program.account as any).market.all();

      const markets = accounts
        .slice(offset, offset + limit)
        .map((account: any) => this.formatMarket(account));

      return markets;
    } catch (error) {
      logger.error({ error }, 'Failed to get markets');
      throw error;
    }
  }

  async getMarketsCount(): Promise<number> {
    try {
      const accounts = await (this.program.account as any).market.all();
      return accounts.length;
    } catch (error) {
      logger.error({ error }, 'Failed to get markets count');
      throw error;
    }
  }

  async getMarket(address: string): Promise<Market | null> {
    try {
      const marketPubkey = new PublicKey(address);
      const account = await (this.program.account as any).market.fetch(marketPubkey);

      if (!account) return null;

      return this.formatMarket({ publicKey: marketPubkey, account });
    } catch (error) {
      logger.error({ error, address }, 'Failed to get market');
      return null;
    }
  }

  async createMarket(params: CreateMarketParams): Promise<TransactionResult> {
    try {
      const [marketPDA] = this.getMarketPDA(params.name);
      const [globalPDA] = this.getGlobalPDA();

      // Build and send transaction
      const signature = await (this.program.methods as any)
        .createMarket(
          params.name,
          params.metadataUri,
          new BN(params.bParameter)
        )
        .accounts({
          market: marketPDA,
          global: globalPDA,
          creator: params.creatorAddress
            ? new PublicKey(params.creatorAddress)
            : this.backendWallet.publicKey,
          payer: this.backendWallet.publicKey,
        })
        .signers([this.backendWallet])
        .rpc();

      logger.info({ signature, marketAddress: marketPDA.toBase58() }, 'Market created');

      return { signature, success: true };
    } catch (error) {
      logger.error({ error, params }, 'Failed to create market');
      throw error;
    }
  }

  // Trading operations
  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    try {
      const marketPubkey = new PublicKey(params.marketAddress);
      const account = await (this.program.account as any).market.fetch(marketPubkey);

      if (!account) {
        throw new Error('Market not found');
      }

      const { decimals, trading } = solanaConfig;
      const decimalMultiplier = Math.pow(10, decimals.USDC);

      // Get current market state for LMSR calculation
      const b = account.bParameter?.toNumber() || trading.DEFAULT_B_PARAMETER;
      const qYes = account.qYes?.toNumber() || 0;
      const qNo = account.qNo?.toNumber() || 0;

      const isYes = params.tokenType === 'yes';
      const isBuy = params.direction === 'buy';
      const amount = params.amount;

      // Calculate current cost function: C(q) = b * ln(e^(qYes/b) + e^(qNo/b))
      const currentCost = b * Math.log(Math.exp(qYes / b) + Math.exp(qNo / b));

      // Calculate new quantities after trade
      let newQYes = qYes;
      let newQNo = qNo;
      const amountScaled = amount * decimalMultiplier;

      if (isBuy) {
        if (isYes) newQYes += amountScaled;
        else newQNo += amountScaled;
      } else {
        if (isYes) newQYes -= amountScaled;
        else newQNo -= amountScaled;
      }

      // Calculate new cost
      const newCost = b * Math.log(Math.exp(newQYes / b) + Math.exp(newQNo / b));

      // Price impact is the difference in costs
      const costDiff = Math.abs(newCost - currentCost);

      // Calculate price before and after
      const priceBefore = isYes
        ? Math.exp(qYes / b) / (Math.exp(qYes / b) + Math.exp(qNo / b))
        : Math.exp(qNo / b) / (Math.exp(qYes / b) + Math.exp(qNo / b));

      const priceAfter = isYes
        ? Math.exp(newQYes / b) / (Math.exp(newQYes / b) + Math.exp(newQNo / b))
        : Math.exp(newQNo / b) / (Math.exp(newQYes / b) + Math.exp(newQNo / b));

      const priceImpact = Math.abs(priceAfter - priceBefore) / priceBefore * 100;

      const fee = amount * trading.FEE_RATE;

      return {
        inputAmount: amount,
        outputAmount: isBuy ? amount - fee : costDiff / decimalMultiplier - fee,
        price: priceBefore,
        priceImpact,
        fee,
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to get quote');
      throw error;
    }
  }

  async swap(params: SwapParams): Promise<TransactionResult> {
    try {
      const marketPubkey = new PublicKey(params.marketAddress);
      const userPubkey = new PublicKey(params.userAddress);

      const isBuy = params.direction === 'buy';
      const isYes = params.tokenType === 'yes';

      const { decimals, trading } = solanaConfig;
      const decimalMultiplier = Math.pow(10, decimals.USDC);

      // Calculate with slippage
      const amountBN = new BN(params.amount * decimalMultiplier);
      const slippageBN = new BN(params.slippage * trading.SLIPPAGE_BASIS_POINTS_MULTIPLIER);

      const signature = await (this.program.methods as any)
        .swap(amountBN, isBuy, isYes, slippageBN)
        .accounts({
          market: marketPubkey,
          user: userPubkey,
          payer: this.backendWallet.publicKey,
        })
        .signers([this.backendWallet])
        .rpc();

      logger.info({ signature, params }, 'Swap executed');

      return { signature, success: true };
    } catch (error) {
      logger.error({ error, params }, 'Failed to execute swap');
      throw error;
    }
  }

  async mintCompleteSet(params: MintRedeemParams): Promise<TransactionResult> {
    try {
      const marketPubkey = new PublicKey(params.marketAddress);
      const userPubkey = new PublicKey(params.userAddress);
      const decimalMultiplier = Math.pow(10, solanaConfig.decimals.USDC);
      const amountBN = new BN(params.amount * decimalMultiplier);

      const signature = await (this.program.methods as any)
        .mintCompleteSet(amountBN)
        .accounts({
          market: marketPubkey,
          user: userPubkey,
          payer: this.backendWallet.publicKey,
        })
        .signers([this.backendWallet])
        .rpc();

      logger.info({ signature, params }, 'Complete set minted');

      return { signature, success: true };
    } catch (error) {
      logger.error({ error, params }, 'Failed to mint complete set');
      throw error;
    }
  }

  async redeemCompleteSet(params: MintRedeemParams): Promise<TransactionResult> {
    try {
      const marketPubkey = new PublicKey(params.marketAddress);
      const userPubkey = new PublicKey(params.userAddress);
      const decimalMultiplier = Math.pow(10, solanaConfig.decimals.USDC);
      const amountBN = new BN(params.amount * decimalMultiplier);

      const signature = await (this.program.methods as any)
        .redeemCompleteSet(amountBN)
        .accounts({
          market: marketPubkey,
          user: userPubkey,
          payer: this.backendWallet.publicKey,
        })
        .signers([this.backendWallet])
        .rpc();

      logger.info({ signature, params }, 'Complete set redeemed');

      return { signature, success: true };
    } catch (error) {
      logger.error({ error, params }, 'Failed to redeem complete set');
      throw error;
    }
  }

  // Liquidity operations
  async addLiquidity(params: AddLiquidityParams): Promise<TransactionResult> {
    try {
      const marketPubkey = new PublicKey(params.marketAddress);
      const userPubkey = new PublicKey(params.userAddress);
      const decimalMultiplier = Math.pow(10, solanaConfig.decimals.USDC);
      const amountBN = new BN(params.amount * decimalMultiplier);

      const signature = await (this.program.methods as any)
        .addLiquidity(amountBN)
        .accounts({
          market: marketPubkey,
          user: userPubkey,
          payer: this.backendWallet.publicKey,
        })
        .signers([this.backendWallet])
        .rpc();

      logger.info({ signature, params }, 'Liquidity added');

      return { signature, success: true };
    } catch (error) {
      logger.error({ error, params }, 'Failed to add liquidity');
      throw error;
    }
  }

  async withdrawLiquidity(params: WithdrawLiquidityParams): Promise<TransactionResult> {
    try {
      const marketPubkey = new PublicKey(params.marketAddress);
      const userPubkey = new PublicKey(params.userAddress);
      const decimalMultiplier = Math.pow(10, solanaConfig.decimals.USDC);
      const lpAmountBN = new BN(params.lpAmount * decimalMultiplier);

      const signature = await (this.program.methods as any)
        .withdrawLiquidity(lpAmountBN)
        .accounts({
          market: marketPubkey,
          user: userPubkey,
          payer: this.backendWallet.publicKey,
        })
        .signers([this.backendWallet])
        .rpc();

      logger.info({ signature, params }, 'Liquidity withdrawn');

      return { signature, success: true };
    } catch (error) {
      logger.error({ error, params }, 'Failed to withdraw liquidity');
      throw error;
    }
  }

  // Helper to format market data
  private formatMarket(accountData: { publicKey: PublicKey; account: any }): Market {
    const { publicKey, account } = accountData;
    const decimalMultiplier = Math.pow(10, solanaConfig.decimals.USDC);

    return {
      address: publicKey.toBase58(),
      name: account.name,
      metadataUri: account.metadataUri,
      creator: account.creator.toBase58(),
      yesMint: account.yesMint?.toBase58() || '',
      noMint: account.noMint?.toBase58() || '',
      collateralVault: account.collateralVault?.toBase58() || '',
      status: this.getMarketStatus(account.status),
      bParameter: account.bParameter?.toNumber() || 0,
      totalLiquidity: (account.totalLiquidity?.toNumber() || 0) / decimalMultiplier,
      yesPrice: this.calculatePrice(account, 'yes'),
      noPrice: this.calculatePrice(account, 'no'),
      createdAt: account.createdAt?.toNumber() || Date.now(),
    };
  }

  private getMarketStatus(status: any): 'active' | 'paused' | 'resolved' {
    if (status?.active) return 'active';
    if (status?.paused) return 'paused';
    if (status?.resolved) return 'resolved';
    return 'active';
  }

  private calculatePrice(account: any, tokenType: 'yes' | 'no'): number {
    // LMSR pricing calculation
    // This is a simplified version - actual implementation depends on contract
    const b = account.bParameter?.toNumber() || 500;
    const qYes = account.qYes?.toNumber() || 0;
    const qNo = account.qNo?.toNumber() || 0;

    if (tokenType === 'yes') {
      return Math.exp(qYes / b) / (Math.exp(qYes / b) + Math.exp(qNo / b));
    } else {
      return Math.exp(qNo / b) / (Math.exp(qYes / b) + Math.exp(qNo / b));
    }
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
