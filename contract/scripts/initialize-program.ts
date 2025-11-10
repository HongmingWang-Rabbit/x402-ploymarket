/**
 * Initialize the Prediction Market Program
 *
 * This script initializes the global configuration for the deployed program.
 * Must be run by the program authority.
 *
 * Usage:
 *   ts-node scripts/initialize-program.ts
 */

import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const PROGRAM_ID = new PublicKey('CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM');
const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';

// USDC Mint on Devnet
const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// Configuration Parameters
const CONFIG_PARAMS = {
  // Authority address (must match deployed program authority)
  authority: new PublicKey('2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr'),

  // Team wallet (receives fees)
  teamWallet: new PublicKey('2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr'), // Change this to your team wallet

  // USDC mint
  usdcMint: USDC_MINT_DEVNET,

  // Fee configuration (in basis points: 30 = 0.3%)
  swapFee: 30,  // 0.3%
  lpFee: 20,    // 0.2%

  // Token configuration
  tokenDecimalsConfig: 6, // USDC has 6 decimals
  tokenSupplyConfig: new BN(1_000_000_000_000), // 1M USDC (6 decimals)
  initialRealTokenReservesConfig: new BN(500_000_000), // 500 USDC initial reserves

  // Feature flags
  whitelistEnabled: false, // Set to true to require creator whitelist
  emergencyStop: false,     // Set to true to pause all operations
};

async function initialize() {
  console.log('🚀 Initializing Prediction Market Program...\n');

  // Load authority keypair
  const authorityKeypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  console.log(`📂 Loading authority keypair from: ${authorityKeypairPath}`);

  if (!fs.existsSync(authorityKeypairPath)) {
    throw new Error(`Keypair not found at ${authorityKeypairPath}. Please ensure you're using the program authority wallet.`);
  }

  const authorityKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(authorityKeypairPath, 'utf-8')))
  );

  console.log(`🔑 Authority: ${authorityKeypair.publicKey.toBase58()}`);

  if (!authorityKeypair.publicKey.equals(CONFIG_PARAMS.authority)) {
    throw new Error(`Wallet mismatch! Expected ${CONFIG_PARAMS.authority.toBase58()} but got ${authorityKeypair.publicKey.toBase58()}`);
  }

  // Setup connection and provider
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new anchor.Wallet(authorityKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  // Load IDL
  const idlPath = path.join(__dirname, '../target/idl/prediction_market.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

  const program = new Program(idl, provider);

  // Derive PDAs
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID
  );

  const [globalVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    PROGRAM_ID
  );

  console.log(`\n📋 Configuration:`);
  console.log(`   Config PDA: ${configPDA.toBase58()}`);
  console.log(`   Global Vault: ${globalVaultPDA.toBase58()}`);
  console.log(`   Team Wallet: ${CONFIG_PARAMS.teamWallet.toBase58()}`);
  console.log(`   USDC Mint: ${CONFIG_PARAMS.usdcMint.toBase58()}`);
  console.log(`   Swap Fee: ${CONFIG_PARAMS.swapFee} bp (${CONFIG_PARAMS.swapFee / 100}%)`);
  console.log(`   LP Fee: ${CONFIG_PARAMS.lpFee} bp (${CONFIG_PARAMS.lpFee / 100}%)`);
  console.log(`   Whitelist Enabled: ${CONFIG_PARAMS.whitelistEnabled}`);

  // Check if config already exists
  try {
    const existingConfig = await program.account.config.fetch(configPDA);
    console.log('\n⚠️  Config already exists!');
    console.log('   Current admin:', existingConfig.admin.toBase58());
    console.log('   Current team wallet:', existingConfig.teamWallet.toBase58());
    console.log('\nℹ️  If you want to update the config, use the update-config script instead.');
    return;
  } catch (err) {
    // Config doesn't exist - proceed with initialization
    console.log('\n✅ Config does not exist yet - proceeding with initialization...');
  }

  // Get global vault USDC ATA
  const globalVaultUsdcAta = await anchor.utils.token.associatedAddress({
    mint: CONFIG_PARAMS.usdcMint,
    owner: globalVaultPDA,
  });

  console.log(`\n💰 Global Vault USDC ATA: ${globalVaultUsdcAta.toBase58()}`);

  // Check balance
  const balance = await connection.getBalance(authorityKeypair.publicKey);
  console.log(`\n💵 Authority SOL Balance: ${balance / 1e9} SOL`);

  if (balance < 0.1 * 1e9) {
    console.log('\n⚠️  Warning: Low SOL balance. You may need more SOL for this transaction.');
    console.log('   Get devnet SOL from: https://faucet.solana.com');
  }

  // Prepare configuration parameters
  const configParams = {
    newConfig: {
      admin: CONFIG_PARAMS.authority,
      teamWallet: CONFIG_PARAMS.teamWallet,
      usdcMint: CONFIG_PARAMS.usdcMint,
      swapFee: CONFIG_PARAMS.swapFee,
      lpFee: CONFIG_PARAMS.lpFee,
      tokenDecimalsConfig: CONFIG_PARAMS.tokenDecimalsConfig,
      tokenSupplyConfig: CONFIG_PARAMS.tokenSupplyConfig,
      initialRealTokenReservesConfig: CONFIG_PARAMS.initialRealTokenReservesConfig,
      whitelistEnabled: CONFIG_PARAMS.whitelistEnabled,
      emergencyStop: CONFIG_PARAMS.emergencyStop,
    }
  };

  console.log('\n📤 Sending configure transaction...');

  try {
    const tx = await program.methods
      .configure(configParams.newConfig)
      .accounts({
        payer: authorityKeypair.publicKey,
        config: configPDA,
        globalVault: globalVaultPDA,
        globalVaultUsdcAta: globalVaultUsdcAta,
        usdcMint: CONFIG_PARAMS.usdcMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log('\n✅ Configuration successful!');
    console.log(`   Transaction signature: ${tx}`);
    console.log(`   View on explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`);

    // Fetch and display the config
    console.log('\n📖 Fetching initialized config...');
    const config = await program.account.config.fetch(configPDA);

    console.log('\n🎉 Program initialized successfully!');
    console.log('\nFinal Configuration:');
    console.log(`   Admin: ${config.admin.toBase58()}`);
    console.log(`   Team Wallet: ${config.teamWallet.toBase58()}`);
    console.log(`   USDC Mint: ${config.usdcMint.toBase58()}`);
    console.log(`   Swap Fee: ${config.swapFee} bp`);
    console.log(`   LP Fee: ${config.lpFee} bp`);
    console.log(`   Token Decimals: ${config.tokenDecimalsConfig}`);
    console.log(`   Whitelist Enabled: ${config.whitelistEnabled}`);
    console.log(`   Emergency Stop: ${config.emergencyStop}`);

  } catch (error: any) {
    console.error('\n❌ Initialization failed!');
    console.error('Error:', error.message);
    if (error.logs) {
      console.error('\nProgram logs:');
      error.logs.forEach((log: string) => console.error('  ', log));
    }
    throw error;
  }
}

// Run initialization
initialize()
  .then(() => {
    console.log('\n✨ Initialization complete!');
    console.log('You can now use the prediction market program.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Initialization error:', error);
    process.exit(1);
  });
