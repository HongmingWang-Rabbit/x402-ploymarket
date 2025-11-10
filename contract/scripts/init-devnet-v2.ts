/**
 * Initialize Prediction Market on Devnet
 * 使用正确的 Config 结构体参数
 */

import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Devnet 配置
const PROGRAM_ID = new PublicKey('CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM');
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🚀 初始化 Devnet 配置...\n');

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
  console.log('🔑 全局金库 PDA:', globalVaultPda.toString());

  // 检查配置是否已存在
  try {
    const config = await (program.account as any).config.fetch(configPda);
    console.log('\n✅ 配置已存在！');
    console.log('Authority:', config.authority.toString());
    console.log('Team Wallet:', config.teamWallet.toString());
    console.log('Min USDC Liquidity:', config.minUsdcLiquidity.toString());
    return;
  } catch (err) {
    console.log('\n⚠️  配置不存在，开始初始化...\n');
  }

  // 创建配置对象 - 必须完全匹配 Config 结构体
  const newConfig = {
    authority: keypair.publicKey,
    pendingAuthority: PublicKey.default,
    teamWallet: keypair.publicKey,
    platformBuyFee: new BN(30),  // 0.3%
    platformSellFee: new BN(30),  // 0.3%
    lpBuyFee: new BN(20),  // 0.2%
    lpSellFee: new BN(20),  // 0.2%
    tokenSupplyConfig: new BN(1_000_000_000_000),  // 1M USDC (废弃字段)
    tokenDecimalsConfig: 6,  // 必须是 6
    initialRealTokenReservesConfig: new BN(500_000_000),  // 500 USDC
    minSolLiquidity: new BN(5_000_000_000),  // 5 SOL (废弃)
    minTradingLiquidity: new BN(100_000_000),  // 100 USDC
    initialized: false,
    isPaused: false,
    whitelistEnabled: false,
    usdcMint: USDC_MINT,
    usdcVaultMinBalance: new BN(1_000_000),  // 1 USDC
    minUsdcLiquidity: new BN(10_000_000),  // ✅ 10 USDC
    lpInsurancePoolBalance: new BN(0),
    lpInsuranceAllocationBps: 2000,  // 20%
    insuranceLossThresholdBps: 1000,  // 10%
    insuranceMaxCompensationBps: 5000,  // 50%
    insurancePoolEnabled: false,
  };

  console.log('📝 配置参数:');
  console.log('  - Authority:', newConfig.authority.toString());
  console.log('  - Team Wallet:', newConfig.teamWallet.toString());
  console.log('  - Platform Buy Fee:', newConfig.platformBuyFee.toString(), 'bps');
  console.log('  - Min USDC Liquidity:', newConfig.minUsdcLiquidity.toString(), '(10 USDC)');
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

    console.log('✅ 初始化成功！');
    console.log('📝 交易签名:', tx);
    console.log('🔗 查看交易: https://explorer.solana.com/tx/' + tx + '?cluster=devnet');
    console.log('\n等待确认...');

    await connection.confirmTransaction(tx, 'confirmed');

    // 验证配置
    const config = await (program.account as any).config.fetch(configPda);
    console.log('\n✅ 配置验证成功！');
    console.log('Authority:', config.authority.toString());
    console.log('Team Wallet:', config.teamWallet.toString());
    console.log('Min USDC Liquidity:', config.minUsdcLiquidity.toString());
    console.log('Paused:', config.isPaused);

  } catch (err: any) {
    console.error('\n❌ 初始化失败:', err);
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
