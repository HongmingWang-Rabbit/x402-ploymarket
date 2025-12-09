'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { MarketCard, MarketCardSkeleton } from './MarketCard';
import { ErrorDisplay } from '@/components/common';
import { useMarkets } from '@/features/markets/hooks';
import { DEFAULT_PAGE_SIZE } from '@/lib/utils/constants';

interface MarketListProps {
  initialLimit?: number;
}

export function MarketList({ initialLimit = DEFAULT_PAGE_SIZE }: MarketListProps) {
  const [page, setPage] = useState(0);
  const offset = page * initialLimit;

  const { data, isLoading, isError, error, refetch } = useMarkets({
    limit: initialLimit,
    offset,
  });

  const markets = data?.markets || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / initialLimit);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: initialLimit }).map((_, i) => (
          <MarketCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorDisplay
        title="Failed to load markets"
        message={error instanceof Error ? error.message : 'An error occurred'}
        onRetry={() => refetch()}
      />
    );
  }

  if (markets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          No markets found. Be the first to create one!
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Market grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {markets.map((market) => (
          <MarketCard key={market.address} market={market} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
