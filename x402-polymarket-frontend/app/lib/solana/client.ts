import { Connection, PublicKey, SystemProgram, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { BN, Program } from '@coral-xyz/anchor';
import {
  getPredictionMarketProgram,
  PDAHelper,
  parseUSDC,
  formatUSDC,
  PROGRAM_CONFIG,
} from './program';
import type {
  Market,
  Config,
  UserInfo,
  CreateMarketParams,
  SwapParams,
  AddLiquidityParams,
  WithdrawLiquidityParams,
  MintCompleteSetParams,
  RedeemCompleteSetParams,
  TransactionResult,
  TokenType,
  TradeDirection,
  PredictionMarket,
} from './types';

/**
 * Prediction Market Client
 * Handles all interactions with the prediction market program
 */
export class PredictionMarketClient {
  private program: Program<PredictionMarket>;
  private connection: Connection;
  public wallet: any;

  constructor(connection: Connection, wallet: any) {
    this.connection = connection;
    this.wallet = wallet;
    this.program = getPredictionMarketProgram(connection, wallet);
  }

  /**
   * Fetch global config
   */
  async getConfig(): Promise<Config | null> {
    try {
      const [configPDA] = PDAHelper.getConfigPDA();
      const config = await this.program.account.config.fetch(configPDA);
      return config as Config;
    } catch (error) {
      console.error('Failed to fetch config:', error);
      return null;
    }
  }

  /**
   * Fetch market data
   */
  async getMarket(marketAddress: PublicKey): Promise<Market | null> {
    try {
      const market = await this.program.account.market.fetch(marketAddress);
      return market as Market;
    } catch (error) {
      console.error('Failed to fetch market:', error);
      return null;
    }
  }

  /**
   * Fetch user info for a specific market (includes token balances and LP position)
   */
  async getUserInfo(userAddress: PublicKey, marketAddress: PublicKey): Promise<UserInfo | null> {
    try {
      // Get market data to find YES/NO token mints
      const market = await this.getMarket(marketAddress);
      if (!market) {
        console.error('[getUserInfo] Market not found');
        return null;
      }

      // Fetch user_info PDA (trading stats)
      const [userInfoPDA] = PDAHelper.getUserInfoPDA(userAddress, marketAddress);
      let userInfo: any = null;
      try {
        userInfo = await this.program.account.userInfo.fetch(userInfoPDA);
      } catch (e: any) {
        if (e?.message?.includes('Account does not exist')) {
          // User hasn't traded yet, create empty user info
          userInfo = {
            user: userAddress,
            market: marketAddress,
            realizedPnl: new BN(0),
          };
        } else {
          throw e;
        }
      }

      // Fetch YES token balance
      const userYesAta = await getAssociatedTokenAddress(
        market.yesTokenMint,
        userAddress
      );
      let yesAmount = new BN(0);
      try {
        const yesAccount = await this.connection.getTokenAccountBalance(userYesAta);
        yesAmount = new BN(yesAccount.value.amount);
      } catch (e) {
        // Account doesn't exist, balance is 0
      }

      // Fetch NO token balance
      const userNoAta = await getAssociatedTokenAddress(
        market.noTokenMint,
        userAddress
      );
      let noAmount = new BN(0);
      try {
        const noAccount = await this.connection.getTokenAccountBalance(userNoAta);
        noAmount = new BN(noAccount.value.amount);
      } catch (e) {
        // Account doesn't exist, balance is 0
      }

      // Fetch LP shares from LP position
      const [lpPositionPDA] = PDAHelper.getLPPositionPDA(marketAddress, userAddress);
      let lpShares = new BN(0);
      try {
        const lpPosition = await this.program.account.lpPosition.fetch(lpPositionPDA);
        lpShares = (lpPosition as any).shares || new BN(0);
      } catch (e: any) {
        // No LP position, shares is 0
      }

      return {
        ...userInfo,
        yesAmount,
        noAmount,
        lpShares,
      } as UserInfo;
    } catch (error: any) {
      console.error('Failed to fetch user info:', error);
      return null;
    }
  }

  /**
   * Fetch all markets
   */
  async getAllMarkets(): Promise<{ address: PublicKey; data: Market }[]> {
    try {
      const markets = await this.program.account.market.all();
      return markets.map((m) => ({
        address: m.publicKey,
        data: m.account as Market,
      }));
    } catch (error) {
      console.error('Failed to fetch markets:', error);
      return [];
    }
  }

  /**
   * Create a new prediction market
   */
  async createMarket(params: CreateMarketParams): Promise<TransactionResult> {
    try {
      const [configPDA] = PDAHelper.getConfigPDA();
      const [globalVaultPDA] = PDAHelper.getGlobalVaultPDA();

      // Get config to retrieve team wallet
      const config = await this.getConfig();
      if (!config) throw new Error('Config not found');

      // Generate keypair for YES token mint
      const yesTokenMint = Keypair.generate();

      // NO token must already exist - generate keypair and create it first
      const noTokenMint = Keypair.generate();

      const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

      // Get NO token metadata PDA
      const [noMetadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          METADATA_PROGRAM_ID.toBuffer(),
          noTokenMint.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );

      // Get global NO token account
      const globalNoTokenAccount = await getAssociatedTokenAddress(
        noTokenMint.publicKey,
        globalVaultPDA,
        true
      );

      // Create NO token mint with global_vault as authority
      console.log('[createMarket] Creating NO token mint instruction...');
      console.log('[createMarket] IDL address:', (this.program as any)._idl?.address);
      console.log('[createMarket] Program ID:', this.program.programId.toBase58());

      // Check if mintNoToken exists
      const methodBuilder = this.program.methods.mintNoToken({
        noSymbol: `NO_${params.yesSymbol}`,
        noUri: params.yesUri,
      });

      console.log('[createMarket] Method builder created:', methodBuilder);
      console.log('[createMarket] Method builder type:', typeof methodBuilder);

      // Try building instruction with accounts
      let createNoMintIx;
      try {
        // Use remainingAccounts to manually add all accounts in the correct order
        const { Transaction, TransactionInstruction } = await import('@solana/web3.js');

        // Manually build the instruction with all accounts
        const keys = [
          { pubkey: configPDA, isSigner: false, isWritable: true }, // global_config
          { pubkey: globalVaultPDA, isSigner: false, isWritable: true }, // global_vault
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true }, // creator
          { pubkey: noTokenMint.publicKey, isSigner: true, isWritable: true }, // no_token
          { pubkey: noMetadataPDA, isSigner: false, isWritable: true }, // no_token_metadata_account
          { pubkey: globalNoTokenAccount, isSigner: false, isWritable: true }, // global_no_token_account
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
          { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }, // rent
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
          { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false }, // mpl_token_metadata_program
        ];

        // Get discriminator from IDL
        const discriminator = Buffer.from([198, 161, 208, 188, 122, 69, 236, 128]);

        // Encode args (noSymbol and noUri as strings)
        const noSymbol = `NO_${params.yesSymbol}`;
        const noUri = params.yesUri;

        // Manually encode the instruction data
        const { BorshCoder } = await import('@coral-xyz/anchor');
        const coder = new BorshCoder((this.program as any)._idl);
        const data = coder.instruction.encode('mintNoToken', {
          noSymbol,
          noUri,
        });

        createNoMintIx = new TransactionInstruction({
          keys,
          programId: this.program.programId,
          data,
        });

        console.log('[createMarket] NO token instruction created successfully (manual)');
      } catch (error: any) {
        console.error('[createMarket] Error details:', {
          message: error.message,
          stack: error.stack,
          error: error,
        });
        throw error;
      }

      const [marketPDA] = PDAHelper.getMarketPDA(
        yesTokenMint.publicKey,
        noTokenMint.publicKey
      );

      // Get whitelist PDA - check if whitelist is enabled
      const [whitelistPDA] = PDAHelper.getWhitelistPDA(this.wallet.publicKey);

      // Check if whitelist account exists
      let whitelistAccount;
      try {
        whitelistAccount = await this.connection.getAccountInfo(whitelistPDA);
      } catch (e) {
        whitelistAccount = null;
      }

      console.log('[createMarket] Whitelist enabled:', config.whitelistEnabled);
      console.log('[createMarket] Whitelist account exists:', whitelistAccount !== null);

      // Get YES token metadata PDA
      const [yesMetadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          METADATA_PROGRAM_ID.toBuffer(),
          yesTokenMint.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );

      // Get global YES token account
      const globalYesTokenAccount = await getAssociatedTokenAddress(
        yesTokenMint.publicKey,
        globalVaultPDA,
        true
      );

      // Manually build the create_market instruction
      console.log('[createMarket] Building create_market instruction manually...');

      const { TransactionInstruction } = await import('@solana/web3.js');
      const { BorshCoder } = await import('@coral-xyz/anchor');

      // Use program ID for optional whitelist account if not needed
      const whitelistAccountKey = (config.whitelistEnabled && whitelistAccount)
        ? whitelistPDA
        : this.program.programId;

      console.log('[createMarket] Using whitelist account:', whitelistAccountKey.toBase58());

      const createMarketKeys = [
        { pubkey: configPDA, isSigner: false, isWritable: true }, // global_config
        { pubkey: globalVaultPDA, isSigner: false, isWritable: true }, // global_vault
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true }, // creator
        { pubkey: whitelistAccountKey, isSigner: false, isWritable: false }, // creator_whitelist (optional)
        { pubkey: yesTokenMint.publicKey, isSigner: true, isWritable: true }, // yes_token
        { pubkey: noTokenMint.publicKey, isSigner: false, isWritable: false }, // no_token
        { pubkey: marketPDA, isSigner: false, isWritable: true }, // market
        { pubkey: yesMetadataPDA, isSigner: false, isWritable: true }, // yes_token_metadata_account
        { pubkey: noMetadataPDA, isSigner: false, isWritable: true }, // no_token_metadata_account
        { pubkey: globalYesTokenAccount, isSigner: false, isWritable: true }, // global_yes_token_account
        { pubkey: globalNoTokenAccount, isSigner: false, isWritable: true }, // global_no_token_account
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }, // rent
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
        { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false }, // mpl_token_metadata_program
        { pubkey: config.teamWallet, isSigner: false, isWritable: true }, // team_wallet (needs to be writable)
      ];

      // Encode create_market args with correct field names and types
      const coder = new BorshCoder((this.program as any)._idl);
      const createMarketData = coder.instruction.encode('createMarket', {
        params: {
          yesSymbol: params.yesSymbol,
          yesUri: params.yesUri,
          startSlot: params.startSlot ? new BN(params.startSlot) : null,
          endingSlot: params.endingSlot ? new BN(params.endingSlot) : null,
          displayName: params.yesSymbol, // Use symbol as display name for now
          initialYesProb: 5000, // 50% default probability (in basis points)
        }
      });

      const createMarketIx = new TransactionInstruction({
        keys: createMarketKeys,
        programId: this.program.programId,
        data: createMarketData,
      });

      console.log('[createMarket] create_market instruction built successfully');

      // Build set_mint_authority instruction
      console.log('[createMarket] Building set_mint_authority instruction...');

      const setMintAuthorityKeys = [
        { pubkey: configPDA, isSigner: false, isWritable: false }, // global_config
        { pubkey: globalVaultPDA, isSigner: false, isWritable: true }, // global_vault
        { pubkey: yesTokenMint.publicKey, isSigner: false, isWritable: true }, // yes_token
        { pubkey: noTokenMint.publicKey, isSigner: false, isWritable: true }, // no_token
        { pubkey: marketPDA, isSigner: false, isWritable: false }, // market
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false }, // authority
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
      ];

      const setMintAuthorityData = coder.instruction.encode('setMintAuthority', {});

      const setMintAuthorityIx = new TransactionInstruction({
        keys: setMintAuthorityKeys,
        programId: this.program.programId,
        data: setMintAuthorityData,
      });

      console.log('[createMarket] set_mint_authority instruction built successfully');

      // Build transaction with all three instructions
      const { Transaction } = await import('@solana/web3.js');
      const tx = new Transaction();

      // Add all three instructions in order
      tx.add(createNoMintIx);        // 1. Create NO mint
      tx.add(createMarketIx);        // 2. Create market
      tx.add(setMintAuthorityIx);    // 3. Transfer mint authority to market PDA

      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = this.wallet.publicKey;

      console.log('[createMarket] Blockhash obtained:', blockhash);

      // Sign with keypairs first (NO token for first ix, YES token for second ix)
      tx.sign(noTokenMint, yesTokenMint);

      console.log('[createMarket] Keypairs signed, requesting wallet signature...');

      // Then sign with wallet
      const signedTx = await this.wallet.signTransaction(tx);

      console.log('[createMarket] Wallet signed, sending transaction...');

      // Send with skipPreflight to avoid simulation issues
      const signature = await this.connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      console.log('[createMarket] Transaction sent:', signature);

      // Wait for confirmation with processed commitment
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      console.log('[createMarket] Transaction confirmed:', confirmation);

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to create market:', error);
      return { signature: '', success: false, error: error.message };
    }
  }

  /**
   * Transfer mint authority to market PDA (Required before adding liquidity)
   * This must be called after createMarket to enable single-sided LP functionality
   */
  async setMintAuthority(params: { yesTokenMint: PublicKey; noTokenMint: PublicKey }): Promise<TransactionResult> {
    try {
      console.log('[setMintAuthority] Starting mint authority transfer...');

      const [configPDA] = PDAHelper.getConfigPDA();
      const [globalVaultPDA] = PDAHelper.getGlobalVaultPDA();
      const [marketPDA] = PDAHelper.getMarketPDA(params.yesTokenMint, params.noTokenMint);

      console.log('[setMintAuthority] Config PDA:', configPDA.toBase58());
      console.log('[setMintAuthority] Global Vault PDA:', globalVaultPDA.toBase58());
      console.log('[setMintAuthority] Market PDA:', marketPDA.toBase58());
      console.log('[setMintAuthority] YES Token Mint:', params.yesTokenMint.toBase58());
      console.log('[setMintAuthority] NO Token Mint:', params.noTokenMint.toBase58());

      // Call set_mint_authority instruction
      const signature = await this.program.methods
        .setMintAuthority()
        .accounts({
          globalConfig: configPDA,
          globalVault: globalVaultPDA,
          yesToken: params.yesTokenMint,
          noToken: params.noTokenMint,
          market: marketPDA,
          authority: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log('[setMintAuthority] Transaction sent:', signature);

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');

      console.log('[setMintAuthority] Mint authority transferred successfully');

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to set mint authority:', error);
      return { signature: '', success: false, error: error.message };
    }
  }

  /**
   * Swap tokens (buy/sell YES or NO tokens)
   */
  async swap(params: SwapParams): Promise<TransactionResult> {
    try {
      const market = await this.getMarket(params.market);
      if (!market) throw new Error('Market not found');

      console.log('[swap] Market data keys:', Object.keys(market));
      console.log('[swap] yesTokenMint:', market.yesTokenMint);
      console.log('[swap] noTokenMint:', market.noTokenMint);
      console.log('[swap] poolYesReserve:', market.poolYesReserve?.toString());
      console.log('[swap] poolNoReserve:', market.poolNoReserve?.toString());
      console.log('[swap] poolCollateralReserve:', market.poolCollateralReserve?.toString());

      if (!market.yesTokenMint || !market.noTokenMint) {
        throw new Error('Market token mints not found. Market data: ' + JSON.stringify(market, null, 2));
      }

      // Check if market has liquidity
      const hasLiquidity = market.poolYesReserve && market.poolNoReserve &&
                          market.poolYesReserve.toNumber() > 0 &&
                          market.poolNoReserve.toNumber() > 0;

      if (!hasLiquidity) {
        throw new Error('This market has no liquidity. Please add liquidity first before trading.');
      }

      // Determine recipient (defaults to wallet.publicKey if not specified)
      const recipient = params.recipient || this.wallet.publicKey;
      console.log('[swap] Recipient:', recipient.toBase58());

      const [configPDA] = PDAHelper.getConfigPDA();
      const [globalVaultPDA] = PDAHelper.getGlobalVaultPDA();
      const [marketPDA] = PDAHelper.getMarketPDA(market.yesTokenMint, market.noTokenMint);
      const [marketUsdcVaultPDA] = PDAHelper.getMarketUsdcVaultPDA(params.market);
      // User info PDA is for the payer (who executes the transaction)
      const [userInfoPDA] = PDAHelper.getUserInfoPDA(this.wallet.publicKey, params.market);

      const config = await this.getConfig();
      if (!config) throw new Error('Config not found');

      // Get USDC mint from config (market doesn't have usdcMint field)
      const usdcMint = config.usdcMint;

      // Get user's USDC ATA (payer)
      const userUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        this.wallet.publicKey
      );

      // Get user's YES/NO token ATAs (for the payer)
      const userYesAta = await getAssociatedTokenAddress(
        market.yesTokenMint,
        this.wallet.publicKey
      );
      const userNoAta = await getAssociatedTokenAddress(
        market.noTokenMint,
        this.wallet.publicKey
      );

      // Get recipient's YES/NO token ATAs (where tokens will be sent)
      const recipientYesAta = await getAssociatedTokenAddress(
        market.yesTokenMint,
        recipient
      );
      const recipientNoAta = await getAssociatedTokenAddress(
        market.noTokenMint,
        recipient
      );

      // Global vault token accounts
      const globalYesAta = await getAssociatedTokenAddress(
        market.yesTokenMint,
        globalVaultPDA,
        true
      );
      const globalNoAta = await getAssociatedTokenAddress(
        market.noTokenMint,
        globalVaultPDA,
        true
      );

      // Market USDC vault ATA
      const marketUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        marketUsdcVaultPDA,
        true
      );

      // Team USDC ATA
      const teamUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        config.teamWallet
      );

      // Pre-create recipient token accounts and team wallet ATA to reduce CU usage in swap
      const { Transaction } = await import('@solana/web3.js');
      const setupTx = new Transaction();
      let needsSetup = false;

      // Check if recipient YES token account exists
      const recipientYesAtaInfo = await this.connection.getAccountInfo(recipientYesAta);
      if (!recipientYesAtaInfo) {
        console.log('[swap] Recipient YES token ATA does not exist, will create it...');
        const createYesAtaIx = createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          recipientYesAta,
          recipient,
          market.yesTokenMint
        );
        setupTx.add(createYesAtaIx);
        needsSetup = true;
      } else {
        console.log('[swap] Recipient YES token ATA already exists');
      }

      // Check if recipient NO token account exists
      const recipientNoAtaInfo = await this.connection.getAccountInfo(recipientNoAta);
      if (!recipientNoAtaInfo) {
        console.log('[swap] Recipient NO token ATA does not exist, will create it...');
        const createNoAtaIx = createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          recipientNoAta,
          recipient,
          market.noTokenMint
        );
        setupTx.add(createNoAtaIx);
        needsSetup = true;
      } else {
        console.log('[swap] Recipient NO token ATA already exists');
      }

      // Check if team wallet USDC ATA exists
      const teamUsdcAtaInfo = await this.connection.getAccountInfo(teamUsdcAta);
      if (!teamUsdcAtaInfo) {
        console.log('[swap] Team wallet USDC ATA does not exist, will create it...');
        const createTeamAtaIx = createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          teamUsdcAta,
          config.teamWallet,
          usdcMint
        );
        setupTx.add(createTeamAtaIx);
        needsSetup = true;
      } else {
        console.log('[swap] Team wallet USDC ATA already exists');
      }

      // If we need to create any accounts, send setup transaction first
      if (needsSetup) {
        try {
          console.log('[swap] Sending setup transaction to create token accounts...');
          const setupSig = await this.wallet.sendTransaction(setupTx, this.connection);
          console.log('[swap] Setup transaction sent:', setupSig);
          await this.connection.confirmTransaction(setupSig, 'confirmed');
          console.log('[swap] Setup transaction confirmed - all accounts created');
        } catch (setupError: any) {
          console.error('[swap] Failed to create token accounts:', setupError);
          throw new Error(`Failed to create token accounts: ${setupError.message}`);
        }
      } else {
        console.log('[swap] All token accounts already exist, proceeding with swap');
      }

      // Manually build swap instruction to avoid Anchor validation issues
      const { TransactionInstruction, sendAndConfirmTransaction, ComputeBudgetProgram } = await import('@solana/web3.js');
      const { BorshCoder } = await import('@coral-xyz/anchor');

      const swapKeys = [
        { pubkey: configPDA, isSigner: false, isWritable: true }, // global_config
        { pubkey: config.teamWallet, isSigner: false, isWritable: true }, // team_wallet
        { pubkey: marketPDA, isSigner: false, isWritable: true }, // market
        { pubkey: globalVaultPDA, isSigner: false, isWritable: true }, // global_vault
        { pubkey: market.yesTokenMint, isSigner: false, isWritable: false }, // yes_token
        { pubkey: market.noTokenMint, isSigner: false, isWritable: false }, // no_token
        { pubkey: globalYesAta, isSigner: false, isWritable: true }, // global_yes_ata
        { pubkey: globalNoAta, isSigner: false, isWritable: true }, // global_no_ata
        { pubkey: userYesAta, isSigner: false, isWritable: true }, // user_yes_ata
        { pubkey: userNoAta, isSigner: false, isWritable: true }, // user_no_ata
        { pubkey: userInfoPDA, isSigner: false, isWritable: true }, // user_info
        { pubkey: usdcMint, isSigner: false, isWritable: false }, // usdc_mint
        { pubkey: marketUsdcAta, isSigner: false, isWritable: true }, // market_usdc_ata
        { pubkey: marketUsdcVaultPDA, isSigner: false, isWritable: true }, // market_usdc_vault
        { pubkey: userUsdcAta, isSigner: false, isWritable: true }, // user_usdc_ata
        { pubkey: teamUsdcAta, isSigner: false, isWritable: true }, // team_usdc_ata
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true }, // user (payer)
        { pubkey: recipient, isSigner: false, isWritable: true }, // recipient (who receives tokens)
        { pubkey: recipientYesAta, isSigner: false, isWritable: true }, // recipient_yes_ata
        { pubkey: recipientNoAta, isSigner: false, isWritable: true }, // recipient_no_ata
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
      ];

      const coder = new BorshCoder((this.program as any)._idl);
      const swapData = coder.instruction.encode('swap', {
        amount: parseUSDC(params.amount),
        direction: params.direction, // 0 = Buy, 1 = Sell
        tokenType: params.tokenType, // 0 = Yes, 1 = No
        minimumReceiveAmount: params.minOutput ? parseUSDC(params.minOutput) : new BN(0),
        deadline: new BN(Math.floor(Date.now() / 1000) + 300), // 5 minutes from now
      });

      const swapIx = new TransactionInstruction({
        keys: swapKeys,
        programId: this.program.programId,
        data: swapData,
      });

      // Add compute budget instructions to avoid CU limit errors
      console.log('[swap] Adding compute budget instructions (1.4M CU limit + heap frame)...');
      const computeUnitsIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1_400_000, // Request 1.4M compute units (absolute maximum allowed by Solana)
      });

      // Request additional heap memory for complex LMSR calculations
      const heapFrameIx = ComputeBudgetProgram.requestHeapFrame({
        bytes: 256 * 1024, // 256 KB heap (maximum allowed)
      });

      // Note: Removed setComputeUnitPrice to save ~150 CU for the swap instruction
      const tx = new Transaction()
        .add(computeUnitsIx)
        .add(heapFrameIx)
        .add(swapIx);

      // Simulate transaction first to get better error messages
      console.log('[swap] Simulating transaction...');
      try {
        const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = this.wallet.publicKey;

        const simulation = await this.connection.simulateTransaction(tx);

        if (simulation.value.err) {
          console.error('[swap] Simulation failed:', simulation.value.err);
          console.error('[swap] Simulation logs:', simulation.value.logs);

          // Try to extract meaningful error from logs
          const errorLog = simulation.value.logs?.find(log =>
            log.includes('Error:') || log.includes('failed') || log.includes('AnchorError')
          );

          throw new Error(errorLog || JSON.stringify(simulation.value.err));
        }

        console.log('[swap] Simulation succeeded, sending transaction...');
      } catch (simError: any) {
        console.error('[swap] Simulation error:', simError);
        throw simError;
      }

      // Send the transaction
      try {
        const signature = await this.wallet.sendTransaction(tx, this.connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        console.log('[swap] Transaction sent:', signature);

        await this.connection.confirmTransaction(signature, 'confirmed');
        console.log('[swap] Transaction confirmed');

        return { signature, success: true };
      } catch (sendError: any) {
        console.error('[swap] Send transaction error:', sendError);

        // Try to extract simulation logs from the error
        if (sendError.logs) {
          console.error('[swap] Transaction logs:', sendError.logs);
        }

        throw sendError;
      }
    } catch (error: any) {
      console.error('Failed to swap:', error);
      return { signature: '', success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Add liquidity to a market
   */
  async addLiquidity(params: AddLiquidityParams): Promise<TransactionResult> {
    try {
      const market = await this.getMarket(params.market);
      if (!market) throw new Error('Market not found');

      const config = await this.getConfig();
      if (!config) throw new Error('Config not found');
      const usdcMint = config.usdcMint;

      const [configPDA] = PDAHelper.getConfigPDA();
      const [globalVaultPDA] = PDAHelper.getGlobalVaultPDA();
      const [marketPDA] = PDAHelper.getMarketPDA(market.yesTokenMint, market.noTokenMint);
      const [marketUsdcVaultPDA] = PDAHelper.getMarketUsdcVaultPDA(params.market);
      const [lpPositionPDA] = PDAHelper.getLPPositionPDA(params.market, this.wallet.publicKey);

      const userUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        this.wallet.publicKey
      );

      // Global vault token accounts
      const globalYesAta = await getAssociatedTokenAddress(
        market.yesTokenMint,
        globalVaultPDA,
        true
      );
      const globalNoAta = await getAssociatedTokenAddress(
        market.noTokenMint,
        globalVaultPDA,
        true
      );

      // Market USDC vault ATA
      const marketUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        marketUsdcVaultPDA,
        true
      );

      // Check if market USDC ATA exists, create if not
      const marketUsdcAtaInfo = await this.connection.getAccountInfo(marketUsdcAta);

      if (!marketUsdcAtaInfo) {
        console.log('[addLiquidity] Market USDC ATA does not exist, creating it first...');

        // Create the ATA in a separate transaction first
        const { Transaction } = await import('@solana/web3.js');
        const createAtaTx = new Transaction();

        const createAtaIx = createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          marketUsdcAta,
          marketUsdcVaultPDA,
          usdcMint
        );
        createAtaTx.add(createAtaIx);

        try {
          const createAtaSig = await this.wallet.sendTransaction(createAtaTx, this.connection);
          console.log('[addLiquidity] Create ATA transaction sent:', createAtaSig);
          await this.connection.confirmTransaction(createAtaSig, 'confirmed');
          console.log('[addLiquidity] Market USDC ATA created successfully');
        } catch (ataError: any) {
          console.error('[addLiquidity] Failed to create market USDC ATA:', ataError);
          throw new Error(`Failed to create market USDC ATA: ${ataError.message}`);
        }
      } else {
        console.log('[addLiquidity] Market USDC ATA already exists');
      }

      // Now add liquidity using the program method
      console.log('[addLiquidity] Adding liquidity...');
      console.log('[addLiquidity] Amount (USDC):', params.usdcAmount);
      console.log('[addLiquidity] Amount (raw):', parseUSDC(params.usdcAmount).toString());

      const signature = await this.program.methods
        .addLiquidity(parseUSDC(params.usdcAmount))
        .accounts({
          globalConfig: configPDA,
          market: marketPDA,
          yesToken: market.yesTokenMint,
          noToken: market.noTokenMint,
          globalVault: globalVaultPDA,
          globalYesAta,
          globalNoAta,
          usdcMint: usdcMint,
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

      console.log('[addLiquidity] Transaction sent:', signature);
      await this.connection.confirmTransaction(signature, 'confirmed');
      console.log('[addLiquidity] Liquidity added successfully');

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to add liquidity:', error);

      // Provide user-friendly error messages
      let errorMessage = error.message;
      if (error.message?.includes('ValueTooSmall')) {
        errorMessage = 'The amount is too small. Minimum liquidity amount is 10 USDC. Please provide at least 10 USDC.';
      }

      return { signature: '', success: false, error: errorMessage };
    }
  }

  /**
   * Withdraw liquidity from a market
   */
  async withdrawLiquidity(params: WithdrawLiquidityParams): Promise<TransactionResult> {
    try {
      const market = await this.getMarket(params.market);

      const config = await this.getConfig();
      if (!config) throw new Error('Config not found');
      const usdcMint = config.usdcMint;
      if (!market) throw new Error('Market not found');

      const [configPDA] = PDAHelper.getConfigPDA();
      const [globalVaultPDA] = PDAHelper.getGlobalVaultPDA();
      const [marketPDA] = PDAHelper.getMarketPDA(market.yesTokenMint, market.noTokenMint);
      const [marketUsdcVaultPDA] = PDAHelper.getMarketUsdcVaultPDA(params.market);
      const [lpPositionPDA] = PDAHelper.getLPPositionPDA(params.market, this.wallet.publicKey);

      const userUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        this.wallet.publicKey
      );

      // Global vault token accounts
      const globalYesAta = await getAssociatedTokenAddress(
        market.yesTokenMint,
        globalVaultPDA,
        true
      );
      const globalNoAta = await getAssociatedTokenAddress(
        market.noTokenMint,
        globalVaultPDA,
        true
      );

      // Market USDC vault ATA
      const marketUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        marketUsdcVaultPDA,
        true
      );

      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

      const signature = await this.program.methods
        .withdrawLiquidity(new BN(params.lpSharesAmount), new BN(0))
        .accounts({
          globalConfig: configPDA,
          market: marketPDA,
          yesToken: market.yesTokenMint,
          noToken: market.noTokenMint,
          globalVault: globalVaultPDA,
          globalYesAta,
          globalNoAta,
          usdcMint: usdcMint,
          marketUsdcAta,
          marketUsdcVault: marketUsdcVaultPDA,
          userUsdcAta,
          lpPosition: lpPositionPDA,
          user: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      return { signature, success: true };
    } catch (error: any) {
      console.error('Failed to withdraw liquidity:', error);
      return { signature: '', success: false, error: error.message };
    }
  }

  /**
   * Mint complete set (get 1 YES + 1 NO for 1 USDC)
   */
  async mintCompleteSet(params: MintCompleteSetParams): Promise<TransactionResult> {
    try {
      const market = await this.getMarket(params.market);

      const config = await this.getConfig();
      if (!config) throw new Error('Config not found');
      const usdcMint = config.usdcMint;
      if (!market) throw new Error('Market not found');

      const [configPDA] = PDAHelper.getConfigPDA();
      const [globalVaultPDA] = PDAHelper.getGlobalVaultPDA();
      const [marketPDA] = PDAHelper.getMarketPDA(market.yesTokenMint, market.noTokenMint);
      const [marketUsdcVaultPDA] = PDAHelper.getMarketUsdcVaultPDA(params.market);
      const [userInfoPDA] = PDAHelper.getUserInfoPDA(this.wallet.publicKey, params.market);

      const userUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        this.wallet.publicKey
      );
      const userYesAta = await getAssociatedTokenAddress(
        market.yesTokenMint,
        this.wallet.publicKey
      );
      const userNoAta = await getAssociatedTokenAddress(
        market.noTokenMint,
        this.wallet.publicKey
      );

      // Market USDC vault ATA
      const marketUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        marketUsdcVaultPDA,
        true
      );

      // Check if market USDC ATA exists, create if not
      const { Transaction } = await import('@solana/web3.js');
      const tx = new Transaction();

      const marketUsdcAtaInfo = await this.connection.getAccountInfo(marketUsdcAta);
      if (!marketUsdcAtaInfo) {
        console.log('[mintCompleteSet] Creating market USDC ATA...');
        const createAtaIx = createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          marketUsdcAta,
          marketUsdcVaultPDA,
          usdcMint
        );
        tx.add(createAtaIx);
      }

      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

      // Build mint complete set instruction
      const mintIx = await this.program.methods
        .mintCompleteSet(parseUSDC(params.usdcAmount))
        .accounts({
          globalConfig: configPDA,
          market: marketPDA,
          globalVault: globalVaultPDA,
          yesToken: market.yesTokenMint,
          noToken: market.noTokenMint,
          userYesAta,
          userNoAta,
          usdcMint: usdcMint,
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
      return { signature: '', success: false, error: error.message };
    }
  }

  /**
   * Redeem complete set (burn 1 YES + 1 NO to get 1 USDC back)
   */
  async redeemCompleteSet(params: RedeemCompleteSetParams): Promise<TransactionResult> {
    try {
      const market = await this.getMarket(params.market);

      const config = await this.getConfig();
      if (!config) throw new Error('Config not found');
      const usdcMint = config.usdcMint;
      if (!market) throw new Error('Market not found');

      const [configPDA] = PDAHelper.getConfigPDA();
      const [globalVaultPDA] = PDAHelper.getGlobalVaultPDA();
      const [marketPDA] = PDAHelper.getMarketPDA(market.yesTokenMint, market.noTokenMint);
      const [marketUsdcVaultPDA] = PDAHelper.getMarketUsdcVaultPDA(params.market);
      const [userInfoPDA] = PDAHelper.getUserInfoPDA(this.wallet.publicKey, params.market);

      const userUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        this.wallet.publicKey
      );
      const userYesAta = await getAssociatedTokenAddress(
        market.yesTokenMint,
        this.wallet.publicKey
      );
      const userNoAta = await getAssociatedTokenAddress(
        market.noTokenMint,
        this.wallet.publicKey
      );

      // Market USDC vault ATA
      const marketUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        marketUsdcVaultPDA,
        true
      );

      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

      const signature = await this.program.methods
        .redeemCompleteSet(new BN(params.amount))
        .accounts({
          globalConfig: configPDA,
          market: marketPDA,
          globalVault: globalVaultPDA,
          marketUsdcVault: marketUsdcVaultPDA,
          usdcMint: usdcMint,
          marketUsdcAta,
          yesToken: market.yesTokenMint,
          noToken: market.noTokenMint,
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
      return { signature: '', success: false, error: error.message };
    }
  }

  /**
   * Calculate current price for a token type
   */
  calculatePrice(market: Market, tokenType: TokenType): number {
    // Handle undefined reserves (new markets)
    if (!market.poolYesReserve || !market.poolNoReserve) {
      return 0.5; // Default 50/50 for new markets
    }

    const yesReserve = market.poolYesReserve.toNumber();
    const noReserve = market.poolNoReserve.toNumber();
    const total = yesReserve + noReserve;

    if (total === 0) return 0.5;

    if (tokenType === 0) {
      // YES token
      return noReserve / total;
    } else {
      // NO token
      return yesReserve / total;
    }
  }
}
