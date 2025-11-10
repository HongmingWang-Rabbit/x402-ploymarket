/**
 * 更新 min_usdc_liquidity 为 0.01 USDC
 */

import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_ID = new PublicKey('CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🔄 更新 min_usdc_liquidity 为 0.01 USDC...\n');

  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const keypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')))
  );

  console.log('📍 钱包:', keypair.publicKey.toString());

  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { 
    commitment: 'confirmed',
  });

  const idlPath = path.join(__dirname, '../target/idl/prediction_market.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  const program = new anchor.Program(idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID
  );

  const [globalVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    PROGRAM_ID
  );

  console.log('📋 获取当前配置...');
  const currentConfig = await (program.account as any).config.fetch(configPda);
  
  console.log('当前 min_usdc_liquidity:', currentConfig.minUsdcLiquidity.toString());
  console.log('当前 min_trading_liquidity:', currentConfig.minTradingLiquidity.toString());

  const newConfig = {
    ...currentConfig,
    minUsdcLiquidity: new BN(10_000),  // 0.01 USDC
    minTradingLiquidity: new BN(10_000),  // 0.01 USDC
  };

  console.log('\n新值:');
  console.log('  min_usdc_liquidity:', newConfig.minUsdcLiquidity.toString(), '(0.01 USDC)');
  console.log('  min_trading_liquidity:', newConfig.minTradingLiquidity.toString(), '(0.01 USDC)');
  console.log('\n📤 发送交易...');

  const tx = await program.methods
    .configure(newConfig)
    .accounts({
      payer: keypair.publicKey,
      config: configPda,
      globalVault: globalVaultPda,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log('✅ 交易成功:', tx);
  console.log('🔗 https://explorer.solana.com/tx/' + tx + '?cluster=devnet');

  await connection.confirmTransaction(tx, 'confirmed');

  const updated = await (program.account as any).config.fetch(configPda);
  console.log('\n✅ 验证:');
  console.log('  min_usdc_liquidity =', updated.minUsdcLiquidity.toString(), '(0.01 USDC)');
  console.log('  min_trading_liquidity =', updated.minTradingLiquidity.toString(), '(0.01 USDC)');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
