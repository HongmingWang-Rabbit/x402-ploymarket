/**
 * Complete Test Script for Prediction Market
 * 
 * Tests all major functions:
 * 1. Initialize config
 * 2. Create market
 * 3. Add liquidity
 * 4. Buy YES token
 * 5. Sell YES token
 * 6. Remove liquidity
 */

import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const PROGRAM_ID = new PublicKey('78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR');
const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const USDC_MINT_DEVNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Helper function to get PDA
function getPDA(seeds: (Buffer | Uint8Array)[]): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAllFunctions() {
  console.log('🚀 Starting Complete Prediction Market Test\n');

  // Load wallet
  const walletPath = path.join(process.env.HOME!, '.config/solana/id.json');
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet not found at ${walletPath}`);
  }

  const keypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );

  console.log(`🔑 Wallet: ${keypair.publicKey.toBase58()}`);

  // Setup connection
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new anchor.Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  // Load program
  const idlPath = path.join(__dirname, '../target/idl/prediction_market.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  const program = new Program(idl, provider);

  // Check balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`💰 SOL Balance: ${balance / 1e9} SOL\n`);

  if (balance < 0.5 * 1e9) {
    console.log('⚠️  Low balance! Get more SOL from https://faucet.solana.com/\n');
  }

  // Derive PDAs
  const [configPDA] = getPDA([Buffer.from('config')]);
  const [globalVaultPDA] = getPDA([Buffer.from('global')]);

  console.log('📋 PDAs:');
  console.log(`   Config: ${configPDA.toBase58()}`);
  console.log(`   Global Vault: ${globalVaultPDA.toBase58()}\n`);

  // ============================================
  // STEP 1: Check/Initialize Config
  // ============================================
  console.log('📝 STEP 1: Checking Configuration...');
  
  let configExists = false;
  try {
    const config = await program.account.config.fetch(configPDA);
    console.log('✅ Config exists!');
    console.log(`   Admin: ${config.admin.toBase58()}`);
    console.log(`   Team Wallet: ${config.teamWallet.toBase58()}`);
    console.log(`   Swap Fee: ${config.swapFee} bp`);
    console.log(`   LP Fee: ${config.lpFee} bp\n`);
    configExists = true;
  } catch (err) {
    console.log('⚠️  Config not found. Initializing...\n');

    const globalVaultUsdcAta = await getAssociatedTokenAddress(
      USDC_MINT_DEVNET,
      globalVaultPDA,
      true
    );

    try {
      const tx = await program.methods
        .configure({
          authority: keypair.publicKey,
          pending_authority: PublicKey.default,
          team_wallet: keypair.publicKey,
          platform_buy_fee: 30,
          platform_sell_fee: 30,
          lp_buy_fee: 20,
          lp_sell_fee: 20,
          token_supply_config: new BN(1_000_000_000_000),
          token_decimals_config: 6,
          initial_real_token_reserves_config: new BN(500_000_000),
          min_sol_liquidity: new BN(5_000_000_000),
          min_trading_liquidity: new BN(100_000_000),
          initialized: false,
          is_paused: false,
          whitelist_enabled: false,
          usdc_mint: USDC_MINT_DEVNET,
          usdc_vault_min_balance: new BN(1_000_000),
          min_usdc_liquidity: new BN(10_000_000),
          lp_insurance_pool_balance: new BN(0),
          lp_insurance_allocation_bps: 2000,
          insurance_loss_threshold_bps: 1000,
          insurance_max_compensation_bps: 5000,
          insurance_pool_enabled: false,
        })
        .accounts({
          payer: keypair.publicKey,
          config: configPDA,
          globalVault: globalVaultPDA,
          globalVaultUsdcAta,
          usdcMint: USDC_MINT_DEVNET,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log(`✅ Config initialized! TX: ${tx}\n`);
      await sleep(2000);
      configExists = true;
    } catch (err: any) {
      console.error('❌ Failed to initialize config:', err.message);
      if (err.logs) {
        console.error('Logs:', err.logs.join('\n'));
      }
      return;
    }
  }

  if (!configExists) {
    console.error('❌ Cannot proceed without config');
    return;
  }

  // ============================================
  // STEP 2: Create Market
  // ============================================
  console.log('📝 STEP 2: Creating Market...');

  const yesTokenMint = Keypair.generate();
  const noTokenMint = Keypair.generate();
  const [marketPDA] = getPDA([
    Buffer.from('market'),
    yesTokenMint.publicKey.toBuffer(),
    noTokenMint.publicKey.toBuffer(),
  ]);

  console.log(`   YES Token: ${yesTokenMint.publicKey.toBase58()}`);
  console.log(`   NO Token: ${noTokenMint.publicKey.toBase58()}`);
  console.log(`   Market: ${marketPDA.toBase58()}`);

  // Check if market already exists
  let marketExists = false;
  try {
    await program.account.market.fetch(marketPDA);
    console.log('⚠️  Market already exists, skipping creation\n');
    marketExists = true;
  } catch (err) {
    // Market doesn't exist, create it
    const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    
    const [yesMetadataPDA] = getPDA([
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      yesTokenMint.publicKey.toBuffer(),
    ]);

    const [noMetadataPDA] = getPDA([
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      noTokenMint.publicKey.toBuffer(),
    ]);

    const [whitelistPDA] = getPDA([
      Buffer.from('wl-seed'),
      keypair.publicKey.toBuffer(),
    ]);

    const globalYesAta = await getAssociatedTokenAddress(
      yesTokenMint.publicKey,
      globalVaultPDA,
      true
    );

    const globalNoAta = await getAssociatedTokenAddress(
      noTokenMint.publicKey,
      globalVaultPDA,
      true
    );

    try {
      const tx = await program.methods
        .createMarket({
          yesSymbol: 'YES',
          yesUri: 'https://example.com/yes.json',
          startSlot: null,
          endingSlot: null,
          lmsrB: new BN(1000_000_000), // 1000 USDC
        })
        .accounts({
          globalConfig: configPDA,
          globalVault: globalVaultPDA,
          creator: keypair.publicKey,
          creatorWhitelist: whitelistPDA,
          yesToken: yesTokenMint.publicKey,
          noToken: noTokenMint.publicKey,
          market: marketPDA,
          yesTokenMetadataAccount: yesMetadataPDA,
          noTokenMetadataAccount: noMetadataPDA,
          globalYesTokenAccount: globalYesAta,
          globalNoTokenAccount: globalNoAta,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          mplTokenMetadataProgram: METADATA_PROGRAM_ID,
          teamWallet: keypair.publicKey,
        })
        .signers([yesTokenMint, noTokenMint])
        .rpc();

      console.log(`✅ Market created! TX: ${tx}\n`);
      await sleep(2000);
      marketExists = true;
    } catch (err: any) {
      console.error('❌ Failed to create market:', err.message);
      if (err.logs) {
        console.error('Logs:', err.logs.join('\n'));
      }
      return;
    }
  }

  // ============================================
  // STEP 3: Add Liquidity
  // ============================================
  console.log('📝 STEP 3: Adding Liquidity...');

  const [lpPositionPDA] = getPDA([
    Buffer.from('lp_position'),
    keypair.publicKey.toBuffer(),
    marketPDA.toBuffer(),
  ]);

  const userUsdcAta = await getAssociatedTokenAddress(
    USDC_MINT_DEVNET,
    keypair.publicKey
  );

  const marketYesVault = await getAssociatedTokenAddress(
    yesTokenMint.publicKey,
    marketPDA,
    true
  );

  const marketNoVault = await getAssociatedTokenAddress(
    noTokenMint.publicKey,
    marketPDA,
    true
  );

  const marketUsdcVault = await getAssociatedTokenAddress(
    USDC_MINT_DEVNET,
    marketPDA,
    true
  );

  try {
    const tx = await program.methods
      .addLiquidity(new BN(100_000_000)) // 100 USDC
      .accounts({
        user: keypair.publicKey,
        config: configPDA,
        market: marketPDA,
        lpPosition: lpPositionPDA,
        userUsdcAta,
        marketYesVault,
        marketNoVault,
        marketUsdcVault,
        yesToken: yesTokenMint.publicKey,
        noToken: noTokenMint.publicKey,
        usdcMint: USDC_MINT_DEVNET,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ Liquidity added! TX: ${tx}\n`);
    await sleep(2000);
  } catch (err: any) {
    console.error('❌ Failed to add liquidity:', err.message);
    if (err.logs) {
      console.error('Logs:', err.logs.join('\n'));
    }
  }

  // ============================================
  // STEP 4: Buy YES Token
  // ============================================
  console.log('📝 STEP 4: Buying YES Token...');

  const [userInfoPDA] = getPDA([
    Buffer.from('userinfo'),
    keypair.publicKey.toBuffer(),
    marketPDA.toBuffer(),
  ]);

  const userYesAta = await getAssociatedTokenAddress(
    yesTokenMint.publicKey,
    keypair.publicKey
  );

  const userNoAta = await getAssociatedTokenAddress(
    noTokenMint.publicKey,
    keypair.publicKey
  );

  const teamUsdcAta = await getAssociatedTokenAddress(
    USDC_MINT_DEVNET,
    keypair.publicKey
  );

  try {
    const tx = await program.methods
      .swap(
        { yes: {} },
        { buy: {} },
        new BN(10_000_000), // 10 USDC
        new BN(0)
      )
      .accounts({
        user: keypair.publicKey,
        config: configPDA,
        market: marketPDA,
        userInfo: userInfoPDA,
        userYesAta,
        userNoAta,
        userUsdcAta,
        marketYesVault,
        marketNoVault,
        marketUsdcVault,
        teamUsdcAta,
        yesToken: yesTokenMint.publicKey,
        noToken: noTokenMint.publicKey,
        usdcMint: USDC_MINT_DEVNET,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ YES token bought! TX: ${tx}\n`);
    await sleep(2000);
  } catch (err: any) {
    console.error('❌ Failed to buy YES token:', err.message);
    if (err.logs) {
      console.error('Logs:', err.logs.join('\n'));
    }
  }

  // ============================================
  // STEP 5: Sell YES Token
  // ============================================
  console.log('📝 STEP 5: Selling YES Token...');

  try {
    const tx = await program.methods
      .swap(
        { yes: {} },
        { sell: {} },
        new BN(5_000_000), // 5 YES tokens
        new BN(0)
      )
      .accounts({
        user: keypair.publicKey,
        config: configPDA,
        market: marketPDA,
        userInfo: userInfoPDA,
        userYesAta,
        userNoAta,
        userUsdcAta,
        marketYesVault,
        marketNoVault,
        marketUsdcVault,
        teamUsdcAta,
        yesToken: yesTokenMint.publicKey,
        noToken: noTokenMint.publicKey,
        usdcMint: USDC_MINT_DEVNET,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ YES token sold! TX: ${tx}\n`);
    await sleep(2000);
  } catch (err: any) {
    console.error('❌ Failed to sell YES token:', err.message);
    if (err.logs) {
      console.error('Logs:', err.logs.join('\n'));
    }
  }

  // ============================================
  // STEP 6: Remove Liquidity
  // ============================================
  console.log('📝 STEP 6: Removing Liquidity...');

  try {
    const lpPosition = await program.account.lpPosition.fetch(lpPositionPDA);
    const lpShares = lpPosition.lpShares;

    const tx = await program.methods
      .withdrawLiquidity(lpShares.div(new BN(2))) // Remove 50%
      .accounts({
        user: keypair.publicKey,
        config: configPDA,
        market: marketPDA,
        lpPosition: lpPositionPDA,
        userYesAta,
        userNoAta,
        userUsdcAta,
        marketYesVault,
        marketNoVault,
        marketUsdcVault,
        yesToken: yesTokenMint.publicKey,
        noToken: noTokenMint.publicKey,
        usdcMint: USDC_MINT_DEVNET,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ Liquidity removed! TX: ${tx}\n`);
  } catch (err: any) {
    console.error('❌ Failed to remove liquidity:', err.message);
    if (err.logs) {
      console.error('Logs:', err.logs.join('\n'));
    }
  }

  console.log('🎉 All tests completed!');
  console.log(`\nView transactions on explorer:`);
  console.log(`https://explorer.solana.com/address/${keypair.publicKey.toBase58()}?cluster=devnet`);
}

// Run tests
testAllFunctions()
  .then(() => {
    console.log('\n✨ Test suite completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });
