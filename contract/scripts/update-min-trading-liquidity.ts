/**
 * Update min_trading_liquidity to 1 USDC on Devnet
 */

import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Devnet 配置
const PROGRAM_ID = new PublicKey('CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🔄 更新 min_trading_liquidity 为 1 USDC...\n');

  // 加载钱包
  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const keypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')))
  );

  console.log('📍 使用钱包:', keypair.publicKey.toString());

  // 设置连接
  const connection = new Connection(RPC_URL, 'confirmed');
  const balance = await connection.getBalance(keypair.publicKey);
  console.log('💰 余额:', balance / 1e9, 'SOL\n');

  // 设置 Provider
  const wallet = new anchor.Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  // 加载 IDL
  const idlPath = path.join(__dirname, '../target/idl/prediction_market.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  const program = new Program(idl, provider);

  // 查找 PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID
  );

  const [globalVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    PROGRAM_ID
  );

  console.log('📋 程序 ID:', PROGRAM_ID.toString());
  console.log('🔑 配置 PDA:', configPda.toString());

  // 获取当前配置
  let currentConfig;
  try {
    currentConfig = await (program.account as any).config.fetch(configPda);
    console.log('\n📖 当前配置:');
    console.log('Authority:', currentConfig.authority.toString());
    console.log('Min Trading Liquidity:', currentConfig.minTradingLiquidity.toString(), '(当前)');
    console.log('Min USDC Liquidity:', currentConfig.minUsdcLiquidity.toString());
  } catch (err) {
    console.error('\n❌ 无法获取配置，请先初始化');
    throw err;
  }

  // 创建新配置对象 - 保持其他字段不变，只修改 minTradingLiquidity
  const newConfig = {
    authority: currentConfig.authority,
    pendingAuthority: currentConfig.pendingAuthority,
    teamWallet: currentConfig.teamWallet,
    platformBuyFee: currentConfig.platformBuyFee,
    platformSellFee: currentConfig.platformSellFee,
    lpBuyFee: currentConfig.lpBuyFee,
    lpSellFee: currentConfig.lpSellFee,
    tokenSupplyConfig: currentConfig.tokenSupplyConfig,
    tokenDecimalsConfig: currentConfig.tokenDecimalsConfig,
    initialRealTokenReservesConfig: currentConfig.initialRealTokenReservesConfig,
    minSolLiquidity: currentConfig.minSolLiquidity,
    minTradingLiquidity: new BN(1_000_000),  // ✅ 更新为 1 USDC
    initialized: currentConfig.initialized,
    isPaused: currentConfig.isPaused,
    whitelistEnabled: currentConfig.whitelistEnabled,
    usdcMint: currentConfig.usdcMint,
    usdcVaultMinBalance: currentConfig.usdcVaultMinBalance,
    minUsdcLiquidity: currentConfig.minUsdcLiquidity,
    lpInsurancePoolBalance: currentConfig.lpInsurancePoolBalance,
    lpInsuranceAllocationBps: currentConfig.lpInsuranceAllocationBps,
    insuranceLossThresholdBps: currentConfig.insuranceLossThresholdBps,
    insuranceMaxCompensationBps: currentConfig.insuranceMaxCompensationBps,
    insurancePoolEnabled: currentConfig.insurancePoolEnabled,
  };

  console.log('\n📝 新配置:');
  console.log('Min Trading Liquidity:', newConfig.minTradingLiquidity.toString(), '(1 USDC) ✅');
  console.log('\n开始交易...\n');

  try {
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

    console.log('✅ 更新成功！');
    console.log('📝 交易签名:', tx);
    console.log('🔗 查看交易: https://explorer.solana.com/tx/' + tx + '?cluster=devnet');
    console.log('\n等待确认...');

    await connection.confirmTransaction(tx, 'confirmed');

    // 验证配置
    const updatedConfig = await (program.account as any).config.fetch(configPda);
    console.log('\n✅ 配置验证成功！');
    console.log('Authority:', updatedConfig.authority.toString());
    console.log('Min Trading Liquidity:', updatedConfig.minTradingLiquidity.toString(), '(1 USDC) ✅');
    console.log('Min USDC Liquidity:', updatedConfig.minUsdcLiquidity.toString(), '(10 USDC)');
    console.log('Paused:', updatedConfig.isPaused);

  } catch (err: any) {
    console.error('\n❌ 更新失败:', err);
    if (err.logs) {
      console.error('\n程序日志:');
      err.logs.forEach((log: string) => console.error(log));
    }
    throw err;
  }
}

main()
  .then(() => {
    console.log('\n🎉 完成！');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
