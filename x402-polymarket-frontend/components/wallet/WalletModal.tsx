'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from '@/app/hooks/wallet';
import {
  BlockchainType,
  WalletUtils,
  EVMWalletUtils,
  SolanaWalletUtils,
  EVM_NETWORKS,
  SOLANA_NETWORKS,
} from '@/app/utils/wallet';
import { useAccount, useChainId, useDisconnect } from 'wagmi';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWallet as useSolanaAdapter } from '@solana/wallet-adapter-react';
import { useAppKit } from '@reown/appkit/react';
import { AddressDisplay, NetworkBadge } from './WalletStatus';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { chainType, isConnected, address, evmWallet, solanaWallet, switchChainType } = useWallet();
  const chainId = useChainId();
  const { chain } = useAccount();
  const { disconnect: disconnectEVM } = useDisconnect();
  const solanaWalletModal = useWalletModal();
  const { wallets, select: selectSolanaWallet, connect: connectSolana } = useSolanaAdapter();
  const { open: openAppKit } = useAppKit();
  const [mounted, setMounted] = React.useState(false);

  // Only render on client-side
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleDisconnect = async () => {
    try {
      if (chainType === BlockchainType.EVM) {
        disconnectEVM();
      } else {
        await solanaWallet.disconnect();
      }
      onClose();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleSwitchChain = async (newChainType: BlockchainType) => {
    // Switch the chain type
    switchChainType(newChainType);

    // Check if the new chain is already connected
    const isNewChainConnected = newChainType === BlockchainType.EVM
      ? evmWallet.connectionState === 'connected'
      : solanaWallet.connectionState === 'connected';

    // If not connected, close modal and open wallet connection
    if (!isNewChainConnected) {
      // Close the current modal first
      onClose();

      // Small delay to ensure modal is closed before proceeding
      setTimeout(async () => {
        if (newChainType === BlockchainType.SOLANA) {
          // Get available Solana wallets
          const readyWallets = wallets.filter(w => w.readyState === 'Installed' || w.readyState === 'Loadable');

          // If only one wallet is available, auto-select and connect
          if (readyWallets.length === 1) {
            try {
              console.log('🎯 Auto-selecting wallet:', readyWallets[0].adapter.name);
              selectSolanaWallet(readyWallets[0].adapter.name);
              // Wait a bit for selection to complete
              setTimeout(() => {
                connectSolana().catch(err => {
                  console.error('Failed to auto-connect:', err);
                  // If auto-connect fails, show the modal
                  solanaWalletModal.setVisible(true);
                });
              }, 100);
            } catch (error) {
              console.error('Failed to auto-select wallet:', error);
              solanaWalletModal.setVisible(true);
            }
          } else {
            // Multiple wallets available, show selection modal
            solanaWalletModal.setVisible(true);
          }
        } else {
          // Open Reown AppKit modal for EVM
          openAppKit();
        }
      }, 100);
    }
  };

  // Get network info
  const getNetworkInfo = () => {
    if (chainType === BlockchainType.EVM) {
      const networkName = chain?.name || EVMWalletUtils.getNetworkName(chainId || 1) || 'Unknown';
      const networkConfig = Object.values(EVM_NETWORKS).find(n => n.chainId === chainId);
      return {
        name: networkName,
        currency: networkConfig?.nativeCurrency.symbol || 'ETH',
        explorer: networkConfig?.blockExplorerUrl,
      };
    } else {
      const network = SOLANA_NETWORKS['devnet'];
      return {
        name: network.name,
        currency: 'SOL',
        explorer: network.blockExplorerUrl,
      };
    }
  };

  const networkInfo = getNetworkInfo();

  // Get explorer URL for address
  const explorerUrl = address
    ? chainType === BlockchainType.EVM
      ? EVMWalletUtils.getAddressUrl(address as any, 'base-sepolia')
      : SolanaWalletUtils.getAddressUrl(address, 'devnet')
    : null;

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal Container - Centered using absolute positioning */}
      <div
        className="fixed z-50 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          margin: '0 1rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Wallet Details
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Chain Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Active Chain
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => handleSwitchChain(BlockchainType.EVM)}
                className={`
                  flex-1 px-4 py-2.5 rounded-lg font-medium transition-all
                  ${chainType === BlockchainType.EVM
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }
                `}
              >
                <div className="flex items-center justify-center space-x-2">
                  <span>🔷</span>
                  <span>EVM</span>
                  {chainType === BlockchainType.EVM && (
                    <span className="text-xs">✓</span>
                  )}
                </div>
              </button>
              <button
                onClick={() => handleSwitchChain(BlockchainType.SOLANA)}
                className={`
                  flex-1 px-4 py-2.5 rounded-lg font-medium transition-all
                  ${chainType === BlockchainType.SOLANA
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }
                `}
              >
                <div className="flex items-center justify-center space-x-2">
                  <span>🟣</span>
                  <span>Solana</span>
                  {chainType === BlockchainType.SOLANA && (
                    <span className="text-xs">✓</span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Network Info */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Network</span>
              <NetworkBadge />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Currency</span>
              <span className="font-medium text-gray-900 dark:text-white">{networkInfo.currency}</span>
            </div>
          </div>

          {/* Address */}
          {isConnected && address && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Address
              </label>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <AddressDisplay
                  address={address}
                  chainType={chainType}
                  showCopy={true}
                />
              </div>
            </div>
          )}

          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-green-600 dark:text-green-400">Connected</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            {/* View on Explorer */}
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-2 w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium text-gray-700 dark:text-gray-300 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>View on Explorer</span>
              </a>
            )}

            {/* Disconnect */}
            <button
              onClick={handleDisconnect}
              className="w-full px-4 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg font-medium transition-colors"
            >
              Disconnect Wallet
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            {chainType === BlockchainType.EVM
              ? 'Powered by Reown AppKit'
              : 'Powered by Solana Wallet Adapter'
            }
          </p>
        </div>
      </div>
    </>
  );

  // Render modal using portal to ensure it's positioned relative to viewport
  return createPortal(modalContent, document.body);
}
