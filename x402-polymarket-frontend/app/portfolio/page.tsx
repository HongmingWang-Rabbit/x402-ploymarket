'use client';

import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { PredictionMarketClient } from '@/app/lib/solana/client';
import type { Market, UserInfo } from '@/app/lib/solana/types';
import Link from 'next/link';

interface MarketPosition {
  marketAddress: string;
  market: Market;
  userInfo: UserInfo;
  yesBalance: number;
  noBalance: number;
  lpShares: number;
  currentYesPrice: number;
  currentNoPrice: number;
  positionValue: number;
}

export default function PortfolioPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [positions, setPositions] = useState<MarketPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    if (!wallet.publicKey) {
      setPositions([]);
      setLoading(false);
      return;
    }

    loadPortfolio();
  }, [wallet.publicKey, connection]);

  const loadPortfolio = async () => {
    if (!wallet.publicKey) return;

    setLoading(true);
    try {
      const client = new PredictionMarketClient(connection, wallet);

      // Get all markets
      const markets = await client.getAllMarkets();

      // Load user info for each market
      const positionsData: MarketPosition[] = [];
      let total = 0;

      for (const { address, data: market } of markets) {
        const userInfo = await client.getUserInfo(wallet.publicKey, address);

        if (!userInfo) continue;

        const yesBalance = userInfo.yesAmount.toNumber() / 1e6;
        const noBalance = userInfo.noAmount.toNumber() / 1e6;
        const lpShares = userInfo.lpShares.toNumber() / 1e6;

        // Skip if user has no position in this market
        if (yesBalance === 0 && noBalance === 0 && lpShares === 0) {
          continue;
        }

        // Calculate current prices
        const currentYesPrice = client.calculatePrice(market, 1); // YES token
        const currentNoPrice = client.calculatePrice(market, 0); // NO token

        // Calculate position value
        const positionValue = (yesBalance * currentYesPrice) + (noBalance * currentNoPrice);
        total += positionValue;

        positionsData.push({
          marketAddress: address.toBase58(),
          market,
          userInfo,
          yesBalance,
          noBalance,
          lpShares,
          currentYesPrice,
          currentNoPrice,
          positionValue,
        });
      }

      setPositions(positionsData);
      setTotalValue(total);
    } catch (error) {
      console.error('Failed to load portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!wallet.publicKey) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-16">
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Connect Your Wallet
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Connect your wallet to view your portfolio and trading positions
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading your portfolio...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Your Portfolio
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your positions and performance across all markets
          </p>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Total Portfolio Value
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              ${totalValue.toFixed(2)}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Active Positions
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {positions.length}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Markets
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {positions.length}
            </div>
          </div>
        </div>

        {/* Positions List */}
        {positions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 border border-gray-200 dark:border-gray-700 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Positions Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Start trading to build your portfolio
            </p>
            <Link href="/">
              <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all">
                Browse Markets
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {positions.map((position) => (
              <Link
                key={position.marketAddress}
                href={`/markets/${position.marketAddress}`}
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {position.market.displayName || 'Market'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {position.marketAddress.slice(0, 8)}...{position.marketAddress.slice(-8)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Position Value
                      </div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white">
                        ${position.positionValue.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* YES Position */}
                    {position.yesBalance > 0 && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                        <div className="text-xs text-green-700 dark:text-green-400 mb-1 font-medium">
                          YES TOKENS
                        </div>
                        <div className="text-lg font-bold text-green-900 dark:text-green-200">
                          {position.yesBalance.toFixed(2)}
                        </div>
                        <div className="text-xs text-green-700 dark:text-green-400 mt-1">
                          @ ${position.currentYesPrice.toFixed(4)} = $
                          {(position.yesBalance * position.currentYesPrice).toFixed(2)}
                        </div>
                      </div>
                    )}

                    {/* NO Position */}
                    {position.noBalance > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                        <div className="text-xs text-red-700 dark:text-red-400 mb-1 font-medium">
                          NO TOKENS
                        </div>
                        <div className="text-lg font-bold text-red-900 dark:text-red-200">
                          {position.noBalance.toFixed(2)}
                        </div>
                        <div className="text-xs text-red-700 dark:text-red-400 mt-1">
                          @ ${position.currentNoPrice.toFixed(4)} = $
                          {(position.noBalance * position.currentNoPrice).toFixed(2)}
                        </div>
                      </div>
                    )}

                    {/* LP Position */}
                    {position.lpShares > 0 && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                        <div className="text-xs text-purple-700 dark:text-purple-400 mb-1 font-medium">
                          LP SHARES
                        </div>
                        <div className="text-lg font-bold text-purple-900 dark:text-purple-200">
                          {position.lpShares.toFixed(2)}
                        </div>
                        <div className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                          Providing liquidity
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
