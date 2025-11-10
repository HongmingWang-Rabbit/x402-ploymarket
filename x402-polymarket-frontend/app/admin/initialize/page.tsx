'use client';

import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { getPredictionMarketProgram, PDAHelper } from '@/app/lib/solana/program';

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const USDC_MINT_DEVNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

export default function InitializePage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [configExists, setConfigExists] = useState<boolean | null>(null);

  // Configuration parameters
  const [teamWallet, setTeamWallet] = useState(wallet.publicKey?.toBase58() || '');
  const [swapFee, setSwapFee] = useState(30); // 0.3%
  const [lpFee, setLpFee] = useState(20); // 0.2%
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);

  const checkConfig = async () => {
    if (!wallet.publicKey) {
      setError('Please connect your wallet');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setStatus('Checking configuration...');

      const program = getPredictionMarketProgram(connection, wallet);
      const [configPDA] = PDAHelper.getConfigPDA();

      try {
        const config = await program.account.config.fetch(configPDA);
        setConfigExists(true);
        setStatus(`✅ Config exists!\nAdmin: ${config.admin.toBase58()}\nTeam Wallet: ${config.teamWallet.toBase58()}\nSwap Fee: ${config.swapFee} bp\nLP Fee: ${config.lpFee} bp`);
      } catch (err) {
        setConfigExists(false);
        setStatus('⚠️ Config not found. You need to initialize it.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeConfig = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Please connect your wallet');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setStatus('Initializing configuration...');

      const program = getPredictionMarketProgram(connection, wallet);
      const [configPDA] = PDAHelper.getConfigPDA();
      const [globalVaultPDA] = PDAHelper.getGlobalVaultPDA();

      // Get global vault USDC ATA
      const [globalVaultUsdcAta] = PublicKey.findProgramAddressSync(
        [
          globalVaultPDA.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          USDC_MINT_DEVNET.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const teamWalletPubkey = new PublicKey(teamWallet);

      // 🔍 调试：检查钱包地址
      console.log('🔍 钱包信息:');
      console.log('  wallet.publicKey:', wallet.publicKey?.toBase58());
      console.log('  teamWallet (state):', teamWallet);
      console.log('  teamWalletPubkey:', teamWalletPubkey.toBase58());
      
      // ✅ 重要：authority 必须是当前连接的钱包
      // 不要使用 teamWalletPubkey，因为那可能是旧的值
      if (!wallet.publicKey) {
        throw new Error('钱包未连接');
      }
      
      // ✅ 按照 IDL 顺序排列字段（Anchor 可能对顺序敏感）
      const configParams = {
        // 1-3: 权限管理 (pubkey)
        authority: wallet.publicKey,  // ✅ 使用当前连接的钱包
        pending_authority: PublicKey.default,
        team_wallet: wallet.publicKey,  // ✅ 也使用当前钱包作为 team_wallet
        
        // 4-7: 手续费 (u64)
        platform_buy_fee: new BN(swapFee),
        platform_sell_fee: new BN(swapFee),
        lp_buy_fee: new BN(lpFee),
        lp_sell_fee: new BN(lpFee),
        
        // 8-10: 代币配置
        token_supply_config: new BN(1_000_000_000_000), // u64: 1M USDC
        token_decimals_config: 6, // u8: 必须是 6
        initial_real_token_reserves_config: new BN(500_000_000), // u64: 500 USDC
        
        // 11-12: 流动性配置 (u64)
        min_sol_liquidity: new BN(5_000_000_000), // 5 SOL
        min_trading_liquidity: new BN(100_000_000), // 100 USDC
        
        // 13-15: 状态标志 (bool)
        initialized: false,
        is_paused: false,
        whitelist_enabled: whitelistEnabled,
        
        // 16-18: USDC 配置
        usdc_mint: USDC_MINT_DEVNET, // pubkey
        usdc_vault_min_balance: new BN(1_000_000), // u64: 1 USDC
        min_usdc_liquidity: new BN(10_000_000), // u64: 10 USDC
        
        // 19-23: 保险池配置
        lp_insurance_pool_balance: new BN(0), // u64
        lp_insurance_allocation_bps: 2000, // u16: 20%
        insurance_loss_threshold_bps: 1000, // u16: 10%
        insurance_max_compensation_bps: 5000, // u16: 50%
        insurance_pool_enabled: false, // bool
      };

      // 🔍 详细调试：打印配置参数
      console.log('='.repeat(60));
      console.log('🔍 配置参数详细信息');
      console.log('='.repeat(60));
      
      // 检查 token_decimals_config
      console.log('\n【关键字段】token_decimals_config:');
      console.log('  值:', configParams.token_decimals_config);
      console.log('  类型:', typeof configParams.token_decimals_config);
      console.log('  === 6?', configParams.token_decimals_config === 6);
      console.log('  === "6"?', configParams.token_decimals_config === "6");
      console.log('  === Number(6)?', configParams.token_decimals_config === Number(6));
      
      // 检查所有字段
      console.log('\n【所有字段】:');
      Object.keys(configParams).forEach((key, index) => {
        const value = configParams[key];
        let displayValue = value;
        let typeInfo = typeof value;
        
        if (value instanceof BN) {
          displayValue = value.toString();
          typeInfo = 'BN';
        } else if (value instanceof PublicKey) {
          displayValue = value.toBase58();
          typeInfo = 'PublicKey';
        }
        
        console.log(`  ${index + 1}. ${key}: ${displayValue} (${typeInfo})`);
      });
      
      console.log('\n' + '='.repeat(60));

      setStatus('Sending transaction...');

      // 重试逻辑
      let tx: string | undefined;
      let lastError: any;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`📤 尝试发送交易 (${attempt}/${maxRetries})...`);
          
          tx = await program.methods
            .configure(configParams)
            .accounts({
              payer: wallet.publicKey,
              config: configPDA,
              globalVault: globalVaultPDA,
              globalVaultUsdcAta,
              usdcMint: USDC_MINT_DEVNET,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .rpc();
          
          console.log('✅ 交易成功:', tx);
          break; // 成功，退出循环
          
        } catch (err: any) {
          lastError = err;
          console.error(`❌ 尝试 ${attempt} 失败:`, err.message);
          
          if (attempt < maxRetries) {
            console.log(`⏳ 等待 2 秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      if (!tx) {
        throw lastError || new Error('交易失败');
      }

      setStatus(`✅ Configuration initialized successfully!\n\nTransaction: ${tx}\n\nView on explorer:\nhttps://explorer.solana.com/tx/${tx}?cluster=devnet`);
      setConfigExists(true);
    } catch (err: any) {
      console.error('Initialization error:', err);
      setError(err.message || 'Failed to initialize configuration');
      if (err.logs) {
        console.error('Program logs:', err.logs);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Initialize Program</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Initialize the global configuration for the Prediction Market program
            </p>
          </div>

          {/* Wallet Status */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Connected Wallet:</span>
              <span className="text-sm font-mono">
                {wallet.publicKey ? wallet.publicKey.toBase58().slice(0, 8) + '...' : 'Not connected'}
              </span>
            </div>
          </div>

          {/* Check Config Button */}
          <div className="mb-6">
            <button
              onClick={checkConfig}
              disabled={!wallet.publicKey || loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Checking...' : 'Check Configuration Status'}
            </button>
          </div>

          {/* Configuration Form */}
          {configExists === false && (
            <div className="mb-6 space-y-4">
              <h2 className="text-xl font-semibold mb-4">Configuration Parameters</h2>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Team Wallet Address
                </label>
                <input
                  type="text"
                  value={teamWallet}
                  onChange={(e) => setTeamWallet(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="Enter team wallet address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Swap Fee (basis points)
                  </label>
                  <input
                    type="number"
                    value={swapFee}
                    onChange={(e) => setSwapFee(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">{swapFee / 100}%</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    LP Fee (basis points)
                  </label>
                  <input
                    type="number"
                    value={lpFee}
                    onChange={(e) => setLpFee(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">{lpFee / 100}%</p>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={whitelistEnabled}
                  onChange={(e) => setWhitelistEnabled(e.target.checked)}
                  className="mr-2"
                />
                <label className="text-sm font-medium">
                  Enable Creator Whitelist
                </label>
              </div>

              <button
                onClick={initializeConfig}
                disabled={!wallet.publicKey || loading || !teamWallet}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
              >
                {loading ? 'Initializing...' : 'Initialize Configuration'}
              </button>
            </div>
          )}

          {/* Status Display */}
          {status && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <pre className="text-sm whitespace-pre-wrap">{status}</pre>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
              <p className="font-semibold mb-1">Error:</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Info */}
          <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h3 className="font-semibold mb-2">⚠️ Important Notes:</h3>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>This operation can only be performed once</li>
              <li>Make sure you have enough SOL for the transaction (~0.1 SOL)</li>
              <li>The connected wallet will become the program admin</li>
              <li>Configuration cannot be changed after initialization (in current version)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
