const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const fs = require("fs");

async function main() {
  console.log("🚀 初始化 Devnet 配置...\n");

  // 设置 devnet 连接
  const connection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
  
  // 读取本地密钥
  const keypairPath = "/Users/alanluo/.config/solana/id.json";
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  console.log("📍 使用钱包:", wallet.publicKey.toString());
  
  // 检查余额
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("💰 余额:", balance / anchor.web3.LAMPORTS_PER_SOL, "SOL\n");

  // 设置 Provider
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );

  // Devnet 程序 ID
  const programId = new PublicKey("CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM");
  console.log("📋 程序 ID:", programId.toString());

  // 加载 IDL
  const idlPath = "./target/idl/prediction_market.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  
  // 创建程序实例
  const program = new anchor.Program(idl, programId, provider);

  // 查找配置 PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );

  // 查找全局金库 PDA
  const [globalVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    programId
  );

  console.log("🔑 配置 PDA:", configPda.toString());
  console.log("🔑 全局金库 PDA:", globalVaultPda.toString());

  // 检查配置是否已存在
  try {
    const configAccount = await program.account.config.fetch(configPda);
    console.log("\n✅ 配置已存在！");
    console.log("Authority:", configAccount.authority.toString());
    console.log("Team Wallet:", configAccount.teamWallet.toString());
    console.log("Platform Buy Fee:", configAccount.platformBuyFee.toString(), "bps");
    console.log("Min USDC Liquidity:", configAccount.minUsdcLiquidity.toString());
    return;
  } catch (err) {
    console.log("\n⚠️  配置不存在，开始初始化...\n");
  }

  // 初始化配置
  try {
    // Devnet USDC mint
    const usdcMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    
    // 创建配置对象
    const newConfig = {
      authority: wallet.publicKey,
      pendingAuthority: PublicKey.default,
      teamWallet: wallet.publicKey,
      platformBuyFee: new anchor.BN(30),  // 0.3% (30 bps)
      platformSellFee: new anchor.BN(30),  // 0.3%
      lpBuyFee: new anchor.BN(20),  // 0.2%
      lpSellFee: new anchor.BN(20),  // 0.2%
      tokenSupplyConfig: new anchor.BN(1_000_000_000_000),  // 1M USDC
      tokenDecimalsConfig: 6,  // USDC精度
      initialRealTokenReservesConfig: new anchor.BN(500_000_000),  // 500 USDC
      minSolLiquidity: new anchor.BN(5_000_000_000),  // 5 SOL (废弃)
      minTradingLiquidity: new anchor.BN(100_000_000),  // 100 USDC
      initialized: false,
      isPaused: false,
      whitelistEnabled: false,
      usdcMint: usdcMint,
      usdcVaultMinBalance: new anchor.BN(1_000_000),  // 1 USDC
      minUsdcLiquidity: new anchor.BN(10_000_000),  // 10 USDC ✅
      lpInsurancePoolBalance: new anchor.BN(0),
      lpInsuranceAllocationBps: 2000,  // 20%
      insuranceLossThresholdBps: 1000,  // 10%
      insuranceMaxCompensationBps: 5000,  // 50%
      insurancePoolEnabled: false
    };

    console.log("📝 配置参数:");
    console.log("  - Authority:", newConfig.authority.toString());
    console.log("  - Team Wallet:", newConfig.teamWallet.toString());
    console.log("  - Platform Buy Fee:", newConfig.platformBuyFee.toString(), "bps");
    console.log("  - Platform Sell Fee:", newConfig.platformSellFee.toString(), "bps");
    console.log("  - Token Decimals:", newConfig.tokenDecimalsConfig);
    console.log("  - USDC Mint:", newConfig.usdcMint.toString());
    console.log("  - Min USDC Liquidity:", newConfig.minUsdcLiquidity.toString(), "(10 USDC)");
    console.log("\n开始交易...\n");

    const tx = await program.methods
      .configure(newConfig)
      .accounts({
        payer: wallet.publicKey,
        config: configPda,
        globalVault: globalVaultPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ 初始化成功！");
    console.log("📝 交易签名:", tx);
    console.log("🔗 查看交易: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");
    console.log("\n等待确认...");
    
    await connection.confirmTransaction(tx, "confirmed");
    
    // 验证配置
    const configAccount = await program.account.config.fetch(configPda);
    console.log("\n✅ 配置验证成功！");
    console.log("Authority:", configAccount.authority.toString());
    console.log("Team Wallet:", configAccount.teamWallet.toString());
    console.log("Platform Buy Fee:", configAccount.platformBuyFee.toString(), "bps");
    console.log("Min USDC Liquidity:", configAccount.minUsdcLiquidity.toString());
    console.log("Paused:", configAccount.isPaused);
    
  } catch (err) {
    console.error("\n❌ 初始化失败:", err);
    if (err.logs) {
      console.error("\n程序日志:");
      err.logs.forEach(log => console.error(log));
    }
    throw err;
  }
}

main()
  .then(() => {
    console.log("\n🎉 完成！");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
