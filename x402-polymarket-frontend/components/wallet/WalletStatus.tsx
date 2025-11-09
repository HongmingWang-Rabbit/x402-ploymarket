'use client';

import React from 'react';
import { useWallet } from '@/app/hooks/wallet';
import {
  BlockchainType,
  WalletUtils,
  EVMWalletUtils,
  SolanaWalletUtils,
  EVM_NETWORKS,
  SOLANA_NETWORKS,
} from '@/app/utils/wallet';
import { useAccount, useChainId } from 'wagmi';

/**
 * WalletStatus Props
 */
interface WalletStatusProps {
  showNetwork?: boolean;
  showAddress?: boolean;
  className?: string;
}

/**
 * WalletStatus Component
 *
 * Displays current wallet connection status using internal wallet utilities.
 * Fully integrated with the internal wallet system for customization.
 */
export function WalletStatus({
  showNetwork = true,
  showAddress = true,
  className = '',
}: WalletStatusProps) {
  const { chainType, isConnected, address } = useWallet();

  // Get EVM-specific data
  const chainId = useChainId();
  const { chain } = useAccount();

  if (!isConnected || !address) {
    return null;
  }

  // Format address using internal utils
  const formattedAddress = WalletUtils.formatAddress(address, chainType);

  // Get network info using internal utils
  const getNetworkInfo = () => {
    if (chainType === BlockchainType.EVM) {
      const networkName = chain?.name || EVMWalletUtils.getNetworkName(chainId || 1) || 'Unknown';
      return {
        name: networkName,
        color: 'blue',
      };
    } else {
      // Solana - currently hardcoded to devnet, can be made dynamic
      const network = SOLANA_NETWORKS['devnet'];
      return {
        name: network.name,
        color: 'purple',
      };
    }
  };

  const networkInfo = getNetworkInfo();

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Network Badge */}
      {showNetwork && (
        <div className={`
          px-2 py-1 rounded-md text-xs font-medium
          ${networkInfo.color === 'blue'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
          }
        `}>
          {networkInfo.name}
        </div>
      )}

      {/* Address Display */}
      {showAddress && (
        <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
          <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
            {formattedAddress}
          </span>
        </div>
      )}

      {/* Connection Indicator */}
      <div className="flex items-center">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      </div>
    </div>
  );
}

/**
 * NetworkBadge Component
 *
 * Shows the current network using internal wallet constants
 */
interface NetworkBadgeProps {
  className?: string;
}

export function NetworkBadge({ className = '' }: NetworkBadgeProps) {
  const { chainType } = useWallet();
  const chainId = useChainId();
  const { chain } = useAccount();

  const getNetworkDisplay = () => {
    if (chainType === BlockchainType.EVM) {
      // Use internal utils to get network name
      const networkName = chain?.name || EVMWalletUtils.getNetworkName(chainId || 1);

      // Find matching network config for additional info
      const networkConfig = Object.values(EVM_NETWORKS).find(n => n.chainId === chainId);

      return {
        name: networkName || 'Unknown',
        symbol: networkConfig?.nativeCurrency.symbol || 'ETH',
        isTestnet: networkName?.toLowerCase().includes('sepolia') || networkName?.toLowerCase().includes('testnet'),
      };
    } else {
      // Solana
      const network = SOLANA_NETWORKS['devnet']; // Can be made dynamic
      return {
        name: network.name,
        symbol: 'SOL',
        isTestnet: network.cluster !== 'mainnet-beta',
      };
    }
  };

  const network = getNetworkDisplay();

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      <div className={`
        px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-2
        ${chainType === BlockchainType.EVM
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          : 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
        }
      `}>
        {/* Chain Type Icon */}
        <span className="text-xs font-bold">
          {chainType === BlockchainType.EVM ? '🔷' : '🟣'}
        </span>

        {/* Network Name */}
        <span>
          {network.name}
        </span>

        {/* Testnet Indicator */}
        {network.isTestnet && (
          <span className="text-xs opacity-60">(Testnet)</span>
        )}
      </div>
    </div>
  );
}

/**
 * AddressDisplay Component
 *
 * Shows formatted address with copy functionality
 */
interface AddressDisplayProps {
  address: string;
  chainType: BlockchainType;
  showCopy?: boolean;
  className?: string;
}

export function AddressDisplay({
  address,
  chainType,
  showCopy = true,
  className = ''
}: AddressDisplayProps) {
  const [copied, setCopied] = React.useState(false);

  const formattedAddress = WalletUtils.formatAddress(address, chainType);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
        {formattedAddress}
      </span>

      {showCopy && (
        <button
          onClick={handleCopy}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          title="Copy address"
        >
          {copied ? (
            <span className="text-xs text-green-600 dark:text-green-400">✓</span>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
