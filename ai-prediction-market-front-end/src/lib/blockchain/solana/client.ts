import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { Program, AnchorProvider, BN, BorshCoder } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { solanaConfig } from './config';
import type {
  IBlockchainAdapter,
  ChainType,
  TransactionResult,
  CreateMarketParams,
} from '../types';
import type {
  Market,
  SwapParams,
  MintRedeemParams,
  AddLiquidityParams,
  WithdrawLiquidityParams,
  UserPosition,
  UserLPPosition,
} from '@/types';

// Import IDL
import idl from './idl/prediction_market.json';

// Metaplex Token Metadata Program ID
const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// USDC decimals constant
const USDC_DECIMALS = 6;
const USDC_MULTIPLIER = 10 ** USDC_DECIMALS;

// Dynamic config that can be updated from backend
interface DynamicConfig {
  programId: string;
  rpcUrl: string;
  usdcMint?: string;
}

export class SolanaAdapter implements IBlockchainAdapter {
  readonly chain: ChainType = 'solana';

  private connection: Connection;
  private wallet: WalletContextState | null = null;
  private program: Program | null = null;
  private dynamicConfig: DynamicConfig;

  constructor() {
    this.dynamicConfig = {
      programId: solanaConfig.programId,
      rpcUrl: solanaConfig.rpcUrl,
      usdcMint: solanaConfig.currentUsdcMint,
    };
    this.connection = new Connection(this.dynamicConfig.rpcUrl, 'confirmed');
  }

  // Update config from backend - call this when contracts are fetched
  updateConfig(config: Partial<DynamicConfig>) {
    let needsReconnect = false;

    if (config.rpcUrl && config.rpcUrl !== this.dynamicConfig.rpcUrl) {
      this.dynamicConfig.rpcUrl = config.rpcUrl;
      needsReconnect = true;
    }

    if (config.programId) {
      this.dynamicConfig.programId = config.programId;
    }

    if (config.usdcMint) {
      this.dynamicConfig.usdcMint = config.usdcMint;
    }

    // Reconnect if RPC URL changed
    if (needsReconnect) {
      this.connection = new Connection(this.dynamicConfig.rpcUrl, 'confirmed');
      // Re-setup program with new connection
      if (this.wallet?.publicKey && this.wallet?.signTransaction) {
        this.setWallet(this.wallet);
      }
    }
  }

  // Get current config (for debugging)
  getConfig(): DynamicConfig {
    return { ...this.dynamicConfig };
  }

  // Set wallet for operations requiring signing
  setWallet(wallet: WalletContextState) {
    this.wallet = wallet;

    if (wallet.publicKey && wallet.signTransaction) {
      const provider = new AnchorProvider(
        this.connection,
        {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
          signAllTransactions: wallet.signAllTransactions!,
        },
        { commitment: 'confirmed' }
      );

      this.program = new Program(idl as any, provider);
    }
  }

  // Connection state
  isConnected(): boolean {
    return this.wallet?.connected ?? false;
  }

  getAddress(): string | null {
    return this.wallet?.publicKey?.toBase58() ?? null;
  }

  // Helper to create a read-only provider for fetching data
  private createReadOnlyProvider(): AnchorProvider {
    return new AnchorProvider(
      this.connection,
      {
        publicKey: PublicKey.default,
        signTransaction: async () => { throw new Error('Read-only'); },
        signAllTransactions: async () => { throw new Error('Read-only'); },
      },
      { commitment: 'confirmed' }
    );
  }

  // Helper to get PDAs
  private getGlobalPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(solanaConfig.seeds.GLOBAL)],
      new PublicKey(this.dynamicConfig.programId)
    );
  }

  private getConfigPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(solanaConfig.seeds.CONFIG)],
      new PublicKey(this.dynamicConfig.programId)
    );
  }

  private getWhitelistPDA(creatorPubkey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(solanaConfig.seeds.WHITELIST), creatorPubkey.toBytes()],
      new PublicKey(this.dynamicConfig.programId)
    );
  }

  // Get market PDA using YES and NO token mints as seeds
  private getMarketPDAFromMints(yesToken: PublicKey, noToken: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(solanaConfig.seeds.MARKET), yesToken.toBytes(), noToken.toBytes()],
      new PublicKey(this.dynamicConfig.programId)
    );
  }

  // Get Metaplex metadata PDA for a token mint
  private getMetadataPDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        MPL_TOKEN_METADATA_PROGRAM_ID.toBytes(),
        mint.toBytes(),
      ],
      MPL_TOKEN_METADATA_PROGRAM_ID
    );
  }

  // Get User Info PDA (for tracking user's trading stats in a market)
  private getUserInfoPDA(user: PublicKey, market: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(solanaConfig.seeds.USERINFO), user.toBytes(), market.toBytes()],
      new PublicKey(this.dynamicConfig.programId)
    );
  }

  // Get LP Position PDA (for tracking user's liquidity position)
  private getLPPositionPDA(market: PublicKey, user: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(solanaConfig.seeds.LP_POSITION), market.toBytes(), user.toBytes()],
      new PublicKey(this.dynamicConfig.programId)
    );
  }

  // Get Market USDC Vault PDA
  private getMarketUsdcVaultPDA(market: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(solanaConfig.seeds.MARKET_USDC_VAULT), market.toBytes()],
      new PublicKey(this.dynamicConfig.programId)
    );
  }

  // Get config account data (for team wallet, USDC mint, etc.)
  async getConfigData(): Promise<{ teamWallet: PublicKey; usdcMint: PublicKey } | null> {
    try {
      const [configPDA] = this.getConfigPDA();
      const provider = this.createReadOnlyProvider();
      const program = new Program(idl as any, provider);
      const config = await (program.account as any).config?.fetch(configPDA);
      return {
        teamWallet: config?.teamWallet || null,
        usdcMint: config?.usdcMint || null,
      };
    } catch (error) {
      console.error('Failed to get config data:', error);
      return null;
    }
  }

  // Get team wallet from global config (convenience method)
  async getTeamWallet(): Promise<PublicKey | null> {
    const config = await this.getConfigData();
    return config?.teamWallet || null;
  }

  // Check if an address is whitelisted for market creation
  async isWhitelisted(address: string): Promise<boolean> {
    try {
      const creatorPubkey = new PublicKey(address);
      const [whitelistPDA] = this.getWhitelistPDA(creatorPubkey);

      // Check if the whitelist account exists
      const accountInfo = await this.connection.getAccountInfo(whitelistPDA);
      return accountInfo !== null;
    } catch (error) {
      console.error('Failed to check whitelist:', error);
      return false;
    }
  }

  // Get the contract authority from config
  async getAuthority(): Promise<string | null> {
    try {
      const [configPDA] = this.getConfigPDA();
      const provider = this.createReadOnlyProvider();
      const program = new Program(idl as any, provider);
      const config = await (program.account as any).config?.fetch(configPDA);
      return config?.authority?.toBase58() || null;
    } catch (error) {
      console.error('Failed to get authority:', error);
      return null;
    }
  }

  // Market operations (read-only)
  async getMarkets(limit = 10, offset = 0): Promise<Market[]> {
    try {
      const provider = this.createReadOnlyProvider();
      const program = new Program(idl as any, provider);
      const accounts = await (program.account as any).market.all();

      // Format all markets first, then sort by createdAt (newest first)
      const allMarkets = accounts
        .map((account: any) => this.formatMarket(account))
        .sort((a: Market, b: Market) => b.createdAt - a.createdAt);

      // Apply pagination after sorting
      return allMarkets.slice(offset, offset + limit);
    } catch (error) {
      console.error('Failed to get markets:', error);
      return [];
    }
  }

  async getMarketsCount(): Promise<number> {
    try {
      const provider = this.createReadOnlyProvider();
      const program = new Program(idl as any, provider);
      const accounts = await (program.account as any).market.all();
      return accounts.length;
    } catch (error) {
      console.error('Failed to get markets count:', error);
      return 0;
    }
  }

  async getMarket(address: string): Promise<Market | null> {
    try {
      const provider = this.createReadOnlyProvider();
      const program = new Program(idl as any, provider);
      const marketPubkey = new PublicKey(address);
      const account = await (program.account as any).market.fetch(marketPubkey);

      if (!account) return null;

      return this.formatMarket({ publicKey: marketPubkey, account });
    } catch (error) {
      console.error('Failed to get market:', error);
      return null;
    }
  }

  // Get user's LP position for a specific market
  async getUserLPPosition(marketAddress: string, userAddress: string): Promise<UserLPPosition | null> {
    try {
      const provider = this.createReadOnlyProvider();
      const program = new Program(idl as any, provider);
      const marketPubkey = new PublicKey(marketAddress);
      const userPubkey = new PublicKey(userAddress);

      // Get LP Position PDA
      const [lpPositionPDA] = this.getLPPositionPDA(marketPubkey, userPubkey);

      // Fetch LP position account
      const accounts = program.account as any;
      let lpPosition = null;

      // Try lpPosition (Anchor's standard camelCase for LPPosition)
      if (accounts.lpPosition) {
        try {
          lpPosition = await accounts.lpPosition.fetch(lpPositionPDA);
        } catch {
          // Account doesn't exist
        }
      }

      if (!lpPosition || lpPosition.lpShares?.toNumber() === 0) {
        return null;
      }

      // Fetch market data for calculations
      const market = await this.getMarket(marketAddress);
      if (!market) return null;

      // Calculate user's position details
      const lpShares = (lpPosition.lpShares?.toNumber() || 0) / 1e6;
      const investedUsdc = (lpPosition.investedUsdc?.toNumber() || 0) / 1e6;
      const createdAt = (lpPosition.createdAt?.toNumber() || 0) * 1000; // Convert to ms
      const lastAddAt = (lpPosition.lastAddAt?.toNumber() || 0) * 1000;

      // Calculate share percentage
      const sharePercentage = market.totalLpShares > 0
        ? (lpShares / market.totalLpShares) * 100
        : 0;

      // Calculate estimated current value
      const estimatedValue = market.totalLpShares > 0
        ? (lpShares / market.totalLpShares) * market.totalPoolValue
        : 0;

      // Calculate unrealized PnL
      const unrealizedPnl = estimatedValue - investedUsdc;
      const unrealizedPnlPercent = investedUsdc > 0
        ? (unrealizedPnl / investedUsdc) * 100
        : 0;

      // Calculate holding period
      const now = Date.now();
      const holdingDays = createdAt > 0
        ? Math.floor((now - createdAt) / (24 * 60 * 60 * 1000))
        : 0;

      // Calculate early exit penalty based on holding period
      let earlyExitPenaltyPercent = 0;
      if (holdingDays < 7) {
        earlyExitPenaltyPercent = 3.0; // 300 bps
      } else if (holdingDays < 14) {
        earlyExitPenaltyPercent = 1.5; // 150 bps
      } else if (holdingDays < 30) {
        earlyExitPenaltyPercent = 0.5; // 50 bps
      }

      return {
        marketAddress,
        userAddress,
        lpShares,
        investedUsdc,
        sharePercentage,
        estimatedValue,
        unrealizedPnl,
        unrealizedPnlPercent,
        createdAt,
        lastAddAt,
        holdingDays,
        earlyExitPenaltyPercent,
      };
    } catch {
      // LP position doesn't exist or other error
      return null;
    }
  }

  // Get user's YES/NO token balances for a specific market
  async getUserTokenBalances(
    marketAddress: string,
    userAddress: string
  ): Promise<{ yesBalance: number; noBalance: number } | null> {
    try {
      const market = await this.getMarket(marketAddress);
      if (!market) return null;

      const userPubkey = new PublicKey(userAddress);
      const yesTokenMint = new PublicKey(market.yesMint);
      const noTokenMint = new PublicKey(market.noMint);

      // Get user's ATAs
      const userYesAta = getAssociatedTokenAddressSync(yesTokenMint, userPubkey);
      const userNoAta = getAssociatedTokenAddressSync(noTokenMint, userPubkey);

      // Fetch balances
      let yesBalance = 0;
      let noBalance = 0;

      try {
        const yesAccountInfo = await this.connection.getTokenAccountBalance(userYesAta);
        yesBalance = yesAccountInfo.value.uiAmount || 0;
      } catch {
        // Account doesn't exist
      }

      try {
        const noAccountInfo = await this.connection.getTokenAccountBalance(userNoAta);
        noBalance = noAccountInfo.value.uiAmount || 0;
      } catch {
        // Account doesn't exist
      }

      return { yesBalance, noBalance };
    } catch (error) {
      console.error('Failed to get user token balances:', error);
      return null;
    }
  }

  // Fix existing market by setting mint authority (for markets created before this fix)
  // Only the market creator or contract admin can call this
  async fixMarketMintAuthority(marketAddress: string): Promise<TransactionResult> {
    if (!this.program || !this.wallet?.publicKey) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }

    try {
      // Fetch market data to get YES/NO token mints
      const market = await this.getMarket(marketAddress);
      if (!market) {
        return { signature: '', success: false, error: 'Market not found' };
      }

      // Call setMintAuthority with the market's token mints
      return await this.setMintAuthority({
        yesTokenPubkey: market.yesMint,
        noTokenPubkey: market.noMint,
      });
    } catch (error) {
      console.error('Failed to fix market mint authority:', error);
      return { signature: '', success: false, error: String(error) };
    }
  }

  // Step 1: Mint NO token (must be called before createMarket)
  async mintNoToken(noSymbol: string, noUri: string): Promise<{ signature: string; noTokenPubkey: string } | { error: string }> {
    if (!this.program || !this.wallet?.publicKey) {
      return { error: 'Wallet not connected' };
    }

    try {
      const [globalVault] = this.getGlobalPDA();
      const [globalConfig] = this.getConfigPDA();

      // Generate new keypair for NO token mint
      const noToken = Keypair.generate();

      // Derive metadata PDA for NO token
      const [noTokenMetadataAccount] = this.getMetadataPDA(noToken.publicKey);

      // Derive ATA for global vault's NO token
      const globalNoTokenAccount = getAssociatedTokenAddressSync(
        noToken.publicKey,
        globalVault,
        true // allowOwnerOffCurve for PDA
      );

      const signature = await (this.program.methods as any)
        .mintNoToken(noSymbol, noUri)
        .accounts({
          globalConfig,
          globalVault,
          creator: this.wallet.publicKey,
          noToken: noToken.publicKey,
          noTokenMetadataAccount,
          globalNoTokenAccount,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          mplTokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        })
        .signers([noToken])
        .rpc();

      return { signature, noTokenPubkey: noToken.publicKey.toBase58() };
    } catch (error) {
      console.error('Failed to mint NO token:', error);
      return { error: String(error) };
    }
  }

  // Step 2: Set mint authority (transfer YES/NO token mint authority to market PDA)
  // This must be called after createMarket and before addLiquidity
  async setMintAuthority(params: { yesTokenPubkey: string; noTokenPubkey: string }): Promise<TransactionResult> {
    if (!this.program || !this.wallet?.publicKey) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }

    try {
      const [globalVault] = this.getGlobalPDA();
      const [globalConfig] = this.getConfigPDA();

      const yesToken = new PublicKey(params.yesTokenPubkey);
      const noToken = new PublicKey(params.noTokenPubkey);

      // Derive market PDA from YES and NO token mints
      const [market] = this.getMarketPDAFromMints(yesToken, noToken);

      const signature = await (this.program.methods as any)
        .setMintAuthority()
        .accounts({
          globalConfig,
          globalVault,
          yesToken,
          noToken,
          market,
          authority: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      return { signature, success: true };
    } catch (error) {
      console.error('Failed to set mint authority:', error);
      return { signature: '', success: false, error: String(error) };
    }
  }

  // Step 3: Create market (must call mintNoToken first to get noTokenPubkey)
  async createMarket(params: CreateMarketParams & { noTokenPubkey?: string }): Promise<TransactionResult> {
    if (!this.program || !this.wallet?.publicKey) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }

    try {
      const [globalVault] = this.getGlobalPDA();
      const [globalConfig] = this.getConfigPDA();

      // Check if creator is whitelisted - only pass the account if it exists
      const isWhitelisted = await this.isWhitelisted(this.wallet.publicKey.toBase58());
      const [creatorWhitelistPDA] = this.getWhitelistPDA(this.wallet.publicKey);
      // Pass null for optional account if not whitelisted
      const creatorWhitelist = isWhitelisted ? creatorWhitelistPDA : null;

      // Generate new keypair for YES token mint
      const yesToken = Keypair.generate();

      // NO token must be created first via mintNoToken
      // If not provided, create it now (two transactions)
      let noTokenPubkey: PublicKey;
      if (params.noTokenPubkey) {
        noTokenPubkey = new PublicKey(params.noTokenPubkey);
      } else {
        // Create NO token first
        const noSymbol = params.yesSymbol.replace('YES', 'NO').replace('yes', 'no');
        const noUri = params.yesUri; // Use same URI or generate NO-specific one
        const mintResult = await this.mintNoToken(noSymbol, noUri);
        if ('error' in mintResult) {
          return { signature: '', success: false, error: mintResult.error };
        }
        noTokenPubkey = new PublicKey(mintResult.noTokenPubkey);
      }

      // Derive market PDA from YES and NO token mints
      const [market] = this.getMarketPDAFromMints(yesToken.publicKey, noTokenPubkey);

      // Derive metadata PDAs
      const [yesTokenMetadataAccount] = this.getMetadataPDA(yesToken.publicKey);
      const [noTokenMetadataAccount] = this.getMetadataPDA(noTokenPubkey);

      // Derive ATAs for global vault
      const globalYesTokenAccount = getAssociatedTokenAddressSync(
        yesToken.publicKey,
        globalVault,
        true // allowOwnerOffCurve for PDA
      );
      const globalNoTokenAccount = getAssociatedTokenAddressSync(
        noTokenPubkey,
        globalVault,
        true // allowOwnerOffCurve for PDA
      );

      // Get team wallet from config
      const teamWallet = await this.getTeamWallet();
      if (!teamWallet) {
        return { signature: '', success: false, error: 'Failed to get team wallet from config' };
      }

      // Build CreateMarketParams struct for contract
      const contractParams = {
        yesSymbol: params.yesSymbol,
        yesUri: params.yesUri,
        startSlot: params.startSlot ? new BN(params.startSlot) : null,
        endingSlot: params.endingSlot ? new BN(params.endingSlot) : null,
        displayName: params.displayName.slice(0, 64), // Max 64 chars
        initialYesProb: params.initialYesProb, // 2000-8000 basis points
      };

      const createMarketSignature = await (this.program.methods as any)
        .createMarket(contractParams)
        .accounts({
          globalConfig,
          globalVault,
          creator: this.wallet.publicKey,
          creatorWhitelist,
          yesToken: yesToken.publicKey,
          noToken: noTokenPubkey,
          market,
          yesTokenMetadataAccount,
          noTokenMetadataAccount,
          globalYesTokenAccount,
          globalNoTokenAccount,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          mplTokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
          teamWallet,
        })
        .signers([yesToken])
        .rpc();

      // Wait for create market to confirm
      await this.connection.confirmTransaction(createMarketSignature, 'confirmed');

      // Step 3: Set mint authority - transfer YES/NO token mint authority to market PDA
      // This is required before addLiquidity can work
      const setAuthResult = await this.setMintAuthority({
        yesTokenPubkey: yesToken.publicKey.toBase58(),
        noTokenPubkey: noTokenPubkey.toBase58(),
      });

      if (!setAuthResult.success) {
        console.error('Failed to set mint authority:', setAuthResult.error);
        // Return the create market signature but note the authority transfer failed
        return {
          signature: createMarketSignature,
          success: false,
          marketAddress: market.toBase58(),
          error: `Market created but mint authority transfer failed: ${setAuthResult.error}. Call setMintAuthority manually before adding liquidity.`,
        };
      }

      return { signature: createMarketSignature, success: true, marketAddress: market.toBase58() };
    } catch (error) {
      console.error('Failed to create market:', error);
      return { signature: '', success: false, error: String(error) };
    }
  }

  // Trading operations
  async swap(params: SwapParams): Promise<TransactionResult> {
    if (!this.program || !this.wallet?.publicKey || !this.wallet.sendTransaction) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }

    try {
      const marketPubkey = new PublicKey(params.marketAddress);

      // Fetch market data to get token mints
      const market = await this.getMarket(params.marketAddress);
      if (!market) {
        return { signature: '', success: false, error: 'Market not found' };
      }

      // Check if market has liquidity
      if (market.totalLiquidity <= 0) {
        return { signature: '', success: false, error: 'Market has no liquidity. Please add liquidity first.' };
      }

      // Get config for USDC mint and team wallet
      const config = await this.getConfigData();
      if (!config) {
        return { signature: '', success: false, error: 'Failed to get config' };
      }

      const usdcMint = config.usdcMint;
      const yesTokenMint = new PublicKey(market.yesMint);
      const noTokenMint = new PublicKey(market.noMint);

      // Derive PDAs
      const [configPDA] = this.getConfigPDA();
      const [globalVaultPDA] = this.getGlobalPDA();
      const [marketPDA] = this.getMarketPDAFromMints(yesTokenMint, noTokenMint);
      const [marketUsdcVaultPDA] = this.getMarketUsdcVaultPDA(marketPubkey);
      const [userInfoPDA] = this.getUserInfoPDA(this.wallet.publicKey, marketPubkey);

      // Get ATAs
      const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, this.wallet.publicKey);
      const userYesAta = getAssociatedTokenAddressSync(yesTokenMint, this.wallet.publicKey);
      const userNoAta = getAssociatedTokenAddressSync(noTokenMint, this.wallet.publicKey);
      const globalYesAta = getAssociatedTokenAddressSync(yesTokenMint, globalVaultPDA, true);
      const globalNoAta = getAssociatedTokenAddressSync(noTokenMint, globalVaultPDA, true);
      const marketUsdcAta = getAssociatedTokenAddressSync(usdcMint, marketUsdcVaultPDA, true);
      const teamUsdcAta = getAssociatedTokenAddressSync(usdcMint, config.teamWallet);

      // Setup transaction to create any missing token accounts
      const setupTx = new Transaction();
      let needsSetup = false;

      // Check and create user YES token account if needed
      const userYesAtaInfo = await this.connection.getAccountInfo(userYesAta);
      if (!userYesAtaInfo) {
        setupTx.add(createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          userYesAta,
          this.wallet.publicKey,
          yesTokenMint
        ));
        needsSetup = true;
      }

      // Check and create user NO token account if needed
      const userNoAtaInfo = await this.connection.getAccountInfo(userNoAta);
      if (!userNoAtaInfo) {
        setupTx.add(createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          userNoAta,
          this.wallet.publicKey,
          noTokenMint
        ));
        needsSetup = true;
      }

      // Check and create team USDC ATA if needed
      const teamUsdcAtaInfo = await this.connection.getAccountInfo(teamUsdcAta);
      if (!teamUsdcAtaInfo) {
        setupTx.add(createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          teamUsdcAta,
          config.teamWallet,
          usdcMint
        ));
        needsSetup = true;
      }

      // Send setup transaction if needed
      if (needsSetup) {
        const setupSig = await this.wallet.sendTransaction(setupTx, this.connection);
        await this.connection.confirmTransaction(setupSig, 'confirmed');
      }

      // Build swap instruction manually for better control
      // Note: Optional accounts (recipient, recipient_yes_ata, recipient_no_ata) are omitted
      // when not using a different recipient - they should not be passed at all
      const swapKeys = [
        { pubkey: configPDA, isSigner: false, isWritable: true },
        { pubkey: config.teamWallet, isSigner: false, isWritable: false },
        { pubkey: marketPDA, isSigner: false, isWritable: true },
        { pubkey: globalVaultPDA, isSigner: false, isWritable: true },
        { pubkey: yesTokenMint, isSigner: false, isWritable: false },
        { pubkey: noTokenMint, isSigner: false, isWritable: false },
        { pubkey: globalYesAta, isSigner: false, isWritable: true },
        { pubkey: globalNoAta, isSigner: false, isWritable: true },
        { pubkey: userYesAta, isSigner: false, isWritable: true },
        { pubkey: userNoAta, isSigner: false, isWritable: true },
        { pubkey: userInfoPDA, isSigner: false, isWritable: true },
        { pubkey: usdcMint, isSigner: false, isWritable: false },
        { pubkey: marketUsdcAta, isSigner: false, isWritable: true },
        { pubkey: marketUsdcVaultPDA, isSigner: false, isWritable: false },
        { pubkey: userUsdcAta, isSigner: false, isWritable: true },
        { pubkey: teamUsdcAta, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        // Optional accounts: use program ID to indicate "None" for Anchor
        { pubkey: new PublicKey(this.dynamicConfig.programId), isSigner: false, isWritable: false }, // recipient (None)
        { pubkey: new PublicKey(this.dynamicConfig.programId), isSigner: false, isWritable: false }, // recipient_yes_ata (None)
        { pubkey: new PublicKey(this.dynamicConfig.programId), isSigner: false, isWritable: false }, // recipient_no_ata (None)
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ];

      // Encode swap instruction data
      const coder = new BorshCoder(idl as any);
      const amountBN = new BN(Math.floor(params.amount * USDC_MULTIPLIER));
      const direction = params.direction === 'buy' ? 0 : 1;
      // Contract defines: 0=NO, 1=YES
      const tokenType = params.tokenType === 'yes' ? 1 : 0;
      const minOutput = new BN(0); // Can be calculated with slippage
      const deadline = new BN(Math.floor(Date.now() / 1000) + 300); // 5 minutes

      // Use snake_case field names to match IDL exactly
      const swapData = coder.instruction.encode('swap', {
        amount: amountBN,
        direction,
        token_type: tokenType,
        minimum_receive_amount: minOutput,
        deadline,
      });

      const swapIx = new TransactionInstruction({
        keys: swapKeys,
        programId: new PublicKey(this.dynamicConfig.programId),
        data: swapData,
      });

      // Build transaction with compute budget
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }))
        .add(swapIx);

      // Get recent blockhash for simulation
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = this.wallet.publicKey;

      // Simulate transaction first to get detailed error
      const simulation = await this.connection.simulateTransaction(tx);

      if (simulation.value.err) {

        // Parse common errors for user-friendly messages
        const logs = simulation.value.logs || [];
        const errorLog = logs.find((log: string) => log.includes('Error Message:'));

        if (errorLog?.includes('TradeSizeTooLarge')) {
          const maxTradeAmount = market.totalLiquidity * 0.1;
          return {
            signature: '',
            success: false,
            error: `Trade size too large. Maximum allowed is 10% of pool reserve (~${maxTradeAmount.toFixed(2)} USDC). Try a smaller amount.`,
          };
        }

        if (errorLog?.includes('InsufficientLiquidity')) {
          return {
            signature: '',
            success: false,
            error: `Insufficient liquidity in the pool. The pool doesn't have enough reserves to complete this trade.`,
          };
        }

        return {
          signature: '',
          success: false,
          error: errorLog || `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
        };
      }

      // Send transaction
      const signature = await this.wallet.sendTransaction(tx, this.connection, {
        skipPreflight: true, // Skip preflight since we already simulated
        preflightCommitment: 'confirmed',
      });

      await this.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to swap:', error);

      // Extract more detailed error message
      let errorMessage = error.message || String(error);

      // Check for Solana program errors
      if (error.logs) {
        console.error('Transaction logs:', error.logs);
        const programError = error.logs.find((log: string) => log.includes('Error') || log.includes('failed'));
        if (programError) {
          errorMessage = programError;
        }
      }

      // Check for simulation error
      if (error.simulationResponse) {
        console.error('Simulation response:', error.simulationResponse);
        if (error.simulationResponse.err) {
          errorMessage = JSON.stringify(error.simulationResponse.err);
        }
      }

      // Check for SendTransactionError details
      if (error.transactionError) {
        errorMessage = JSON.stringify(error.transactionError);
      }

      return { signature: '', success: false, error: errorMessage };
    }
  }

  async mintCompleteSet(params: MintRedeemParams): Promise<TransactionResult> {
    if (!this.program || !this.wallet?.publicKey || !this.wallet.sendTransaction) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }

    try {
      const marketPubkey = new PublicKey(params.marketAddress);

      // Fetch market data
      const market = await this.getMarket(params.marketAddress);
      if (!market) {
        return { signature: '', success: false, error: 'Market not found' };
      }

      // Get config for USDC mint
      const config = await this.getConfigData();
      if (!config) {
        return { signature: '', success: false, error: 'Failed to get config' };
      }

      const usdcMint = config.usdcMint;
      const yesTokenMint = new PublicKey(market.yesMint);
      const noTokenMint = new PublicKey(market.noMint);

      // Derive PDAs
      const [configPDA] = this.getConfigPDA();
      const [globalVaultPDA] = this.getGlobalPDA();
      const [marketPDA] = this.getMarketPDAFromMints(yesTokenMint, noTokenMint);
      const [marketUsdcVaultPDA] = this.getMarketUsdcVaultPDA(marketPubkey);
      const [userInfoPDA] = this.getUserInfoPDA(this.wallet.publicKey, marketPubkey);

      // Get ATAs
      const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, this.wallet.publicKey);
      const userYesAta = getAssociatedTokenAddressSync(yesTokenMint, this.wallet.publicKey);
      const userNoAta = getAssociatedTokenAddressSync(noTokenMint, this.wallet.publicKey);
      const marketUsdcAta = getAssociatedTokenAddressSync(usdcMint, marketUsdcVaultPDA, true);

      // Build transaction - create ATAs if needed
      const tx = new Transaction();

      // Check if market USDC ATA exists
      const marketUsdcAtaInfo = await this.connection.getAccountInfo(marketUsdcAta);
      if (!marketUsdcAtaInfo) {
        tx.add(createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          marketUsdcAta,
          marketUsdcVaultPDA,
          usdcMint
        ));
      }

      // Build mint instruction using Anchor
      const amountBN = new BN(Math.floor(params.amount * USDC_MULTIPLIER));

      const mintIx = await (this.program.methods as any)
        .mintCompleteSet(amountBN)
        .accounts({
          globalConfig: configPDA,
          market: marketPDA,
          globalVault: globalVaultPDA,
          yesToken: yesTokenMint,
          noToken: noTokenMint,
          userYesAta,
          userNoAta,
          usdcMint,
          marketUsdcVault: marketUsdcVaultPDA,
          marketUsdcAta,
          userUsdcAta,
          userInfo: userInfoPDA,
          user: this.wallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .instruction();

      tx.add(mintIx);

      // Send transaction
      const signature = await this.wallet.sendTransaction(tx, this.connection);
      await this.connection.confirmTransaction(signature, 'confirmed');

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to mint complete set:', error);
      return { signature: '', success: false, error: error.message || String(error) };
    }
  }

  async redeemCompleteSet(params: MintRedeemParams): Promise<TransactionResult> {
    if (!this.program || !this.wallet?.publicKey || !this.wallet.sendTransaction) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }

    try {
      const marketPubkey = new PublicKey(params.marketAddress);

      // Fetch market data
      const market = await this.getMarket(params.marketAddress);
      if (!market) {
        return { signature: '', success: false, error: 'Market not found' };
      }

      // Get config for USDC mint
      const config = await this.getConfigData();
      if (!config) {
        return { signature: '', success: false, error: 'Failed to get config' };
      }

      const usdcMint = config.usdcMint;
      const yesTokenMint = new PublicKey(market.yesMint);
      const noTokenMint = new PublicKey(market.noMint);

      // Derive PDAs
      const [configPDA] = this.getConfigPDA();
      const [globalVaultPDA] = this.getGlobalPDA();
      const [marketPDA] = this.getMarketPDAFromMints(yesTokenMint, noTokenMint);
      const [marketUsdcVaultPDA, marketUsdcVaultBump] = this.getMarketUsdcVaultPDA(marketPubkey);
      const [userInfoPDA] = this.getUserInfoPDA(this.wallet.publicKey, marketPubkey);

      // Get ATAs
      const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, this.wallet.publicKey);
      const userYesAta = getAssociatedTokenAddressSync(yesTokenMint, this.wallet.publicKey);
      const userNoAta = getAssociatedTokenAddressSync(noTokenMint, this.wallet.publicKey);
      const marketUsdcAta = getAssociatedTokenAddressSync(usdcMint, marketUsdcVaultPDA, true);

      // Build redeem instruction using Anchor
      const amountBN = new BN(Math.floor(params.amount * USDC_MULTIPLIER));

      const signature = await (this.program.methods as any)
        .redeemCompleteSet(amountBN, marketUsdcVaultBump)
        .accounts({
          globalConfig: configPDA,
          market: marketPDA,
          globalVault: globalVaultPDA,
          marketUsdcVault: marketUsdcVaultPDA,
          usdcMint,
          marketUsdcAta,
          yesToken: yesTokenMint,
          noToken: noTokenMint,
          userYesAta,
          userNoAta,
          userUsdcAta,
          userInfo: userInfoPDA,
          user: this.wallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to redeem complete set:', error);
      return { signature: '', success: false, error: error.message || String(error) };
    }
  }

  // Liquidity operations
  async addLiquidity(params: AddLiquidityParams): Promise<TransactionResult> {
    if (!this.program || !this.wallet?.publicKey || !this.wallet.sendTransaction) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }

    try {
      const marketPubkey = new PublicKey(params.marketAddress);

      // Fetch market data
      const market = await this.getMarket(params.marketAddress);
      if (!market) {
        return { signature: '', success: false, error: 'Market not found' };
      }

      // Get config for USDC mint
      const config = await this.getConfigData();
      if (!config) {
        return { signature: '', success: false, error: 'Failed to get config' };
      }

      const usdcMint = config.usdcMint;
      const yesTokenMint = new PublicKey(market.yesMint);
      const noTokenMint = new PublicKey(market.noMint);

      // Derive PDAs
      const [configPDA] = this.getConfigPDA();
      const [globalVaultPDA] = this.getGlobalPDA();
      const [marketPDA] = this.getMarketPDAFromMints(yesTokenMint, noTokenMint);
      const [marketUsdcVaultPDA] = this.getMarketUsdcVaultPDA(marketPubkey);
      const [lpPositionPDA] = this.getLPPositionPDA(marketPubkey, this.wallet.publicKey);

      // Get ATAs
      const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, this.wallet.publicKey);
      const globalYesAta = getAssociatedTokenAddressSync(yesTokenMint, globalVaultPDA, true);
      const globalNoAta = getAssociatedTokenAddressSync(noTokenMint, globalVaultPDA, true);
      const marketUsdcAta = getAssociatedTokenAddressSync(usdcMint, marketUsdcVaultPDA, true);

      // Check if market USDC ATA exists, create if not
      const marketUsdcAtaInfo = await this.connection.getAccountInfo(marketUsdcAta);
      if (!marketUsdcAtaInfo) {
        const createAtaTx = new Transaction();
        createAtaTx.add(createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          marketUsdcAta,
          marketUsdcVaultPDA,
          usdcMint
        ));
        const createAtaSig = await this.wallet.sendTransaction(createAtaTx, this.connection);
        await this.connection.confirmTransaction(createAtaSig, 'confirmed');
      }

      // Build add liquidity instruction
      const amountBN = new BN(Math.floor(params.amount * USDC_MULTIPLIER));

      const signature = await (this.program.methods as any)
        .addLiquidity(amountBN)
        .accounts({
          globalConfig: configPDA,
          market: marketPDA,
          yesToken: yesTokenMint,
          noToken: noTokenMint,
          globalVault: globalVaultPDA,
          globalYesAta,
          globalNoAta,
          usdcMint,
          marketUsdcAta,
          marketUsdcVault: marketUsdcVaultPDA,
          userUsdcAta,
          lpPosition: lpPositionPDA,
          user: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to add liquidity:', error);

      // Provide user-friendly error messages
      let errorMessage = error.message || String(error);
      if (errorMessage.includes('ValueTooSmall')) {
        errorMessage = 'Amount too small. Minimum liquidity is 10 USDC.';
      } else if (errorMessage.includes('MintAuthorityNotTransferred') || errorMessage.includes('6071')) {
        errorMessage = 'Market mint authority has not been transferred. The market creator needs to call setMintAuthority first.';
      }

      return { signature: '', success: false, error: errorMessage };
    }
  }

  async withdrawLiquidity(params: WithdrawLiquidityParams): Promise<TransactionResult> {
    if (!this.program || !this.wallet?.publicKey || !this.wallet.sendTransaction) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }

    try {
      const marketPubkey = new PublicKey(params.marketAddress);

      // Fetch market data
      const market = await this.getMarket(params.marketAddress);
      if (!market) {
        return { signature: '', success: false, error: 'Market not found' };
      }

      // Get config for USDC mint
      const config = await this.getConfigData();
      if (!config) {
        return { signature: '', success: false, error: 'Failed to get config' };
      }

      const usdcMint = config.usdcMint;
      const yesTokenMint = new PublicKey(market.yesMint);
      const noTokenMint = new PublicKey(market.noMint);

      // Derive PDAs
      const [configPDA] = this.getConfigPDA();
      const [globalVaultPDA] = this.getGlobalPDA();
      const [marketPDA] = this.getMarketPDAFromMints(yesTokenMint, noTokenMint);
      const [marketUsdcVaultPDA] = this.getMarketUsdcVaultPDA(marketPubkey);
      const [lpPositionPDA] = this.getLPPositionPDA(marketPubkey, this.wallet.publicKey);

      // Check LP position first
      let lpPosition: any;
      try {
        lpPosition = await (this.program.account as any).lpPosition.fetch(lpPositionPDA);
      } catch {
        return { signature: '', success: false, error: 'No LP position found. You need to add liquidity first.' };
      }

      // Validate sufficient LP shares
      const lpSharesBN = lpPosition.lpShares || new BN(0);
      if (lpSharesBN.eq(new BN(0))) {
        const investedUsdc = lpPosition.investedUsdc || new BN(0);
        if (investedUsdc.gt(new BN(0))) {
          const investedAmount = (investedUsdc.toNumber() / USDC_MULTIPLIER).toFixed(2);
          return {
            signature: '',
            success: false,
            error: `Unable to withdraw: You invested ${investedAmount} USDC, but have 0 withdrawable LP shares. The first 10 USDC is permanently locked (MIN_LIQUIDITY). Add more liquidity to get withdrawable shares.`,
          };
        }
      }

      // Get ATAs
      const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, this.wallet.publicKey);
      const globalYesAta = getAssociatedTokenAddressSync(yesTokenMint, globalVaultPDA, true);
      const globalNoAta = getAssociatedTokenAddressSync(noTokenMint, globalVaultPDA, true);
      const marketUsdcAta = getAssociatedTokenAddressSync(usdcMint, marketUsdcVaultPDA, true);

      // Build withdraw instruction
      const lpAmountBN = new BN(Math.floor(params.lpAmount * USDC_MULTIPLIER));
      const minUsdcOut = new BN(0); // Can be calculated with slippage

      const withdrawIx = await (this.program.methods as any)
        .withdrawLiquidity(lpAmountBN, minUsdcOut)
        .accounts({
          globalConfig: configPDA,
          market: marketPDA,
          yesToken: yesTokenMint,
          noToken: noTokenMint,
          globalVault: globalVaultPDA,
          globalYesAta,
          globalNoAta,
          usdcMint,
          marketUsdcAta,
          marketUsdcVault: marketUsdcVaultPDA,
          userUsdcAta,
          lpPosition: lpPositionPDA,
          user: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .instruction();

      // Build transaction with compute budget
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }))
        .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }))
        .add(withdrawIx);

      // Send transaction
      const signature = await this.wallet.sendTransaction(tx, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await this.connection.confirmTransaction(signature, 'confirmed');

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to withdraw liquidity:', error);
      return { signature: '', success: false, error: error.message || String(error) };
    }
  }

  // User data
  async getUserPositions(userAddress: string): Promise<UserPosition[]> {
    try {
      const provider = this.createReadOnlyProvider();
      const program = new Program(idl as any, provider);
      const userPubkey = new PublicKey(userAddress);

      // Fetch all markets to check user's positions
      const marketAccounts = await (program.account as any).market.all();

      // Fetch all LP positions for this user
      const lpPositionAccounts = await (program.account as any).lpPosition?.all([
        {
          memcmp: {
            offset: 8, // After discriminator, user pubkey is first field
            bytes: userPubkey.toBase58(),
          },
        },
      ]) ?? [];

      // Create a map of market -> LP shares for quick lookup
      const lpSharesMap = new Map<string, number>();
      for (const lp of lpPositionAccounts) {
        const marketAddr = lp.account.market?.toBase58();
        const shares = (lp.account.lpShares?.toNumber() || 0) / 1e6;
        if (marketAddr && shares > 0) {
          lpSharesMap.set(marketAddr, shares);
        }
      }

      const positions: UserPosition[] = [];

      // Check each market for user's YES/NO token balances
      for (const marketAccount of marketAccounts) {
        const marketAddress = marketAccount.publicKey.toBase58();
        const account = marketAccount.account;

        const yesMint = account.yesTokenMint || account.yesMint;
        const noMint = account.noTokenMint || account.noMint;

        if (!yesMint || !noMint) continue;

        // Get user's token account addresses
        const userYesAta = getAssociatedTokenAddressSync(yesMint, userPubkey);
        const userNoAta = getAssociatedTokenAddressSync(noMint, userPubkey);

        // Fetch token account balances
        let yesBalance = 0;
        let noBalance = 0;

        try {
          const yesAccountInfo = await this.connection.getTokenAccountBalance(userYesAta);
          yesBalance = parseFloat(yesAccountInfo.value.uiAmountString || '0');
        } catch {
          // Token account doesn't exist - user has no YES tokens
        }

        try {
          const noAccountInfo = await this.connection.getTokenAccountBalance(userNoAta);
          noBalance = parseFloat(noAccountInfo.value.uiAmountString || '0');
        } catch {
          // Token account doesn't exist - user has no NO tokens
        }

        // Get LP balance from the map
        const lpBalance = lpSharesMap.get(marketAddress) || 0;

        // Only include if user has any position in this market
        if (yesBalance > 0 || noBalance > 0 || lpBalance > 0) {
          positions.push({
            marketAddress,
            yesBalance,
            noBalance,
            lpBalance,
            realizedPnl: 0, // PnL tracking would require historical data
          });
        }
      }

      return positions;
    } catch (error) {
      console.error('Failed to get user positions:', error);
      return [];
    }
  }

  // Helper to format market data
  private formatMarket(accountData: { publicKey: PublicKey; account: any }): Market {
    const { publicKey, account } = accountData;

    // Contract stores createdAt as Unix timestamp in SECONDS, convert to milliseconds
    const createdAtSeconds = account.createdAt?.toNumber() || 0;
    const createdAtMs = createdAtSeconds > 0 ? createdAtSeconds * 1000 : Date.now();

    // Get prices first (needed for total pool value calculation)
    const yesPrice = this.calculatePrice(account, 'yes');
    const noPrice = this.calculatePrice(account, 'no');

    // Get pool reserves (in USDC decimals, divide by 1e6)
    const poolCollateralReserve = ((account.poolCollateralReserve || account.totalLiquidity)?.toNumber() || 0) / 1e6;
    const poolYesReserve = ((account.poolYesReserve)?.toNumber() || 0) / 1e6;
    const poolNoReserve = ((account.poolNoReserve)?.toNumber() || 0) / 1e6;
    const totalLpShares = ((account.totalLpShares)?.toNumber() || 0) / 1e6;

    // Calculate total pool value: USDC + (YES tokens * YES price) + (NO tokens * NO price)
    // This represents the total economic value of the pool
    const yesValue = poolYesReserve * yesPrice;
    const noValue = poolNoReserve * noPrice;
    const totalPoolValue = poolCollateralReserve + yesValue + noValue;

    return {
      address: publicKey.toBase58(),
      // Contract uses 'displayName' for the market name/question
      name: account.displayName || account.name || '',
      metadataUri: account.metadataUri || account.yesUri || '',
      creator: account.creator?.toBase58() || '',
      // Contract uses yesTokenMint/noTokenMint
      yesMint: (account.yesTokenMint || account.yesMint)?.toBase58() || '',
      noMint: (account.noTokenMint || account.noMint)?.toBase58() || '',
      collateralVault: account.collateralVault?.toBase58() || '',
      status: this.getMarketStatus(account),
      // Contract uses lmsrB for b parameter
      bParameter: (account.lmsrB || account.bParameter)?.toNumber() || 500,
      // Liquidity breakdown
      totalLiquidity: poolCollateralReserve,
      poolYesReserve,
      poolNoReserve,
      totalLpShares,
      totalPoolValue,
      // Prices
      yesPrice,
      noPrice,
      createdAt: createdAtMs,
    };
  }

  private getMarketStatus(account: any): 'active' | 'paused' | 'resolved' {
    // Check various status indicators from the contract
    if (account.isCompleted) return 'resolved';
    if (account.marketPaused) return 'paused';
    if (account.status?.active) return 'active';
    if (account.status?.paused) return 'paused';
    if (account.status?.resolved) return 'resolved';
    return 'active';
  }

  private calculatePrice(account: any, tokenType: 'yes' | 'no'): number {
    // Contract stores values with 6 decimal places (like USDC)
    // b and q values need to be in the same scale for the formula to work
    const rawB = (account.lmsrB || account.lmsr_b || account.bParameter)?.toNumber() || 500000000;
    const rawQYes = (account.lmsrQYes || account.lmsr_q_yes || account.qYes)?.toNumber() || 0;
    const rawQNo = (account.lmsrQNo || account.lmsr_q_no || account.qNo)?.toNumber() || 0;

    // Scale all values consistently (divide by 1e6)
    const b = rawB / 1e6;
    const qYes = rawQYes / 1e6;
    const qNo = rawQNo / 1e6;

    // LMSR price formula: price = exp(q/b) / sum(exp(qi/b))
    const expYes = Math.exp(qYes / b);
    const expNo = Math.exp(qNo / b);
    const total = expYes + expNo;

    if (tokenType === 'yes') {
      return total > 0 ? expYes / total : 0.5;
    } else {
      return total > 0 ? expNo / total : 0.5;
    }
  }
}

// Singleton instance
let solanaAdapter: SolanaAdapter | null = null;

export function getSolanaAdapter(): SolanaAdapter {
  if (!solanaAdapter) {
    solanaAdapter = new SolanaAdapter();
  }
  return solanaAdapter;
}
