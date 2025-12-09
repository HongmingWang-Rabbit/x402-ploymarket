'use client';

import { Card, CardContent } from '@/components/ui';
import { formatPercent, formatCurrency, formatAddress } from '@/lib/utils';
import type { Market } from '@/types';

interface MarketStatsProps {
  market: Market;
}

export function MarketStats({ market }: MarketStatsProps) {
  // Calculate the value of YES and NO tokens in the pool
  const yesValue = market.poolYesReserve * market.yesPrice;
  const noValue = market.poolNoReserve * market.noPrice;

  return (
    <Card variant="bordered">
      <CardContent>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Market Stats
        </h3>
        <div className="space-y-4">
          {/* Current Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                Yes Price
              </p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {formatPercent(market.yesPrice)}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                No Price
              </p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                {formatPercent(market.noPrice)}
              </p>
            </div>
          </div>

          {/* Pool Liquidity Breakdown */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Total Pool Value
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(market.totalPoolValue)}
              </span>
            </div>

            {/* Breakdown bars */}
            <div className="space-y-2">
              {/* USDC Reserve */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">USDC Reserve</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {formatCurrency(market.totalLiquidity)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${market.totalPoolValue > 0 ? (market.totalLiquidity / market.totalPoolValue) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* YES Token Value */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">
                    YES Tokens ({market.poolYesReserve.toFixed(2)} @ {formatPercent(market.yesPrice)})
                  </span>
                  <span className="text-green-600 dark:text-green-400">
                    {formatCurrency(yesValue)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{
                      width: `${market.totalPoolValue > 0 ? (yesValue / market.totalPoolValue) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* NO Token Value */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">
                    NO Tokens ({market.poolNoReserve.toFixed(2)} @ {formatPercent(market.noPrice)})
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    {formatCurrency(noValue)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{
                      width: `${market.totalPoolValue > 0 ? (noValue / market.totalPoolValue) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* LP Shares */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Total LP Shares</span>
                <span className="text-gray-700 dark:text-gray-300 font-mono">
                  {market.totalLpShares.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <span
                className={`font-medium ${
                  market.status === 'active'
                    ? 'text-green-600'
                    : market.status === 'resolved'
                    ? 'text-gray-600'
                    : 'text-yellow-600'
                }`}
              >
                {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">
                B Parameter (Depth)
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {market.bParameter.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Creator</span>
              <span className="font-medium text-gray-900 dark:text-white font-mono">
                {formatAddress(market.creator, 6)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Address</span>
              <span className="font-medium text-gray-900 dark:text-white font-mono">
                {formatAddress(market.address, 6)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
