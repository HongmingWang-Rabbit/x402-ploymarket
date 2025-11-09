/**
 * WalletCustomizationExample.tsx
 *
 * This file demonstrates how to use the internal wallet system (app/utils/wallet)
 * for advanced customization. Use this as a reference for building custom wallet UIs.
 */

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
  WalletConnectionState,
  LAMPORTS_PER_SOL,
} from '@/app/utils/wallet';
import { useChainId } from 'wagmi';

/**
 * Example 1: Custom Wallet Info Card
 * Shows how to use internal wallet utilities for display
 */
export function CustomWalletInfoCard() {
  const { chainType, address, isConnected, activeWallet } = useWallet();
  const chainId = useChainId();

  if (!isConnected || !address) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400">Wallet not connected</p>
      </div>
    );
  }

  // Use internal utils for address formatting
  const formattedAddress = WalletUtils.formatAddress(address, chainType);
  const fullAddress = address;

  // Get network info using internal constants
  const networkInfo = chainType === BlockchainType.EVM
    ? (() => {
        const networkName = EVMWalletUtils.getNetworkName(chainId || 1);
        const networkConfig = Object.values(EVM_NETWORKS).find(n => n.chainId === chainId);
        return {
          name: networkName || 'Unknown',
          explorer: networkConfig?.blockExplorerUrl,
          currency: networkConfig?.nativeCurrency.symbol || 'ETH',
        };
      })()
    : (() => {
        const network = SOLANA_NETWORKS['devnet'];
        return {
          name: network.name,
          explorer: network.blockExplorerUrl,
          currency: 'SOL',
        };
      })();

  // Generate explorer URL using internal utils
  const explorerUrl = chainType === BlockchainType.EVM
    ? EVMWalletUtils.getAddressUrl(address as any, 'base-sepolia')
    : SolanaWalletUtils.getAddressUrl(address, 'devnet');

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg space-y-4">
      <h3 className="text-lg font-semibold">Wallet Info (Using Internal Utils)</h3>

      {/* Chain Type */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">Chain Type:</span>
        <span className="font-medium">{chainType.toUpperCase()}</span>
      </div>

      {/* Network */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">Network:</span>
        <span className="font-medium">{networkInfo.name}</span>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">Address:</span>
        <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded">
          <code className="text-xs font-mono">{formattedAddress}</code>
          <button
            onClick={() => navigator.clipboard.writeText(fullAddress)}
            className="text-blue-600 hover:text-blue-700 text-xs"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Explorer Link */}
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          View on Explorer →
        </a>
      )}

      {/* Connection State */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
        <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs rounded">
          {activeWallet.connectionState}
        </span>
      </div>
    </div>
  );
}

/**
 * Example 2: Transaction Link Generator
 * Shows how to generate explorer links for transactions
 */
interface TransactionLinkProps {
  txHash: string;
  chainType: BlockchainType;
  network?: string;
}

export function TransactionLink({ txHash, chainType, network = 'base-sepolia' }: TransactionLinkProps) {
  // Use internal utils to generate transaction URL
  const txUrl = chainType === BlockchainType.EVM
    ? EVMWalletUtils.getTransactionUrl(txHash as any, network as any)
    : SolanaWalletUtils.getTransactionUrl(txHash, 'devnet');

  return (
    <a
      href={txUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700"
    >
      <span className="font-mono text-sm">{txHash.slice(0, 8)}...{txHash.slice(-6)}</span>
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

/**
 * Example 3: Solana Amount Formatter
 * Shows how to use Solana utilities for amount conversion
 */
export function SolanaAmountDisplay({ lamports }: { lamports: number }) {
  // Use internal Solana utils for conversion
  const sol = SolanaWalletUtils.lamportsToSol(lamports);
  const formatted = SolanaWalletUtils.formatSol(lamports, 4);

  return (
    <div className="inline-flex items-center space-x-2">
      <span className="font-mono text-lg">{formatted}</span>
      <span className="text-sm text-gray-600 dark:text-gray-400">SOL</span>
      <span className="text-xs text-gray-500">({lamports.toLocaleString()} lamports)</span>
    </div>
  );
}

/**
 * Example 4: Network Switcher Dropdown
 * Shows how to use internal network configs for custom UI
 */
export function NetworkSwitcherDropdown() {
  const { chainType } = useWallet();
  const [isOpen, setIsOpen] = React.useState(false);

  // Get available networks from internal constants
  const availableNetworks = chainType === BlockchainType.EVM
    ? Object.entries(EVM_NETWORKS).map(([key, config]) => ({
        key,
        name: config.name,
        chainId: config.chainId,
        icon: '🔷',
      }))
    : Object.entries(SOLANA_NETWORKS).map(([key, config]) => ({
        key,
        name: config.name,
        cluster: config.cluster,
        icon: '🟣',
      }));

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        Select Network
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-2 space-y-1">
            {availableNetworks.map((network) => (
              <button
                key={network.key}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center space-x-2"
                onClick={() => {
                  console.log('Switch to:', network.name);
                  setIsOpen(false);
                }}
              >
                <span>{network.icon}</span>
                <span className="text-sm">{network.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example 5: Address Validator Component
 * Shows how to use validation utilities
 */
export function AddressValidator() {
  const [address, setAddress] = React.useState('');
  const [chainType, setChainType] = React.useState<BlockchainType>(BlockchainType.EVM);

  // Use internal validation utilities
  const isValid = WalletUtils.isValidAddress(address, chainType);
  const detectedChain = WalletUtils.detectBlockchainType(address);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl space-y-4">
      <h3 className="text-lg font-semibold">Address Validator (Internal Utils)</h3>

      {/* Chain Type Selector */}
      <div className="flex space-x-2">
        <button
          onClick={() => setChainType(BlockchainType.EVM)}
          className={`px-4 py-2 rounded ${chainType === BlockchainType.EVM ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          EVM
        </button>
        <button
          onClick={() => setChainType(BlockchainType.SOLANA)}
          className={`px-4 py-2 rounded ${chainType === BlockchainType.SOLANA ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}
        >
          Solana
        </button>
      </div>

      {/* Address Input */}
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder={`Enter ${chainType === BlockchainType.EVM ? 'EVM' : 'Solana'} address`}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-900"
      />

      {/* Validation Result */}
      {address && (
        <div className="space-y-2">
          <div className={`p-3 rounded ${isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {isValid ? '✅ Valid address' : '❌ Invalid address'}
          </div>

          {detectedChain && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Auto-detected: <strong>{detectedChain.toUpperCase()}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
