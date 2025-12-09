'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { LoadingSpinner, EmptyState } from '@/components/common';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { usePortfolio } from '@/features/portfolio/hooks';
import { formatCurrency, formatAddress, ROUTES } from '@/lib/utils';

export default function PortfolioPage() {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { data: positions, isLoading, error } = usePortfolio();

  // Calculate portfolio summary
  const summary = useMemo(() => {
    if (!positions || positions.length === 0) {
      return { totalValue: 0, activePositions: 0, totalPnl: 0 };
    }

    return positions.reduce(
      (acc, pos) => ({
        totalValue: acc.totalValue + pos.yesBalance + pos.noBalance + pos.lpBalance,
        activePositions: acc.activePositions + (pos.yesBalance > 0 || pos.noBalance > 0 || pos.lpBalance > 0 ? 1 : 0),
        totalPnl: acc.totalPnl + pos.realizedPnl,
      }),
      { totalValue: 0, activePositions: 0, totalPnl: 0 }
    );
  }, [positions]);

  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Portfolio
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Connect your wallet to view your positions and trading history
        </p>
        <Button onClick={() => setVisible(true)} size="lg">
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Portfolio
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {formatAddress(publicKey?.toBase58() || '', 8)}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card variant="bordered">
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Total Value
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {isLoading ? <LoadingSpinner size="sm" /> : formatCurrency(summary.totalValue)}
            </p>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Active Positions
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {isLoading ? <LoadingSpinner size="sm" /> : summary.activePositions}
            </p>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Total P&L
            </p>
            <p className={`text-2xl font-bold ${summary.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {isLoading ? <LoadingSpinner size="sm" /> : formatCurrency(summary.totalPnl)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Positions */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Your Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Failed to load positions. Please try again.
            </div>
          ) : !positions || positions.length === 0 ? (
            <EmptyState
              title="No positions yet"
              description="Start trading to see your positions here."
              action={
                <Link href={ROUTES.MARKETS}>
                  <Button>Browse Markets</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {positions.map((position) => (
                <Link
                  key={position.marketAddress}
                  href={ROUTES.MARKET_DETAIL(position.marketAddress)}
                  className="block"
                >
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-sm text-gray-500">
                        {formatAddress(position.marketAddress, 6)}
                      </span>
                      <span className={`font-medium ${position.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {position.realizedPnl >= 0 ? '+' : ''}{formatCurrency(position.realizedPnl)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      {position.yesBalance > 0 && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">YES</span>
                          <p className="font-medium text-green-600">{position.yesBalance.toFixed(4)}</p>
                        </div>
                      )}
                      {position.noBalance > 0 && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">NO</span>
                          <p className="font-medium text-red-600">{position.noBalance.toFixed(4)}</p>
                        </div>
                      )}
                      {position.lpBalance > 0 && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">LP</span>
                          <p className="font-medium text-purple-600">{position.lpBalance.toFixed(4)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
