'use client';

import { useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useUserTokenBalances, useUserLPPosition } from '@/features/portfolio/hooks';
import type { Market } from '@/types';

interface UserHoldingsProps {
  market: Market;
}

export function UserHoldings({ market }: UserHoldingsProps) {
  const { connected } = useWallet();

  const { data: lpPosition, isLoading: isLoadingLP } = useUserLPPosition(market.address);
  const { data: tokenBalances, isLoading: isLoadingTokens } = useUserTokenBalances(market.address);

  const isLoading = isLoadingLP || isLoadingTokens;

  // Memoize calculated values
  const holdingsValues = useMemo(() => {
    const yesValue = (tokenBalances?.yesBalance || 0) * market.yesPrice;
    const noValue = (tokenBalances?.noBalance || 0) * market.noPrice;
    const totalTokenValue = yesValue + noValue;
    const hasTokens = (tokenBalances?.yesBalance || 0) > 0 || (tokenBalances?.noBalance || 0) > 0;
    const totalHoldingsValue = totalTokenValue + (lpPosition?.estimatedValue || 0);

    return { yesValue, noValue, totalTokenValue, hasTokens, totalHoldingsValue };
  }, [tokenBalances, lpPosition, market.yesPrice, market.noPrice]);

  const { yesValue, noValue, totalTokenValue, hasTokens, totalHoldingsValue } = holdingsValues;

  if (!connected) {
    return (
      <Card variant="bordered">
        <CardContent>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Your Holdings
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Connect your wallet to view your holdings in this market.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card variant="bordered">
        <CardContent>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Your Holdings
          </h3>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!lpPosition && !hasTokens) {
    return (
      <Card variant="bordered">
        <CardContent>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Your Holdings
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You don&apos;t have any position in this market yet.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Add liquidity or trade to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  const pnlColor = (lpPosition?.unrealizedPnl || 0) >= 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

  const pnlBgColor = (lpPosition?.unrealizedPnl || 0) >= 0
    ? 'bg-green-50 dark:bg-green-900/20'
    : 'bg-red-50 dark:bg-red-900/20';

  return (
    <Card variant="bordered">
      <CardContent>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Your Holdings
        </h3>

        {/* Main Value Display */}
        <div className={`rounded-lg p-4 mb-4 ${pnlBgColor}`}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Total Value
            </span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(totalHoldingsValue)}
            </span>
          </div>
          {lpPosition && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                LP Unrealized P&L
              </span>
              <div className="text-right">
                <span className={`font-semibold ${pnlColor}`}>
                  {lpPosition.unrealizedPnl >= 0 ? '+' : ''}
                  {formatCurrency(lpPosition.unrealizedPnl)}
                </span>
                <span className={`ml-2 text-sm ${pnlColor}`}>
                  ({lpPosition.unrealizedPnlPercent >= 0 ? '+' : ''}
                  {lpPosition.unrealizedPnlPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Position Details */}
        <div className="space-y-3">
          {/* Token Holdings */}
          {hasTokens && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Token Holdings
                </span>
              </div>
              <div className="space-y-2">
                {(tokenBalances?.yesBalance || 0) > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                        YES
                      </span>
                      <span className="font-mono text-gray-900 dark:text-white">
                        {tokenBalances?.yesBalance.toFixed(4)}
                      </span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400">
                      ~{formatCurrency(yesValue)}
                    </span>
                  </div>
                )}
                {(tokenBalances?.noBalance || 0) > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-medium">
                        NO
                      </span>
                      <span className="font-mono text-gray-900 dark:text-white">
                        {tokenBalances?.noBalance.toFixed(4)}
                      </span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400">
                      ~{formatCurrency(noValue)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Token Value</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(totalTokenValue)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* LP Position */}
          {lpPosition && (
          <>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                LP Position
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">LP Shares</span>
                <p className="font-mono text-gray-900 dark:text-white">
                  {lpPosition.lpShares.toFixed(4)}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Pool Share</span>
                <p className="font-mono text-gray-900 dark:text-white">
                  {lpPosition.sharePercentage.toFixed(2)}%
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Invested</span>
                <p className="font-mono text-gray-900 dark:text-white">
                  {formatCurrency(lpPosition.investedUsdc)}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Current Value</span>
                <p className="font-mono text-gray-900 dark:text-white">
                  {formatCurrency(lpPosition.estimatedValue)}
                </p>
              </div>
            </div>
          </div>

          {/* Time & Penalty Info */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Holding Info
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Holding Period</span>
                  <p className="font-mono text-gray-900 dark:text-white">
                    {lpPosition.holdingDays} day{lpPosition.holdingDays !== 1 ? 's' : ''}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Exit Penalty</span>
                  <p className={`font-mono ${lpPosition.earlyExitPenaltyPercent > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                    {lpPosition.earlyExitPenaltyPercent > 0
                      ? `${lpPosition.earlyExitPenaltyPercent}%`
                      : 'None'}
                  </p>
                </div>
              </div>

              {/* Penalty Timeline */}
              {lpPosition.earlyExitPenaltyPercent > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Early Exit Penalty Schedule:
                  </p>
                  <div className="flex gap-1 text-xs">
                    <div className={`flex-1 p-1.5 rounded text-center ${lpPosition.holdingDays < 7 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                      &lt;7d: 3%
                    </div>
                    <div className={`flex-1 p-1.5 rounded text-center ${lpPosition.holdingDays >= 7 && lpPosition.holdingDays < 14 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                      7-14d: 1.5%
                    </div>
                    <div className={`flex-1 p-1.5 rounded text-center ${lpPosition.holdingDays >= 14 && lpPosition.holdingDays < 30 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                      14-30d: 0.5%
                    </div>
                    <div className={`flex-1 p-1.5 rounded text-center ${lpPosition.holdingDays >= 30 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                      30d+: 0%
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* What You'd Receive on Withdrawal */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                If you withdraw now:
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Gross Value</span>
                <span className="text-gray-900 dark:text-white">
                  {formatCurrency(lpPosition.estimatedValue)}
                </span>
              </div>
              {lpPosition.earlyExitPenaltyPercent > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Penalty ({lpPosition.earlyExitPenaltyPercent}%)
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    -{formatCurrency(lpPosition.estimatedValue * (lpPosition.earlyExitPenaltyPercent / 100))}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                <span className="text-gray-700 dark:text-gray-300">Est. Received</span>
                <span className="text-gray-900 dark:text-white">
                  ~{formatCurrency(lpPosition.estimatedValue * (1 - lpPosition.earlyExitPenaltyPercent / 100))}
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                * Actual amount may vary due to slippage from internal token swaps
              </p>
            </div>
          </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
