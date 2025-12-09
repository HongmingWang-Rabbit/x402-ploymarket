'use client';

import { useState, useMemo, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, Button, Input } from '@/components/ui';
import { formatPercent, formatCurrency, MAX_TRADE_SIZE_PERCENT } from '@/lib/utils';
import { DEFAULT_SLIPPAGE } from '@/lib/utils/constants';
import { useSwap } from '@/features/trading/hooks';
import { useUserTokenBalances } from '@/features/portfolio/hooks';
import { marketKeys } from '@/features/markets/types';
import type { Market } from '@/types';

interface TradingPanelProps {
  market: Market;
}

export function TradingPanel({ market }: TradingPanelProps) {
  const { connected } = useWallet();
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');
  const [tradeType, setTradeType] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);

  const swapMutation = useSwap();
  const { data: tokenBalances, refetch: refetchBalances } = useUserTokenBalances(market.address);

  // Memoize computed values to prevent unnecessary recalculations
  const tradeCalculations = useMemo(() => {
    const parsedAmount = parseFloat(amount) || 0;
    const price = tradeType === 'yes' ? market.yesPrice : market.noPrice;
    const maxTradeSize = market.totalLiquidity * MAX_TRADE_SIZE_PERCENT;
    const userBalance = tradeType === 'yes' ? tokenBalances?.yesBalance || 0 : tokenBalances?.noBalance || 0;
    const maxSellAmount = Math.min(userBalance, maxTradeSize);

    // For buying: amount is USDC, estimate shares received
    // For selling: amount is tokens, estimate USDC received
    const estimatedOutput = direction === 'buy'
      ? parsedAmount / price
      : parsedAmount * price;

    const isAmountTooLarge = direction === 'buy'
      ? parsedAmount > maxTradeSize
      : parsedAmount > maxSellAmount;

    return {
      parsedAmount,
      price,
      maxTradeSize,
      userBalance,
      maxSellAmount,
      estimatedOutput,
      isAmountTooLarge,
    };
  }, [amount, tradeType, direction, market.yesPrice, market.noPrice, market.totalLiquidity, tokenBalances]);

  const { parsedAmount, price, maxTradeSize, userBalance, estimatedOutput, isAmountTooLarge } = tradeCalculations;

  const handleTrade = useCallback(async () => {
    if (!connected || !amount || parsedAmount <= 0) return;

    await swapMutation.mutateAsync({
      marketAddress: market.address,
      direction,
      tokenType: tradeType,
      amount: parsedAmount,
      slippage,
    });

    // Reset form on success
    setAmount('');

    // Refetch balances after trade
    refetchBalances();
    queryClient.invalidateQueries({ queryKey: marketKeys.detail(market.address) });
  }, [connected, amount, parsedAmount, swapMutation, market.address, direction, tradeType, slippage, refetchBalances, queryClient]);

  return (
    <Card variant="bordered">
      <CardContent>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Trade
        </h3>

        {/* Buy/Sell Toggle */}
        <div className="flex mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setDirection('buy')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              direction === 'buy'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setDirection('sell')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              direction === 'sell'
                ? 'bg-red-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Sell
          </button>
        </div>

        {/* Token selection */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setTradeType('yes')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              tradeType === 'yes'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
            }`}
          >
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              Yes
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {formatPercent(market.yesPrice, 2)}
            </div>
            {direction === 'sell' && tokenBalances && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Balance: {tokenBalances.yesBalance.toFixed(4)}
              </div>
            )}
          </button>

          <button
            onClick={() => setTradeType('no')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              tradeType === 'no'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-red-300'
            }`}
          >
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              No
            </div>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
              {formatPercent(market.noPrice, 2)}
            </div>
            {direction === 'sell' && tokenBalances && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Balance: {tokenBalances.noBalance.toFixed(4)}
              </div>
            )}
          </button>
        </div>

        {/* Amount input */}
        <div className="mb-4">
          <Input
            label={direction === 'buy' ? 'Amount (USDC)' : `Amount (${tradeType.toUpperCase()} tokens)`}
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            rightAddon={direction === 'buy' ? 'USDC' : tradeType.toUpperCase()}
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>
              {direction === 'buy'
                ? `Max trade: ${formatCurrency(maxTradeSize)} (10% of pool)`
                : `Available: ${userBalance.toFixed(4)} ${tradeType.toUpperCase()}`
              }
            </span>
            {direction === 'sell' && userBalance > 0 && (
              <button
                onClick={() => setAmount(Math.min(userBalance, maxTradeSize).toString())}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Max
              </button>
            )}
          </div>
          {isAmountTooLarge && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {direction === 'buy'
                ? `Amount exceeds max trade size. Try ${formatCurrency(maxTradeSize)} or less.`
                : `Amount exceeds available balance or max trade size.`
              }
            </p>
          )}
        </div>

        {/* Slippage */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Slippage Tolerance
          </label>
          <div className="flex gap-2">
            {[1, 5, 10].map((value) => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  slippage === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {value}%
              </button>
            ))}
            <Input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value) || 5)}
              className="w-20"
              rightAddon="%"
            />
          </div>
        </div>

        {/* Estimate */}
        {parsedAmount > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500 dark:text-gray-400">
                {direction === 'buy' ? 'You Pay' : 'You Sell'}
              </span>
              <span className="font-medium">
                {direction === 'buy'
                  ? formatCurrency(parsedAmount)
                  : `${parsedAmount.toFixed(4)} ${tradeType.toUpperCase()}`
                }
              </span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500 dark:text-gray-400">
                {direction === 'buy' ? 'You Receive (est.)' : 'You Receive (est.)'}
              </span>
              <span className="font-medium">
                {direction === 'buy'
                  ? `~${estimatedOutput.toFixed(4)} ${tradeType.toUpperCase()}`
                  : `~${formatCurrency(estimatedOutput)}`
                }
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Price per Token
              </span>
              <span className="font-medium">{formatCurrency(price)}</span>
            </div>
          </div>
        )}

        {/* Error display */}
        {swapMutation.isError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700 dark:text-red-300">
              {swapMutation.error instanceof Error
                ? swapMutation.error.message
                : 'Transaction failed'}
            </p>
          </div>
        )}

        {/* Trade button */}
        <Button
          className={`w-full ${direction === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''}`}
          onClick={handleTrade}
          isLoading={swapMutation.isPending}
          disabled={!connected || !amount || parsedAmount <= 0 || isAmountTooLarge || swapMutation.isPending}
        >
          {connected
            ? isAmountTooLarge
              ? 'Amount Too Large'
              : `${direction === 'buy' ? 'Buy' : 'Sell'} ${tradeType.toUpperCase()}`
            : 'Connect Wallet to Trade'}
        </Button>
      </CardContent>
    </Card>
  );
}
