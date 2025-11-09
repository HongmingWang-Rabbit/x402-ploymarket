'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWalletClient,
  usePublicClient,
  useSwitchChain,
  useSignMessage as useWagmiSignMessage,
  useSendTransaction as useWagmiSendTransaction,
} from 'wagmi';
import {
  Address,
  Hash,
  TransactionRequest,
} from 'viem';
import {
  EVMWallet,
  BlockchainType,
  WalletConnectionState,
  WalletConnectionError,
  WalletSignatureError,
  WalletTransactionError,
} from '@/app/utils/wallet';

/**
 * Hook for managing EVM wallet connections and transactions
 */
export function useEVMWallet(): EVMWallet {
  const { address, chainId, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const { signMessageAsync } = useWagmiSignMessage();
  const { sendTransactionAsync } = useWagmiSendTransaction();

  const [connectionState, setConnectionState] = useState<WalletConnectionState>(
    isConnected
      ? WalletConnectionState.CONNECTED
      : WalletConnectionState.DISCONNECTED
  );

  // Update connection state based on wagmi state
  useEffect(() => {
    if (isConnecting) {
      setConnectionState(WalletConnectionState.CONNECTING);
    } else if (isConnected) {
      setConnectionState(WalletConnectionState.CONNECTED);
    } else {
      setConnectionState(WalletConnectionState.DISCONNECTED);
    }
  }, [isConnected, isConnecting]);

  /**
   * Connect to wallet using WalletConnect
   * WalletConnect modal will show 400+ wallet options
   */
  const handleConnect = useCallback(async () => {
    try {
      setConnectionState(WalletConnectionState.CONNECTING);

      // Use WalletConnect connector (should be the only one)
      const connector = connectors[0];

      if (!connector) {
        throw new WalletConnectionError('WalletConnect not configured. Please add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to .env.local');
      }

      await connect({ connector });
      setConnectionState(WalletConnectionState.CONNECTED);
    } catch (error) {
      setConnectionState(WalletConnectionState.ERROR);
      throw new WalletConnectionError(
        error instanceof Error ? error.message : 'Failed to connect wallet'
      );
    }
  }, [connect, connectors]);

  /**
   * Disconnect wallet
   */
  const handleDisconnect = useCallback(async () => {
    try {
      await wagmiDisconnect();
      setConnectionState(WalletConnectionState.DISCONNECTED);
    } catch (error) {
      throw new WalletConnectionError(
        error instanceof Error ? error.message : 'Failed to disconnect wallet'
      );
    }
  }, [wagmiDisconnect]);

  /**
   * Switch to a different chain
   */
  const handleSwitchChain = useCallback(async (targetChainId: number) => {
    try {
      if (!switchChain) {
        throw new WalletConnectionError('Chain switching not supported');
      }
      await switchChain({ chainId: targetChainId });
    } catch (error) {
      throw new WalletConnectionError(
        error instanceof Error ? error.message : 'Failed to switch chain'
      );
    }
  }, [switchChain]);

  /**
   * Sign a message
   */
  const handleSignMessage = useCallback(async (message: string): Promise<Hash> => {
    try {
      if (!address) {
        throw new WalletSignatureError('Wallet not connected');
      }

      const signature = await signMessageAsync({ message });
      return signature;
    } catch (error) {
      throw new WalletSignatureError(
        error instanceof Error ? error.message : 'Failed to sign message'
      );
    }
  }, [address, signMessageAsync]);

  /**
   * Send a transaction
   */
  const handleSendTransaction = useCallback(async (tx: TransactionRequest): Promise<Hash> => {
    try {
      if (!address) {
        throw new WalletTransactionError('Wallet not connected');
      }

      const hash = await sendTransactionAsync({
        to: tx.to as Address,
        value: tx.value,
        data: tx.data,
        gas: tx.gas,
        gasPrice: tx.gasPrice,
      });

      return hash;
    } catch (error) {
      throw new WalletTransactionError(
        error instanceof Error ? error.message : 'Failed to send transaction'
      );
    }
  }, [address, sendTransactionAsync]);

  return {
    chainType: BlockchainType.EVM,
    address: address ?? null,
    chainId: chainId ?? null,
    walletClient: walletClient ?? null,
    publicClient: publicClient ?? null,
    connectionState,
    connect: handleConnect,
    disconnect: handleDisconnect,
    switchChain: handleSwitchChain,
    signMessage: handleSignMessage,
    sendTransaction: handleSendTransaction,
  };
}
