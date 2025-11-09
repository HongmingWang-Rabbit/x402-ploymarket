'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useWallet as useSolanaWalletAdapter, useConnection } from '@solana/wallet-adapter-react';
import {
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  SolanaWallet,
  BlockchainType,
  WalletConnectionState,
  WalletConnectionError,
  WalletSignatureError,
  WalletTransactionError,
} from '@/app/utils/wallet';

/**
 * Hook for managing Solana wallet connections and transactions
 */
export function useSolanaWallet(): SolanaWallet {
  const {
    publicKey,
    connected,
    connecting,
    disconnect: solanaDisconnect,
    connect: solanaConnect,
    signMessage: solanaSignMessage,
    signTransaction: solanaSignTransaction,
    sendTransaction: solanaSendTransaction,
    wallet,
    select,
  } = useSolanaWalletAdapter();

  const { connection } = useConnection();

  // Log wallet changes
  useEffect(() => {
    if (wallet) {
      console.log('👛 Wallet selected:', wallet.adapter.name);
    }
  }, [wallet]);

  const [connectionState, setConnectionState] = useState<WalletConnectionState>(
    connected
      ? WalletConnectionState.CONNECTED
      : WalletConnectionState.DISCONNECTED
  );

  // Update connection state based on Solana wallet state
  useEffect(() => {
    if (connecting) {
      console.log('🔄 Solana wallet connecting...');
      setConnectionState(WalletConnectionState.CONNECTING);
    } else if (connected) {
      console.log('✅ Solana wallet connected!', {
        publicKey: publicKey?.toBase58(),
        wallet: wallet?.adapter.name,
      });
      setConnectionState(WalletConnectionState.CONNECTED);
    } else {
      console.log('🔌 Solana wallet disconnected');
      setConnectionState(WalletConnectionState.DISCONNECTED);
    }
  }, [connected, connecting, publicKey, wallet]);

  /**
   * Connect to Solana wallet
   */
  const handleConnect = useCallback(async () => {
    try {
      setConnectionState(WalletConnectionState.CONNECTING);

      if (!wallet) {
        throw new WalletConnectionError('No Solana wallet available. Please install a Solana wallet extension.');
      }

      await solanaConnect();
      setConnectionState(WalletConnectionState.CONNECTED);
    } catch (error) {
      setConnectionState(WalletConnectionState.ERROR);
      throw new WalletConnectionError(
        error instanceof Error ? error.message : 'Failed to connect Solana wallet'
      );
    }
  }, [solanaConnect, wallet]);

  /**
   * Disconnect wallet
   */
  const handleDisconnect = useCallback(async () => {
    try {
      await solanaDisconnect();
      setConnectionState(WalletConnectionState.DISCONNECTED);
    } catch (error) {
      throw new WalletConnectionError(
        error instanceof Error ? error.message : 'Failed to disconnect wallet'
      );
    }
  }, [solanaDisconnect]);

  /**
   * Sign a message
   */
  const handleSignMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    try {
      if (!publicKey || !solanaSignMessage) {
        throw new WalletSignatureError('Wallet not connected or does not support message signing');
      }

      const signature = await solanaSignMessage(message);
      return signature;
    } catch (error) {
      throw new WalletSignatureError(
        error instanceof Error ? error.message : 'Failed to sign message'
      );
    }
  }, [publicKey, solanaSignMessage]);

  /**
   * Sign a transaction
   */
  const handleSignTransaction = useCallback(
    async (transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> => {
      try {
        if (!publicKey || !solanaSignTransaction) {
          throw new WalletSignatureError('Wallet not connected or does not support transaction signing');
        }

        const signedTransaction = await solanaSignTransaction(transaction);
        return signedTransaction;
      } catch (error) {
        throw new WalletSignatureError(
          error instanceof Error ? error.message : 'Failed to sign transaction'
        );
      }
    },
    [publicKey, solanaSignTransaction]
  );

  /**
   * Send a transaction
   */
  const handleSendTransaction = useCallback(
    async (transaction: Transaction | VersionedTransaction): Promise<string> => {
      try {
        if (!publicKey) {
          throw new WalletTransactionError('Wallet not connected');
        }

        if (!connection) {
          throw new WalletTransactionError('No connection to Solana network');
        }

        const signature = await solanaSendTransaction(transaction, connection);

        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');

        return signature;
      } catch (error) {
        throw new WalletTransactionError(
          error instanceof Error ? error.message : 'Failed to send transaction'
        );
      }
    },
    [publicKey, connection, solanaSendTransaction]
  );

  // Create wallet adapter context state
  const walletAdapter = useMemo(() => ({
    publicKey,
    connected,
    connecting,
    disconnecting: false,
    wallet,
    connect: solanaConnect,
    disconnect: solanaDisconnect,
    signMessage: solanaSignMessage,
    signTransaction: solanaSignTransaction,
    signAllTransactions: undefined,
    sendTransaction: solanaSendTransaction,
  }), [
    publicKey,
    connected,
    connecting,
    wallet,
    solanaConnect,
    solanaDisconnect,
    solanaSignMessage,
    solanaSignTransaction,
    solanaSendTransaction,
  ]);

  return {
    chainType: BlockchainType.SOLANA,
    address: publicKey?.toBase58() ?? null,
    publicKey: publicKey ?? null,
    connection: connection ?? null,
    walletAdapter,
    connectionState,
    connect: handleConnect,
    disconnect: handleDisconnect,
    signMessage: handleSignMessage,
    signTransaction: handleSignTransaction,
    sendTransaction: handleSendTransaction,
  };
}
