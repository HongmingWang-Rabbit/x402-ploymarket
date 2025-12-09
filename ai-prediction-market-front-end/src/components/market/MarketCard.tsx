'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui';
import { formatPercent, formatCurrency, formatRelativeTime } from '@/lib/utils';
import type { MarketWithMetadata } from '@/features/markets/types';

interface MarketCardProps {
  market: MarketWithMetadata;
}

export function MarketCard({ market }: MarketCardProps) {
  const yesPercent = market.yesPrice * 100;
  const noPercent = market.noPrice * 100;
  const { metadata } = market;

  return (
    <Link href={`/markets/${market.address}`}>
      <Card
        variant="bordered"
        className="hover:border-blue-500 transition-colors cursor-pointer h-full"
      >
        <CardContent>
          {/* Status badge and category */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  market.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : market.status === 'resolved'
                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                }`}
              >
                {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
              </span>
              {metadata?.category && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {metadata.category}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatRelativeTime(market.createdAt)}
            </span>
          </div>

          {/* Market question */}
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
            {market.name}
          </h3>

          {/* Description */}
          {metadata?.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
              {metadata.description}
            </p>
          )}

          {/* Resolution source */}
          {metadata?.resolutionSource && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Source: {metadata.resolutionSource}
            </div>
          )}

          {/* Probability bars */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600 dark:text-green-400 font-medium">
                Yes
              </span>
              <span className="text-green-600 dark:text-green-400 font-medium">
                {formatPercent(market.yesPrice)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${yesPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-red-600 dark:text-red-400 font-medium">
                No
              </span>
              <span className="text-red-600 dark:text-red-400 font-medium">
                {formatPercent(market.noPrice)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all"
                style={{ width: `${noPercent}%` }}
              />
            </div>
          </div>

          {/* Liquidity */}
          <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800">
            <span>Liquidity</span>
            <span className="font-medium">
              {formatCurrency(market.totalLiquidity)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Loading skeleton
export function MarketCardSkeleton() {
  return (
    <Card variant="bordered" className="h-full">
      <CardContent>
        <div className="flex justify-between items-start mb-3">
          <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
        <div className="space-y-2 mb-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        </div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}
