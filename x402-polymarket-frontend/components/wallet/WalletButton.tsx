'use client';

import React, { useState } from 'react';
import { useWallet } from '@/app/hooks/wallet';
import { BlockchainType, WalletUtils } from '@/app/utils/wallet';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { WalletModal } from './WalletModal';

/**
 * Wallet Button Props
 */
interface WalletButtonProps {
  className?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * Wallet connection button component
 * When connected: Shows compact view (chain + address) and opens modal on click
 * When not connected: Shows connection buttons for selected chain
 */
export function WalletButton({
  className = '',
  onConnect,
  onDisconnect,
}: WalletButtonProps) {
  const { chainType, isConnected, address } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // If connected, show compact button that opens modal
  if (isConnected && address) {
    const formattedAddress = WalletUtils.formatAddress(address, chainType);
    const chainIcon = chainType === BlockchainType.EVM ? '🔷' : '🟣';
    const chainLabel = chainType === BlockchainType.EVM ? 'EVM' : 'SOL';
    const colorClass = chainType === BlockchainType.EVM
      ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
      : 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300';

    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className={`
            flex items-center space-x-2 px-3 py-2 rounded-lg border font-medium transition-all
            ${colorClass}
            ${className}
          `}
        >
          {/* Chain Icon & Label */}
          <span className="text-sm">{chainIcon}</span>
          <span className="text-sm font-semibold">{chainLabel}</span>

          {/* Separator */}
          <div className="h-4 w-px bg-current opacity-30" />

          {/* Address */}
          <span className="text-sm font-mono">{formattedAddress}</span>

          {/* Status Indicator */}
          <div className="h-2 w-2 rounded-full bg-green-500" />
        </button>

        {/* Wallet Details Modal */}
        <WalletModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  // If not connected, show original connection buttons based on chain type
  console.log('🔌 WalletButton rendering for chain:', chainType);

  // For EVM, use Reown AppKit's w3m-button
  if (chainType === BlockchainType.EVM) {
    console.log('📱 Rendering Reown AppKit button (EVM)');
    return (
      <div className={className}>
        <w3m-button />
      </div>
    );
  }

  console.log('📱 Rendering Solana WalletMultiButton');

  // For Solana, use the official WalletMultiButton from Solana Wallet Adapter
  return (
    <div className={className}>
      <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !text-white !transition-all" />
    </div>
  );
}

/**
 * Chain Switcher Props
 */
interface ChainSwitcherProps {
  className?: string;
  onChange?: (chainType: BlockchainType) => void;
}

/**
 * Chain type switcher component
 * Allows users to switch between EVM and Solana
 */
export function ChainSwitcher({ className = '', onChange }: ChainSwitcherProps) {
  const { chainType, switchChainType } = useWallet();

  const handleSwitch = (newChainType: BlockchainType) => {
    switchChainType(newChainType);
    onChange?.(newChainType);
  };

  return (
    <div className={`inline-flex rounded-lg border border-gray-300 dark:border-gray-700 ${className}`}>
      <button
        onClick={() => handleSwitch(BlockchainType.EVM)}
        className={`px-4 py-2.5 font-semibold transition-colors text-sm ${
          chainType === BlockchainType.EVM
            ? 'bg-blue-600 text-white'
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        } rounded-l-lg`}
        type="button"
      >
        EVM
      </button>
      <button
        onClick={() => handleSwitch(BlockchainType.SOLANA)}
        className={`px-4 py-2.5 font-semibold transition-colors text-sm ${
          chainType === BlockchainType.SOLANA
            ? 'bg-purple-600 text-white'
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        } rounded-r-lg`}
        type="button"
      >
        Solana
      </button>
    </div>
  );
}

/**
 * Wallet Info Props
 */
interface WalletInfoProps {
  className?: string;
  showBalance?: boolean;
}

/**
 * Wallet information display component
 */
export function WalletInfo({ className = '' }: WalletInfoProps) {
  const { activeWallet, isConnected, address, chainType } = useWallet();

  if (!isConnected || !address) {
    return null;
  }

  const displayAddress = WalletUtils.formatAddress(address, chainType);

  return (
    <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg p-4 ${className}`}>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Chain:</span>
          <span className="font-medium">
            {chainType === BlockchainType.EVM ? 'EVM' : 'Solana'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Address:</span>
          <span className="font-mono text-sm">{displayAddress}</span>
        </div>
        {chainType === BlockchainType.EVM && 'chainId' in activeWallet && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Chain ID:</span>
            <span className="font-medium">{activeWallet.chainId}</span>
          </div>
        )}
      </div>
    </div>
  );
}
