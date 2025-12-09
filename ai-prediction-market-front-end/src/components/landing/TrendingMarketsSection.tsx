'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { useMarkets } from '@/features/markets/hooks/useMarkets';
import { formatCurrency } from '@/lib/utils';
import type { MarketWithMetadata } from '@/features/markets/types';

interface MarketCardProps {
  market: MarketWithMetadata;
}

function TrendingMarketCard({ market }: MarketCardProps) {
  const isActive = market.status === 'active';
  const statusColor = isActive ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400';

  return (
    <Link href={`/markets/${market.address}`}>
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 hover:border-purple-500/50 transition-colors cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
            {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
          </span>
        </div>

        <h3 className="text-white font-semibold mb-4 min-h-[48px] line-clamp-2">{market.name}</h3>

        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-green-600 rounded-xl py-3 px-4 text-center">
            <div className="text-green-200 text-xs font-medium mb-1">YES</div>
            <div className="text-white text-xl font-bold">${market.yesPrice.toFixed(2)}</div>
          </div>
          <div className="flex-1 bg-gray-700 rounded-xl py-3 px-4 text-center">
            <div className="text-gray-400 text-xs font-medium mb-1">NO</div>
            <div className="text-white text-xl font-bold">${market.noPrice.toFixed(2)}</div>
          </div>
        </div>

        <div className="flex justify-between text-sm text-gray-400">
          <span>Liquidity: {formatCurrency(market.totalLiquidity)}</span>
        </div>
      </div>
    </Link>
  );
}

function TrendingMarketCardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="h-6 w-16 bg-gray-700 rounded-full" />
      </div>
      <div className="h-12 bg-gray-700 rounded mb-4" />
      <div className="flex gap-3 mb-4">
        <div className="flex-1 h-20 bg-gray-700 rounded-xl" />
        <div className="flex-1 h-20 bg-gray-700 rounded-xl" />
      </div>
      <div className="h-4 w-32 bg-gray-700 rounded" />
    </div>
  );
}

export function TrendingMarketsSection() {
  const { data, isLoading } = useMarkets({ limit: 3 });
  const markets = data?.markets ?? [];

  return (
    <section className="py-16">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Trending Markets</h2>
          <p className="text-gray-400">Most active prediction markets</p>
        </div>
        <Link href="/markets">
          <Button variant="outline" className="border-gray-700 text-white hover:bg-gray-800">
            View All Markets
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            <TrendingMarketCardSkeleton />
            <TrendingMarketCardSkeleton />
            <TrendingMarketCardSkeleton />
          </>
        ) : markets.length > 0 ? (
          markets.map((market) => <TrendingMarketCard key={market.address} market={market} />)
        ) : (
          <div className="col-span-3 text-center py-12">
            <p className="text-gray-400">No markets available yet.</p>
            <Link href="/markets" className="text-purple-400 hover:underline mt-2 inline-block">
              Browse all markets
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
