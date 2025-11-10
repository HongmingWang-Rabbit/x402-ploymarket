'use client';

import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePredictionMarket } from '@/app/hooks/usePredictionMarket';
import { useX402Payment } from '@/app/hooks/useX402Payment';
import type { Market, TokenType, TradeDirection } from '@/app/lib/solana/types';

interface TradingInterfaceProps {
  market: Market;
  marketAddress: PublicKey;
  onSuccess?: () => void;
}

type TradeMode = 'swap' | 'mint' | 'redeem';
type PaymentMethod = 'wallet' | 'x402';

export function TradingInterface({ market, marketAddress, onSuccess }: TradingInterfaceProps) {
  const wallet = useWallet();
  const { swap, mintCompleteSet, redeemCompleteSet, loading, isConnected } =
    usePredictionMarket();
  const { buyTokenWithX402, loading: x402Loading } = useX402Payment();

  const [mode, setMode] = useState<TradeMode>('swap');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
  const [tokenType, setTokenType] = useState<TokenType>(1); // 1 = YES, 0 = NO (matches contract)
  const [direction, setDirection] = useState<TradeDirection>(0); // 0 = Buy, 1 = Sell
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('5'); // Increased default to account for fees + AMM price impact
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isPaused = market.status === 1;
  const isResolved = market.status === 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isConnected) {
      setError('Please connect your wallet');
      return;
    }

    if (isPaused || isResolved) {
      setError('Market is not active');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      let result;

      // X402 payment method - only available for Buy swaps
      if (mode === 'swap' && direction === 0 && paymentMethod === 'x402') {
        if (!wallet.publicKey) {
          setError('Please connect your wallet');
          return;
        }

        result = await buyTokenWithX402({
          market: marketAddress.toBase58(),
          tokenType,
          amount: amountNum,
          recipient: wallet.publicKey.toBase58(),
          slippage: parseFloat(slippage),
        });
      }
      // Regular wallet transactions
      else if (mode === 'swap') {
        const slippageNum = parseFloat(slippage);

        // Calculate minOutput accounting for fees
        // Contract charges 1.5% in fees (1% platform + 0.5% LP)
        // minOutput = amount * (1 - fees) * (1 - slippage)
        const feeRate = 0.015; // 1.5% total fees
        const afterFees = amountNum * (1 - feeRate);
        const minOutput = direction === 0 ? afterFees * (1 - slippageNum / 100) : 0;

        result = await swap({
          market: marketAddress,
          tokenType,
          direction,
          amount: amountNum,
          minOutput,
        });
      } else if (mode === 'mint') {
        result = await mintCompleteSet({
          market: marketAddress,
          usdcAmount: amountNum,
        });
      } else {
        // redeem
        result = await redeemCompleteSet({
          market: marketAddress,
          amount: amountNum,
        });
      }

      if (result.success) {
        setSuccess(`Transaction successful! Signature: ${result.signature.slice(0, 8)}...`);
        setAmount('');
        // Refresh market data after successful transaction
        if (onSuccess) {
          onSuccess();
        }
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
      <div className="flex space-x-2">
        <button
          onClick={() => setMode('swap')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'swap'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Swap
        </button>
        <button
          onClick={() => setMode('mint')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'mint'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Mint
        </button>
        <button
          onClick={() => setMode('redeem')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'redeem'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Redeem
        </button>
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
        {mode === 'swap' && (
          <>
            {/* Buy/Sell Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Direction
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection(0)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    direction === 0
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => setDirection(1)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    direction === 1
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Sell
                </button>
              </div>
            </div>

            {/* Token Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Token
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTokenType(1)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    tokenType === 1
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => setTokenType(0)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    tokenType === 0
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  NO
                </button>
              </div>
            </div>

            {/* Payment Method - only show for Buy */}
            {direction === 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      paymentMethod === 'wallet'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('x402')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      paymentMethod === 'x402'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    x402 (USDC)
                  </button>
                </div>
                {paymentMethod === 'x402' && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Pay with USDC on Solana - backend executes swap on your behalf
                  </p>
                )}
              </div>
            )}

            {/* Slippage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Slippage Tolerance (%)
              </label>
              <input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                step="0.1"
                min="0.1"
                max="50"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </>
        )}

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Amount (USDC)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.01"
            min="0"
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            required
          />
          {mode === 'mint' && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              You will receive {amount || '0'} YES + {amount || '0'} NO tokens
            </p>
          )}
          {mode === 'redeem' && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Burn {amount || '0'} YES + {amount || '0'} NO to get {amount || '0'} USDC
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || x402Loading || isPaused || isResolved || !isConnected}
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!isConnected
            ? 'Connect Wallet'
            : isPaused
            ? 'Market Paused'
            : isResolved
            ? 'Market Resolved'
            : loading || x402Loading
            ? paymentMethod === 'x402' ? 'Processing Payment...' : 'Processing...'
            : mode === 'swap'
            ? `${direction === 0 ? 'Buy' : 'Sell'} ${tokenType === 1 ? 'YES' : 'NO'}${direction === 0 && paymentMethod === 'x402' ? ' with x402' : ''}`
            : mode === 'mint'
            ? 'Mint Complete Set'
            : 'Redeem Complete Set'}
        </button>
      </form>

      {/* Info Box */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">
          How it works:
        </h4>
        <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
          {mode === 'swap' && (
            <>
              <li>• Buy/sell YES or NO tokens</li>
              <li>• Prices determined by LMSR algorithm</li>
              <li>• Slippage protection included</li>
            </>
          )}
          {mode === 'mint' && (
            <>
              <li>• Convert 1 USDC → 1 YES + 1 NO</li>
              <li>• Always 1:1 exchange rate</li>
              <li>• No price impact</li>
            </>
          )}
          {mode === 'redeem' && (
            <>
              <li>• Burn 1 YES + 1 NO → get 1 USDC</li>
              <li>• Must have equal amounts</li>
              <li>• No price impact</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
