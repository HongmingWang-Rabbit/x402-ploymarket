'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, Button } from '@/components/ui';
import { useBlockchain } from '@/lib/blockchain';
import type { Market } from '@/types';

interface MarketConfigPanelProps {
  market: Market;
}

type ConfigStatus = 'checking' | 'needs_fix' | 'ok' | 'error';

export function MarketConfigPanel({ market }: MarketConfigPanelProps) {
  const { connected, publicKey } = useWallet();
  const { adapter } = useBlockchain();
  const [mintAuthorityStatus, setMintAuthorityStatus] = useState<ConfigStatus>('checking');
  const [isFixing, setIsFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isCreator = publicKey?.toBase58() === market.creator;

  const checkMintAuthority = useCallback(async () => {
    setMintAuthorityStatus('checking');
    setError(null);

    try {
      // Simple heuristic: if market has 0 liquidity and was recently created,
      // it likely needs the mint authority fix
      if (market.totalLiquidity === 0) {
        setMintAuthorityStatus('needs_fix');
      } else {
        setMintAuthorityStatus('ok');
      }
    } catch (err) {
      console.error('Failed to check mint authority:', err);
      setMintAuthorityStatus('error');
      setError('Failed to check market configuration');
    }
  }, [market.totalLiquidity]);

  // Check mint authority status on mount
  useEffect(() => {
    checkMintAuthority();
  }, [checkMintAuthority]);

  const handleFixMintAuthority = async () => {
    if (!connected || !adapter.fixMarketMintAuthority) return;

    setIsFixing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await adapter.fixMarketMintAuthority(market.address);

      if (result.success) {
        setSuccessMessage('Mint authority transferred successfully! You can now add liquidity.');
        setMintAuthorityStatus('ok');
      } else {
        // Check if it's already fixed
        if (result.error?.includes('InvalidMintAuthority')) {
          setSuccessMessage('Mint authority is already configured correctly.');
          setMintAuthorityStatus('ok');
        } else {
          setError(result.error || 'Failed to fix mint authority');
        }
      }
    } catch (err) {
      console.error('Failed to fix mint authority:', err);
      setError(err instanceof Error ? err.message : 'Failed to fix mint authority');
    } finally {
      setIsFixing(false);
    }
  };

  if (!isCreator) {
    return null; // Don't show config panel to non-creators
  }

  return (
    <Card variant="bordered">
      <CardContent>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Market Configuration
        </h3>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          As the market creator, you can manage market settings here.
        </p>

        {/* Mint Authority Section */}
        <div className="space-y-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Mint Authority
              </h4>
              <StatusBadge status={mintAuthorityStatus} />
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              The mint authority must be transferred to the market PDA before liquidity can be added.
              This is a one-time setup required after market creation.
            </p>

            {mintAuthorityStatus === 'needs_fix' && (
              <Button
                onClick={handleFixMintAuthority}
                isLoading={isFixing}
                disabled={!connected || isFixing}
                className="w-full"
              >
                {connected ? 'Transfer Mint Authority' : 'Connect Wallet'}
              </Button>
            )}

            {mintAuthorityStatus === 'ok' && (
              <div className="text-sm text-green-600 dark:text-green-400">
                Mint authority is properly configured.
              </div>
            )}
          </div>

          {/* Market Info */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
              Market Details
            </h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Address</dt>
                <dd className="text-gray-900 dark:text-white font-mono text-xs">
                  {market.address.slice(0, 8)}...{market.address.slice(-8)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">YES Token</dt>
                <dd className="text-gray-900 dark:text-white font-mono text-xs">
                  {market.yesMint.slice(0, 8)}...{market.yesMint.slice(-8)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">NO Token</dt>
                <dd className="text-gray-900 dark:text-white font-mono text-xs">
                  {market.noMint.slice(0, 8)}...{market.noMint.slice(-8)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Total Liquidity</dt>
                <dd className="text-gray-900 dark:text-white">
                  ${market.totalLiquidity.toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ConfigStatus }) {
  const styles = {
    checking: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    needs_fix: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    ok: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const labels = {
    checking: 'Checking...',
    needs_fix: 'Action Required',
    ok: 'OK',
    error: 'Error',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
