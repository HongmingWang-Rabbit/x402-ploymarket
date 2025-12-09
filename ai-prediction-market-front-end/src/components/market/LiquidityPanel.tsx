'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, Button, Input, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { useAddLiquidity, useWithdrawLiquidity } from '@/features/liquidity/hooks';
import type { Market } from '@/types';

interface LiquidityPanelProps {
  market: Market;
}

export function LiquidityPanel({ market }: LiquidityPanelProps) {
  const { connected } = useWallet();
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');

  const addLiquidityMutation = useAddLiquidity();
  const withdrawLiquidityMutation = useWithdrawLiquidity();

  const isLoading = addLiquidityMutation.isPending || withdrawLiquidityMutation.isPending;

  // Calculate token values
  const yesValue = market.poolYesReserve * market.yesPrice;
  const noValue = market.poolNoReserve * market.noPrice;

  const handleSubmit = async () => {
    if (!connected || !amount || parseFloat(amount) <= 0) return;

    if (mode === 'add') {
      await addLiquidityMutation.mutateAsync({
        marketAddress: market.address,
        amount: parseFloat(amount),
      });
    } else {
      await withdrawLiquidityMutation.mutateAsync({
        marketAddress: market.address,
        lpAmount: parseFloat(amount),
      });
    }

    // Reset form on success
    setAmount('');
  };

  return (
    <Card variant="bordered">
      <CardContent>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Liquidity
        </h3>

        {/* Pool Value Summary */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Total Pool Value
            </span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(market.totalPoolValue)}
            </span>
          </div>

          {/* Detailed breakdown */}
          <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                USDC Reserve
              </span>
              <span className="text-gray-700 dark:text-gray-300">
                {formatCurrency(market.totalLiquidity)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                YES Tokens
                <span className="text-xs text-gray-400">
                  ({market.poolYesReserve.toFixed(2)} @ {formatPercent(market.yesPrice)})
                </span>
              </span>
              <span className="text-green-600 dark:text-green-400">
                {formatCurrency(yesValue)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                NO Tokens
                <span className="text-xs text-gray-400">
                  ({market.poolNoReserve.toFixed(2)} @ {formatPercent(market.noPrice)})
                </span>
              </span>
              <span className="text-red-600 dark:text-red-400">
                {formatCurrency(noValue)}
              </span>
            </div>
          </div>

          {/* LP Shares info */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Total LP Shares</span>
              <span className="text-gray-700 dark:text-gray-300 font-mono">
                {market.totalLpShares.toFixed(2)}
              </span>
            </div>
            {market.totalLpShares > 0 && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500 dark:text-gray-400">Value per LP Share</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {formatCurrency(market.totalPoolValue / market.totalLpShares)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mode selection */}
        <Tabs defaultValue="add" value={mode} onChange={(v) => setMode(v as 'add' | 'remove')}>
          <TabsList className="mb-4">
            <TabsTrigger value="add">Add Liquidity</TabsTrigger>
            <TabsTrigger value="remove">Remove Liquidity</TabsTrigger>
          </TabsList>

          <TabsContent value="add">
            <div className="space-y-4">
              <Input
                label="Amount (USDC)"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                rightAddon="USDC"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You will receive LP tokens representing your share of the pool.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="remove">
            <div className="space-y-4">
              <Input
                label="LP Tokens"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                rightAddon="LP"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Burn your LP tokens to withdraw your share of the liquidity.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Submit button */}
        <Button
          className="w-full mt-6"
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={!connected || !amount || parseFloat(amount) <= 0 || isLoading}
        >
          {connected
            ? mode === 'add'
              ? 'Add Liquidity'
              : 'Remove Liquidity'
            : 'Connect Wallet'}
        </Button>
      </CardContent>
    </Card>
  );
}
