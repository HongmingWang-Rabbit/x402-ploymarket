'use client';

import Link from 'next/link';
import type { ExistingMarket } from '../types';

interface ExistingMarketMatchProps {
  market: ExistingMarket;
}

export function ExistingMarketMatch({ market }: ExistingMarketMatchProps) {
  const similarityPercent = Math.round(market.similarity_score * 100);

  return (
    <div className="mt-6 p-6 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <svg
            className="w-5 h-5 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-yellow-400 mb-2">
            Similar Market Already Exists
          </h3>
          <p className="text-gray-300 mb-4">
            We found a market that&apos;s {similarityPercent}% similar to your proposal.
            Consider trading on the existing market instead!
          </p>

          <div className="p-4 bg-gray-800/50 rounded-lg mb-4">
            <h4 className="text-white font-medium mb-2">{market.title}</h4>
            <span className="text-xs text-gray-500">
              Match score: {similarityPercent}%
            </span>
          </div>

          <Link
            href={`/markets/${market.market_address}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg transition-colors"
          >
            View Market
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
