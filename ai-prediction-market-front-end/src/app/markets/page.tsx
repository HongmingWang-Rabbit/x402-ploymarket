'use client';

import { MarketList } from '@/components/market';

export default function MarketsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          All Markets
        </h1>
        <p className="text-gray-400">
          Browse and trade on prediction markets
        </p>
      </div>

      <MarketList />
    </div>
  );
}
