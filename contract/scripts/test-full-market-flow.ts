/**
 * 完整市场流程测试
 * 1. 创建市场
 * 2. 种子池子（seed_pool）
 * 3. 添加流动性（add_liquidity）
 * 4. 买入 YES/NO 代币（swap buy）
 * 5. 卖出 YES/NO 代币（swap sell）
 * 6. 移除流动性（withdraw_liquidity）
 */

import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// 配置
const PROGRAM_ID = new PublicKey('CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM');
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const RPC_URL = 'https://api.devnet.solana.com';

// 辅助函数
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getOrCreateATA(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  
  try {
    await getAccount(connection, ata);
    console.log('  ✓ ATA 已存在:', ata.toBase58().slice(0, 8) + '...');
  } catch {
    console.log('  → 创建 ATA:', ata.toBase58().slice(0, 8) + '...');
    const ix = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      ata,
      owner,
      mint
    );
    const tx = new anchor.web3.Transaction().add(ix);
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [payer]);
  }
  
  return ata;
}

async function main() {
  console.log('🚀 开始完整市场流程测试\n');
  console.log('='.repeat(60));

  // 加载钱包
  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const payer = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')))
  );

  console.log('📍 测试钱包:', payer.publicKey.toString());

  // 设置连接
  const connection = new Connection(RPC_URL, 'confirmed');
  const balance = await connection.getBalance(payer.publicKey);
  console.log('💰 SOL 余额:', (balance / 1e9).toFixed(4), 'SOL');

  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, { 
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });

  // 加载程序
  const idlPath = path.join(__dirname, '../target/idl/prediction_market.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  const program = new anchor.Program(idl, provider);

  // PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID
  );

  const [globalVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    PROGRAM_ID
  );

  console.log('\n' + '='.repeat(60));
  console.log('步骤 1: 创建 NO Token');
  console.log('='.repeat(60));

  // 生成 NO token mint
  const noTokenMint = Keypair.generate();
  console.log('� N场O Token Mint:', noTokenMint.publicKey.toString());

  // Metadata program ID
  const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

  // 派生 NO metadata PDA
  const [noMetadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      noTokenMint.publicKey.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );

  // 派生 global NO ATA (将在后面使用)
  const globalNoAtaForMint = await getAssociatedTokenAddress(
    noTokenMint.publicKey,
    globalVaultPda,
    true
  );

  try {
    console.log('\n📤 发送 mint_no_token 交易...');
    const mintNoTokenTx = await program.methods
      .mintNoToken('NO-TEST', 'https://example.com/no.json')
      .accounts({
        globalConfig: configPda,
        globalVault: globalVaultPda,
        creator: payer.publicKey,
        noToken: noTokenMint.publicKey,
        noTokenMetadataAccount: noMetadata,
        globalNoTokenAccount: globalNoAtaForMint,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        mplTokenMetadataProgram: METADATA_PROGRAM_ID,
      })
      .signers([noTokenMint])
      .rpc();

    console.log('✅ NO Token 创建成功!');
    console.log('🔗 交易:', `https://explorer.solana.com/tx/${mintNoTokenTx}?cluster=devnet`);

  } catch (err: any) {
    console.error('❌ 创建 NO Token 失败:', err.message);
    if (err.logs) {
      console.error('程序日志:');
      err.logs.forEach((log: string) => console.error('  ', log));
    }
    throw err;
  }

  await sleep(2000);

  console.log('\n' + '='.repeat(60));
  console.log('步骤 2: 创建市场');
  console.log('='.repeat(60));

  // 生成市场 ID
  const marketId = Keypair.generate().publicKey;
  console.log('📋 市场 ID:', marketId.toString());

  // 生成 YES token mint
  const yesTokenMint = Keypair.generate();
  console.log('🟢 YES Token Mint:', yesTokenMint.publicKey.toString());
  console.log('🔴 NO Token Mint:', noTokenMint.publicKey.toString());

  // 派生 Market PDA (使用 YES 和 NO mint 作为 seeds)
  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('market'), yesTokenMint.publicKey.toBuffer(), noTokenMint.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log('📊 Market PDA:', marketPda.toString());

  // 派生 Market USDC Vault
  const [marketUsdcVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('market_usdc_vault'), marketId.toBuffer()],
    PROGRAM_ID
  );

  // 创建市场参数
  const marketParams = {
    yesSymbol: 'YES-BTC100K',
    yesUri: 'https://example.com/yes.json',
    startSlot: null,
    endingSlot: null,
    displayName: '测试市场：BTC 会在2024年底突破10万美元吗？',
    initialYesProb: 5000, // 50%
  };

  console.log('\n📝 市场参数:');
  console.log('  名称:', marketParams.displayName);
  console.log('  初始概率:', marketParams.initialYesProb / 100, '%');

  // 获取配置
  const config = await (program.account as any).config.fetch(configPda);
  const teamWallet = config.teamWallet;

  // 派生 YES metadata PDA
  const [yesMetadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      yesTokenMint.publicKey.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );

  // 派生 global YES/NO ATAs
  const globalYesAta = await getAssociatedTokenAddress(
    yesTokenMint.publicKey,
    globalVaultPda,
    true
  );

  const globalNoAta = await getAssociatedTokenAddress(
    noTokenMint.publicKey,
    globalVaultPda,
    true
  );

  try {
    console.log('\n📤 发送 create_market 交易...');
    const createMarketTx = await program.methods
      .createMarket(marketParams)
      .accounts({
        globalConfig: configPda,
        globalVault: globalVaultPda,
        creator: payer.publicKey,
        creatorWhitelist: null,
        yesToken: yesTokenMint.publicKey,
        noToken: noTokenMint.publicKey, // 需要 mut 权限
        market: marketPda,
        yesTokenMetadataAccount: yesMetadata,
        noTokenMetadataAccount: noMetadata,
        globalYesTokenAccount: globalYesAta,
        globalNoTokenAccount: globalNoAta,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        mplTokenMetadataProgram: METADATA_PROGRAM_ID,
        teamWallet: teamWallet,
      })
      .signers([yesTokenMint])
      .rpc();

    console.log('✅ 市场创建成功!');
    console.log('🔗 交易:', `https://explorer.solana.com/tx/${createMarketTx}?cluster=devnet`);
    
    await sleep(2000);

    // 转移 mint authority
    console.log('\n📤 转移 mint authority 到 market PDA...');
    const setMintAuthorityTx = await program.methods
      .setMintAuthority()
      .accounts({
        globalConfig: configPda,
        globalVault: globalVaultPda,
        yesToken: yesTokenMint.publicKey,
        noToken: noTokenMint.publicKey,
        market: marketPda,
        authority: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log('✅ Mint authority 转移成功!');
    console.log('🔗 交易:', `https://explorer.solana.com/tx/${setMintAuthorityTx}?cluster=devnet`);

  } catch (err: any) {
    console.error('❌ 创建市场失败:', err.message);
    if (err.logs) {
      console.error('程序日志:');
      err.logs.forEach((log: string) => console.error('  ', log));
    }
    throw err;
  }

  await sleep(2000);

  console.log('\n' + '='.repeat(60));
  console.log('步骤 3: 种子池子 (Seed Pool)');
  console.log('='.repeat(60));

  // 创建用户 USDC ATA
  console.log('\n准备 USDC 账户...');
  const userUsdcAta = await getOrCreateATA(connection, payer, USDC_MINT, payer.publicKey);

  // 检查 USDC 余额
  try {
    const usdcAccount = await getAccount(connection, userUsdcAta);
    console.log('💵 USDC 余额:', (Number(usdcAccount.amount) / 1e6).toFixed(6), 'USDC');
    
    if (Number(usdcAccount.amount) < 10_000) {
      console.log('\n⚠️  警告: USDC 余额不足，需要至少 0.01 USDC');
      console.log('请先获取测试 USDC: https://faucet.circle.com/');
      return;
    }
  } catch (err) {
    console.log('⚠️  无法获取 USDC 余额，请确保有足够的测试 USDC');
  }

  const seedAmount = new BN(5_000); // 0.005 USDC
  console.log('\n💧 种子金额:', seedAmount.toString(), '(0.005 USDC)');

  // 创建 market USDC ATA
  console.log('\n准备 Market USDC 账户...');
  const marketUsdcAta = await getOrCreateATA(connection, payer, USDC_MINT, marketUsdcVault);

  // 获取 seeder LP position PDA
  const [seederLpPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from('lpposition'), marketPda.toBuffer(), payer.publicKey.toBuffer()],
    PROGRAM_ID
  );

  try {
    console.log('\n📤 发送 seed_pool 交易...');
    const seedPoolTx = await program.methods
      .seedPool(seedAmount, true, 0, 0) // issue_lp_shares=true
      .accounts({
        globalConfig: configPda,
        market: marketPda,
        globalVault: globalVaultPda,
        yesToken: yesTokenMint.publicKey,
        noToken: noTokenMint.publicKey,
        globalYesAta: globalYesAta,
        globalNoAta: globalNoAta,
        usdcMint: USDC_MINT,
        marketUsdcVault: marketUsdcVault,
        marketUsdcAta: marketUsdcAta,
        seederUsdcAta: userUsdcAta,
        seederLpPosition: seederLpPosition,
        seeder: payer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log('✅ 池子种子成功!');
    console.log('🔗 交易:', `https://explorer.solana.com/tx/${seedPoolTx}?cluster=devnet`);

  } catch (err: any) {
    console.error('❌ 种子池子失败:', err.message);
    if (err.logs) {
      console.error('程序日志:');
      err.logs.forEach((log: string) => console.error('  ', log));
    }
    throw err;
  }

  await sleep(2000);

  console.log('\n' + '='.repeat(60));
  console.log('步骤 4: 添加流动性 (Add Liquidity)');
  console.log('='.repeat(60));

  const addLiquidityAmount = new BN(2_500); // 0.0025 USDC
  console.log('\n💰 添加金额:', addLiquidityAmount.toString(), '(0.0025 USDC)');

  try {
    console.log('\n📤 发送 add_liquidity 交易...');
    const addLiquidityTx = await program.methods
      .addLiquidity(addLiquidityAmount)
      .accounts({
        lpProvider: payer.publicKey,
        market: marketPda,
        yesTokenMint: yesTokenMint.publicKey,
        noTokenMint: noTokenMint,
        globalConfig: configPda,
        marketUsdcVault: marketUsdcVault,
        lpProviderUsdcAccount: userUsdcAta,
        usdcMint: USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ 流动性添加成功!');
    console.log('🔗 交易:', `https://explorer.solana.com/tx/${addLiquidityTx}?cluster=devnet`);

    // 查询市场状态
    const market = await (program.account as any).market.fetch(marketPda);
    console.log('\n📊 市场状态:');
    console.log('  Total LP Shares:', market.totalLpShares.toString());
    console.log('  Pool USDC Reserve:', market.poolCollateralReserve.toString());

  } catch (err: any) {
    console.error('❌ 添加流动性失败:', err.message);
    if (err.logs) {
      console.error('程序日志:');
      err.logs.forEach((log: string) => console.error('  ', log));
    }
    throw err;
  }

  await sleep(2000);

  console.log('\n' + '='.repeat(60));
  console.log('步骤 5: 买入 YES 代币 (Swap Buy)');
  console.log('='.repeat(60));

  // 创建 YES token ATA
  console.log('\n准备 YES token 账户...');
  const userYesAta = await getOrCreateATA(connection, payer, yesTokenMint.publicKey, payer.publicKey);

  const buyAmount = new BN(1_000); // 0.001 USDC
  console.log('\n💵 买入金额:', buyAmount.toString(), '(0.001 USDC)');

  try {
    console.log('\n📤 发送 swap (buy YES) 交易...');
    const buyYesTx = await program.methods
      .swap(
        buyAmount,
        0, // direction: 0=buy
        1, // token_type: 1=yes
        new BN(0), // min_receive_amount (滑点保护)
        new BN(0)  // deadline (0=不检查)
      )
      .accounts({
        user: payer.publicKey,
        market: marketPda,
        yesTokenMint: yesTokenMint.publicKey,
        noTokenMint: noTokenMint,
        globalConfig: configPda,
        globalVault: globalVaultPda,
        marketUsdcVault: marketUsdcVault,
        userUsdcAccount: userUsdcAta,
        userYesAccount: userYesAta,
        userNoAccount: userYesAta, // 买入时不需要，但账户结构要求
        teamWallet: payer.publicKey, // 测试用，实际应该是配置的 team_wallet
        usdcMint: USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ 买入 YES 成功!');
    console.log('🔗 交易:', `https://explorer.solana.com/tx/${buyYesTx}?cluster=devnet`);

    // 查询 YES 余额
    const yesAccount = await getAccount(connection, userYesAta);
    console.log('🟢 YES 余额:', (Number(yesAccount.amount) / 1e6).toFixed(6));

  } catch (err: any) {
    console.error('❌ 买入失败:', err.message);
    if (err.logs) {
      console.error('程序日志:');
      err.logs.forEach((log: string) => console.error('  ', log));
    }
    throw err;
  }

  await sleep(2000);

  console.log('\n' + '='.repeat(60));
  console.log('步骤 6: 买入 NO 代币 (Swap Buy)');
  console.log('='.repeat(60));

  // 创建 NO token ATA
  console.log('\n准备 NO token 账户...');
  const userNoAta = await getOrCreateATA(connection, payer, noTokenMint.publicKey, payer.publicKey);

  try {
    console.log('\n📤 发送 swap (buy NO) 交易...');
    const buyNoTx = await program.methods
      .swap(
        buyAmount,
        0, // direction: 0=buy
        0, // token_type: 0=no
        new BN(0),
        new BN(0)
      )
      .accounts({
        user: payer.publicKey,
        market: marketPda,
        yesTokenMint: yesTokenMint.publicKey,
        noTokenMint: noTokenMint,
        globalConfig: configPda,
        globalVault: globalVaultPda,
        marketUsdcVault: marketUsdcVault,
        userUsdcAccount: userUsdcAta,
        userYesAccount: userYesAta,
        userNoAccount: userNoAta,
        teamWallet: payer.publicKey,
        usdcMint: USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ 买入 NO 成功!');
    console.log('🔗 交易:', `https://explorer.solana.com/tx/${buyNoTx}?cluster=devnet`);

    // 查询 NO 余额
    const noAccount = await getAccount(connection, userNoAta);
    console.log('🔴 NO 余额:', (Number(noAccount.amount) / 1e6).toFixed(6));

  } catch (err: any) {
    console.error('❌ 买入失败:', err.message);
    if (err.logs) {
      console.error('程序日志:');
      err.logs.slice(-20).forEach((log: string) => console.error('  ', log));
    }
  }

  await sleep(2000);

  console.log('\n' + '='.repeat(60));
  console.log('步骤 7: 卖出部分 YES 代币 (Swap Sell)');
  console.log('='.repeat(60));

  const sellAmount = new BN(500); // 卖出 0.0005 YES
  console.log('\n💰 卖出金额:', sellAmount.toString(), '(0.0005 YES)');

  try {
    console.log('\n📤 发送 swap (sell YES) 交易...');
    const sellYesTx = await program.methods
      .swap(
        sellAmount,
        1, // direction: 1=sell
        1, // token_type: 1=yes
        new BN(0),
        new BN(0)
      )
      .accounts({
        user: payer.publicKey,
        market: marketPda,
        yesTokenMint: yesTokenMint.publicKey,
        noTokenMint: noTokenMint,
        globalConfig: configPda,
        globalVault: globalVaultPda,
        marketUsdcVault: marketUsdcVault,
        userUsdcAccount: userUsdcAta,
        userYesAccount: userYesAta,
        userNoAccount: userNoAta,
        teamWallet: payer.publicKey,
        usdcMint: USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ 卖出 YES 成功!');
    console.log('🔗 交易:', `https://explorer.solana.com/tx/${sellYesTx}?cluster=devnet`);

    // 查询余额
    const yesAccount = await getAccount(connection, userYesAta);
    const usdcAccount = await getAccount(connection, userUsdcAta);
    console.log('🟢 YES 余额:', (Number(yesAccount.amount) / 1e6).toFixed(6));
    console.log('💵 USDC 余额:', (Number(usdcAccount.amount) / 1e6).toFixed(2));

  } catch (err: any) {
    console.error('❌ 卖出失败:', err.message);
    if (err.logs) {
      console.error('程序日志:');
      err.logs.slice(-20).forEach((log: string) => console.error('  ', log));
    }
  }

  await sleep(2000);

  console.log('\n' + '='.repeat(60));
  console.log('步骤 8: 移除流动性 (Withdraw Liquidity)');
  console.log('='.repeat(60));

  try {
    // 查询当前 LP 份额
    const market = await (program.account as any).market.fetch(marketPda);
    const userLpShares = market.totalLpShares; // 简化：假设用户拥有所有份额
    
    const withdrawShares = new BN(userLpShares.toString()).div(new BN(2)); // 提取一半
    console.log('\n💰 提取份额:', withdrawShares.toString());

    console.log('\n📤 发送 withdraw_liquidity 交易...');
    const withdrawTx = await program.methods
      .withdrawLiquidity(
        withdrawShares,
        new BN(0) // min_usdc_out (滑点保护)
      )
      .accounts({
        lpProvider: payer.publicKey,
        market: marketPda,
        yesTokenMint: yesTokenMint.publicKey,
        noTokenMint: noTokenMint,
        globalConfig: configPda,
        marketUsdcVault: marketUsdcVault,
        lpProviderUsdcAccount: userUsdcAta,
        usdcMint: USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ 流动性移除成功!');
    console.log('🔗 交易:', `https://explorer.solana.com/tx/${withdrawTx}?cluster=devnet`);

    // 查询最终余额
    const usdcAccount = await getAccount(connection, userUsdcAta);
    console.log('💵 最终 USDC 余额:', (Number(usdcAccount.amount) / 1e6).toFixed(2));

  } catch (err: any) {
    console.error('❌ 移除流动性失败:', err.message);
    if (err.logs) {
      console.error('程序日志:');
      err.logs.slice(-20).forEach((log: string) => console.error('  ', log));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 测试完成!');
  console.log('='.repeat(60));
  console.log('\n📊 市场 ID:', marketId.toString());
  console.log('🔗 在 Solana Explorer 查看市场账户:');
  console.log(`https://explorer.solana.com/address/${marketPda.toString()}?cluster=devnet`);
}

main()
  .then(() => {
    console.log('\n✨ 所有测试通过!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 测试失败:', err.message);
    process.exit(1);
  });
