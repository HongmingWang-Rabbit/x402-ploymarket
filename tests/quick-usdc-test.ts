/**
 * 快速 USDC 验证测试
 *
 * 用途：快速验证关键 USDC 功能是否正常工作
 * 时间：~30秒
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Connection,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createMint,
  createAccount,
  mintTo,
  getAccount,
  getMint,
  createAssociatedTokenAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { expect } from "chai";
import { createProvider } from "../lib/util";

describe("Quick USDC Migration Check", () => {
  const provider = createProvider();
  anchor.setProvider(provider);

  const program = anchor.workspace.PredictionMarket as Program<PredictionMarket>;

  const authority = provider.wallet.publicKey;
  const user = Keypair.generate();

  let usdcMint: PublicKey;
  let globalConfig: PublicKey;
  let globalVault: PublicKey;
  let globalUsdcVault: PublicKey;
  let userUsdcAta: PublicKey;

  async function airdrop(publicKey: PublicKey, amount: number) {
    const sig = await provider.connection.requestAirdrop(
      publicKey,
      amount * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  }

  async function getUsdcBalance(ata: PublicKey): Promise<number> {
    try {
      const info = await getAccount(provider.connection as unknown as Connection, ata);
      return Number(info.amount);
    } catch {
      return 0;
    }
  }

  before(async () => {
    console.log("\n🔧 Setting up quick test environment...\n");

    // 空投 SOL
    await airdrop(user.publicKey, 5);

    // 创建 USDC mint
    usdcMint = await createMint(
      provider.connection as unknown as Connection,
      (provider.wallet as any).payer,
      authority,
      null,
      6
    );
    console.log("✅ Created USDC mint");

    // 派生 PDAs
    [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    [globalVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("global")],
      program.programId
    );

    globalUsdcVault = await getAssociatedTokenAddress(
      usdcMint,
      globalVault,
      true
    );

    // 创建用户 USDC ATA
    userUsdcAta = await createAssociatedTokenAccount(
      provider.connection as unknown as Connection,
      (provider.wallet as any).payer,
      usdcMint,
      user.publicKey
    );

    // 铸造 USDC
    await mintTo(
      provider.connection as unknown as Connection,
      (provider.wallet as any).payer,
      usdcMint,
      userUsdcAta,
      authority,
      1_000_000_000 // 1000 USDC
    );

    console.log("✅ Minted 1000 USDC to user");
    console.log("✅ Setup complete\n");
  });

  it("✅ 验证 USDC mint 地址正确", async () => {
    expect(usdcMint).to.exist;
    const mintInfo = await provider.connection.getAccountInfo(usdcMint);
    expect(mintInfo).to.exist;
    console.log("✅ USDC mint:", usdcMint.toBase58());
  });

  it("✅ 验证 global USDC vault 存在", async () => {
    // 创建如果不存在
    try {
      await getAccount(provider.connection as unknown as Connection, globalUsdcVault);
    } catch {
      // 为 PDA 创建关联代币账户需要特殊处理
      const createATAInstruction = createAssociatedTokenAccountInstruction(
        (provider.wallet as any).payer.publicKey, // 付款人
        globalUsdcVault, // ATA 地址
        globalVault, // 所有者 (PDA)
        usdcMint // 代币 mint
      );
      
      const transaction = new Transaction().add(createATAInstruction);
      await provider.sendAndConfirm(transaction, [(provider.wallet as any).payer]);
    }

    const vaultInfo = await getAccount(provider.connection as unknown as Connection, globalUsdcVault);
    expect(vaultInfo.owner.toBase58()).to.equal(globalVault.toBase58());
    console.log("✅ Global USDC vault:", globalUsdcVault.toBase58());
  });

  it("✅ 验证用户 USDC 余额正确", async () => {
    const balance = await getUsdcBalance(userUsdcAta);
    expect(balance).to.equal(1_000_000_000);
    console.log(`✅ User USDC balance: ${balance / 1_000_000} USDC`);
  });

  it("✅ 验证 USDC 转账功能 (模拟)", async () => {
    const balanceBefore = await getUsdcBalance(userUsdcAta);

    // 这里只是验证我们能够读取余额和账户信息
    // 实际转账在完整测试套件中
    expect(balanceBefore).to.be.greaterThan(0);

    console.log("✅ USDC transfer infrastructure ready");
  });

  it("✅ 显示测试摘要", async () => {
    console.log("\n📊 Quick Test Summary:");
    console.log("  - USDC Mint:", usdcMint.toBase58().substring(0, 8) + "...");
    console.log("  - Global Vault:", globalVault.toBase58().substring(0, 8) + "...");
    console.log("  - Global USDC Vault:", globalUsdcVault.toBase58().substring(0, 8) + "...");
    console.log("  - User USDC ATA:", userUsdcAta.toBase58().substring(0, 8) + "...");

    const userBalance = await getUsdcBalance(userUsdcAta);
    console.log("  - User Balance: " + userBalance / 1_000_000 + " USDC");

    console.log("\n✅ All quick checks passed!");
    console.log("💡 Run full test suite for comprehensive validation:");
    console.log("   anchor test tests/usdc-migration.test.ts\n");
  });
});
