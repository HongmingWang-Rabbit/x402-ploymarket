'use client';

import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { usePredictionMarket } from '@/app/hooks/usePredictionMarket';
import type { Market } from '@/app/lib/solana/types';
import { formatUSDC } from '@/app/lib/solana/program';

interface LiquidityInterfaceProps {
  market: Market;
  marketAddress: PublicKey;
}

type LPMode = 'add' | 'withdraw';

export function LiquidityInterface({ market, marketAddress }: LiquidityInterfaceProps) {
  const { addLiquidity, withdrawLiquidity, loading, isConnected } = usePredictionMarket();

  const [mode, setMode] = useState<LPMode>('add');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isPaused = market.marketPaused;
  const isResolved = market.isCompleted;
  const totalLiquidity = (market.poolYesReserve && market.poolNoReserve && market.poolCollateralReserve)
    ? formatUSDC(market.poolYesReserve.add(market.poolNoReserve).add(market.poolCollateralReserve))
    : '0.00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isConnected) {
      setError('Please connect your wallet');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      let result;

      if (mode === 'add') {
        result = await addLiquidity({
          market: marketAddress,
          usdcAmount: amountNum,
        });
      } else {
        result = await withdrawLiquidity({
          market: marketAddress,
          lpSharesAmount: amountNum,
        });
      }

      if (result.success) {
        setSuccess(`Transaction successful! Signature: ${result.signature.slice(0, 8)}...`);
        setAmount('');
      } else {
        setError(result.error || 'Transaction failed');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode('add')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'add'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Add Liquidity
        </button>
        <button
          onClick={() => setMode('withdraw')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'withdraw'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Withdraw
        </button>
      </div>

      {/* Pool Stats */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Total Liquidity
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              ${totalLiquidity}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              LP Shares
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatUSDC(market.lpShares)}
            </div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-200">
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {mode === 'add' ? 'Amount (USDC)' : 'LP Shares'}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="10"
            min={mode === 'add' ? "100" : "0"}
            placeholder={mode === 'add' ? "Min: 100 USDC" : "0.00"}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            required
          />
          {mode === 'add' && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Single-sided LP: Provide USDC only (Minimum: 100 USDC)
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || isPaused || isResolved || !isConnected}
          className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!isConnected
            ? 'Connect Wallet'
            : isPaused
            ? 'Market Paused'
            : isResolved
            ? 'Market Resolved'
            : loading
            ? 'Processing...'
            : mode === 'add'
            ? 'Add Liquidity'
            : 'Withdraw Liquidity'}
        </button>
      </form>

      {/* Info Box */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">
          {mode === 'add' ? 'Add Liquidity' : 'Withdraw Liquidity'}:
        </h4>
        <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
          {mode === 'add' ? (
            <>
              <li>• Single-sided LP: Only provide USDC</li>
              <li>• Contract auto-mints YES + NO tokens</li>
              <li>• Earn fees from swaps</li>
              <li>• Receive LP shares proportional to deposit</li>
            </>
          ) : (
            <>
              <li>• Burn LP shares to withdraw liquidity</li>
              <li>• Receive USDC, YES, and NO tokens</li>
              <li>• Proportional to your share of pool</li>
              <li>• May have early withdrawal penalty</li>
            </>
          )}
        </ul>
      </div>

      {/* Additional Info */}
      <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">YES Reserve:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatUSDC(market.yesReserve)}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">NO Reserve:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatUSDC(market.noReserve)}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">USDC Reserve:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatUSDC(market.usdcReserve)}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">LMSR B Parameter:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatUSDC(market.lmsrB)}
          </span>
        </div>
      </div>
    </div>
  );
}
