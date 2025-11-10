'use client';

import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { getPredictionMarketProgram, PDAHelper, PROGRAM_CONFIG } from '@/app/lib/solana/program';
import Link from 'next/link';

// Devnet USDC Mint
const USDC_MINT_DEVNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

export default function AdminPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [configExists, setConfigExists] = useState<boolean | null>(null);
  const [configData, setConfigData] = useState<any>(null);
  const [configPDA, setConfigPDA] = useState<PublicKey | null>(null);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    teamWallet: wallet.publicKey?.toBase58() || '',
    swapFee: '30',
    lpFee: '20',
    tokenDecimals: '6',
    tokenSupply: '1000000',
    initialReserves: '500',
    whitelistEnabled: false,
    minUsdcLiquidity: '100', // 100 USDC minimum for add liquidity
  });

  // Check if config exists
  useEffect(() => {
    const checkConfig = async () => {
      if (!wallet.publicKey) {
        setCheckingConfig(false);
        return;
      }

      setCheckingConfig(true);

      try {
        const program = getPredictionMarketProgram(connection, wallet);
        const [derivedConfigPDA] = PDAHelper.getConfigPDA();
        setConfigPDA(derivedConfigPDA);

        console.log('🔍 Checking config PDA:', derivedConfigPDA.toBase58());

        // Try to fetch the config account
        const config = await program.account.config.fetch(derivedConfigPDA);

        console.log('✅ Config exists!');
        console.log('  Authority:', config.authority.toBase58());
        console.log('  Team Wallet:', config.teamWallet.toBase58());
        console.log('  USDC Mint:', config.usdcMint.toBase58());
        console.log('  Platform Buy Fee:', config.platformBuyFee, 'bp');
        console.log('  Platform Sell Fee:', config.platformSellFee, 'bp');
        console.log('  LP Buy Fee:', config.lpBuyFee, 'bp');
        console.log('  LP Sell Fee:', config.lpSellFee, 'bp');
        console.log('  Whitelist Enabled:', config.whitelistEnabled);
        console.log('  Is Paused:', config.isPaused);

        setConfigExists(true);
        setConfigData(config);
      } catch (err: any) {
        console.log('❌ Config does not exist yet');
        console.log('  Error:', err.message);
        console.log('  Expected PDA:', configPDA?.toBase58());
        console.log('  This is normal if the program has not been initialized.');

        setConfigExists(false);
        setConfigData(null);
      } finally {
        setCheckingConfig(false);
      }
    };

    checkConfig();
  }, [connection, wallet.publicKey]);

  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Please connect your wallet');
      setLoading(false);
      return;
    }

    try {
      const program = getPredictionMarketProgram(connection, wallet);

      // Derive PDAs
      const [configPDA] = PDAHelper.getConfigPDA();
      const [globalVaultPDA] = PDAHelper.getGlobalVaultPDA();

      // Get global vault USDC ATA
      const globalVaultUsdcAta = await getAssociatedTokenAddress(
        USDC_MINT_DEVNET,
        globalVaultPDA,
        true
      );

      // Parse form values
      const teamWalletPubkey = new PublicKey(formData.teamWallet);
      const swapFee = parseInt(formData.swapFee);
      const lpFee = parseInt(formData.lpFee);
      const tokenDecimals = parseInt(formData.tokenDecimals);
      const tokenSupply = new BN(parseFloat(formData.tokenSupply) * 1_000_000); // Convert to 6 decimals
      const initialReserves = new BN(parseFloat(formData.initialReserves) * 1_000_000);

      console.log('Initializing with params:', {
        authority: wallet.publicKey.toBase58(),
        teamWallet: teamWalletPubkey.toBase58(),
        usdcMint: USDC_MINT_DEVNET.toBase58(),
        platformBuyFee: swapFee,
        platformSellFee: swapFee,
        lpBuyFee: lpFee,
        lpSellFee: lpFee,
        tokenDecimals,
        tokenSupply: tokenSupply.toString(),
        initialReserves: initialReserves.toString(),
        whitelistEnabled: formData.whitelistEnabled,
      });

      // Call configure instruction
      const tx = await program.methods
        .configure({
          authority: wallet.publicKey,
          pendingAuthority: PublicKey.default,
          teamWallet: teamWalletPubkey,
          platformBuyFee: new BN(swapFee),
          platformSellFee: new BN(swapFee),
          lpBuyFee: new BN(lpFee),
          lpSellFee: new BN(lpFee),
          tokenSupplyConfig: tokenSupply,
          tokenDecimalsConfig: tokenDecimals,
          initialRealTokenReservesConfig: initialReserves,
          minSolLiquidity: new BN(0), // Deprecated
          minTradingLiquidity: new BN(1000_000_000), // 1000 USDC minimum
          initialized: true,
          isPaused: false,
          whitelistEnabled: formData.whitelistEnabled,
          usdcMint: USDC_MINT_DEVNET,
          usdcVaultMinBalance: new BN(5000), // 0.005 USDC
          minUsdcLiquidity: new BN(parseFloat(formData.minUsdcLiquidity) * 1_000_000), // Convert USDC to raw units
          lpInsurancePoolBalance: new BN(0),
          lpInsuranceAllocationBps: 2000, // 20%
          insuranceLossThresholdBps: 1000, // 10%
          insuranceMaxCompensationBps: 5000, // 50%
          insurancePoolEnabled: false, // Disabled initially (no platform fees)
        })
        .accounts({
          payer: wallet.publicKey,
          config: configPDA,
          globalVault: globalVaultPDA,
          globalVaultUsdcAta: globalVaultUsdcAta,
          usdcMint: USDC_MINT_DEVNET,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      setSuccess(`Program initialized successfully! Transaction: ${tx.slice(0, 8)}...`);
      setConfigExists(true);

      console.log('Transaction signature:', tx);
      console.log('View on explorer:', `https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    } catch (err: any) {
      console.error('Initialization error:', err);
      setError(err.message || 'Failed to initialize program');

      if (err.logs) {
        console.error('Program logs:', err.logs);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!wallet.publicKey) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Admin Access Required
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please connect your Solana wallet to access the admin panel
          </p>
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Panel
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Initialize and manage the Prediction Market program
          </p>
        </div>

        {/* Program Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Program Information
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Program ID:</span>
              <span className="font-mono text-gray-900 dark:text-white">
                {PROGRAM_CONFIG.programId.toBase58().slice(0, 8)}...
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Network:</span>
              <span className="text-gray-900 dark:text-white">{PROGRAM_CONFIG.network}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Your Wallet:</span>
              <span className="font-mono text-gray-900 dark:text-white">
                {wallet.publicKey.toBase58().slice(0, 8)}...
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Config PDA:</span>
              <span className="font-mono text-xs text-gray-900 dark:text-white">
                {configPDA?.toBase58().slice(0, 8)}...
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Config Status:</span>
              {checkingConfig ? (
                <span className="text-gray-500">Checking...</span>
              ) : configExists ? (
                <span className="text-green-600 dark:text-green-400">✅ Initialized</span>
              ) : (
                <span className="text-yellow-600 dark:text-yellow-400">⚠️ Not Initialized</span>
              )}
            </div>
          </div>
        </div>

        {/* Config Exists Warning */}
        {configExists && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">
                  Program Already Initialized
                </h4>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                  The program config already exists. You can update it using admin functions instead.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-green-800 dark:text-green-200">{success}</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <span className="text-red-800 dark:text-red-200">{error}</span>
              </div>
            </div>
          </div>
        )}

        {/* Initialization Form */}
        <form onSubmit={handleInitialize} className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Initialize Program Configuration
          </h2>

          {/* Team Wallet */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Team Wallet Address *
            </label>
            <input
              type="text"
              value={formData.teamWallet}
              onChange={(e) => setFormData({ ...formData, teamWallet: e.target.value })}
              placeholder="Enter team wallet address for fee collection"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This wallet will receive trading fees. Defaults to your connected wallet.
            </p>
          </div>

          {/* Fee Configuration */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Swap Fee (basis points) *
              </label>
              <input
                type="number"
                value={formData.swapFee}
                onChange={(e) => setFormData({ ...formData, swapFee: e.target.value })}
                min="0"
                max="10000"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formData.swapFee ? `${parseInt(formData.swapFee) / 100}%` : '0%'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                LP Fee (basis points) *
              </label>
              <input
                type="number"
                value={formData.lpFee}
                onChange={(e) => setFormData({ ...formData, lpFee: e.target.value })}
                min="0"
                max="10000"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formData.lpFee ? `${parseInt(formData.lpFee) / 100}%` : '0%'}
              </p>
            </div>
          </div>

          {/* Token Configuration */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Token Decimals *
              </label>
              <input
                type="number"
                value={formData.tokenDecimals}
                onChange={(e) => setFormData({ ...formData, tokenDecimals: e.target.value })}
                min="0"
                max="9"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Token Supply (USDC) *
              </label>
              <input
                type="number"
                value={formData.tokenSupply}
                onChange={(e) => setFormData({ ...formData, tokenSupply: e.target.value })}
                min="1"
                step="1"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Initial Reserves (USDC) *
              </label>
              <input
                type="number"
                value={formData.initialReserves}
                onChange={(e) => setFormData({ ...formData, initialReserves: e.target.value })}
                min="1"
                step="1"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Minimum Liquidity */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Minimum Liquidity (USDC)
            </label>
            <input
              type="number"
              value={formData.minUsdcLiquidity}
              onChange={(e) => setFormData({ ...formData, minUsdcLiquidity: e.target.value })}
              min="1"
              max="10000"
              step="1"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Minimum USDC required to add liquidity (1 - 10,000 USDC)
            </p>
          </div>

          {/* Whitelist Toggle */}
          <div className="mb-6">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.whitelistEnabled}
                onChange={(e) => setFormData({ ...formData, whitelistEnabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Creator Whitelist
              </span>
            </label>
            <p className="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
              If enabled, only whitelisted addresses can create markets
            </p>
          </div>

          {/* Info Box */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
              Configuration Summary
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>• Admin: {wallet.publicKey.toBase58().slice(0, 8)}... (your wallet)</li>
              <li>• USDC Mint: {USDC_MINT_DEVNET.toBase58().slice(0, 8)}... (devnet)</li>
              <li>• Swap Fee: {parseInt(formData.swapFee) / 100}%</li>
              <li>• LP Fee: {parseInt(formData.lpFee) / 100}%</li>
              <li>• Min Liquidity: {formData.minUsdcLiquidity} USDC</li>
              <li>• Whitelist: {formData.whitelistEnabled ? 'Enabled' : 'Disabled'}</li>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || configExists === true}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Initializing Program...
              </span>
            ) : configExists ? (
              'Already Initialized'
            ) : (
              'Initialize Program'
            )}
          </button>
        </form>

        {/* Additional Info */}
        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            What happens when you initialize?
          </h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
            <li>Creates the global config account</li>
            <li>Sets up the global USDC vault</li>
            <li>Configures fees and parameters</li>
            <li>Sets you as the program admin</li>
            <li>Enables market creation</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
