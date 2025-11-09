'use client';

import React, { useMemo } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, baseSepolia, mainnet, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { walletConnect } from 'wagmi/connectors';

// Solana imports
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  LedgerWalletAdapter,
  TrustWalletAdapter,
  CoinbaseWalletAdapter,
  Coin98WalletAdapter,
  NightlyWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import Solana wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

/**
 * EVM Wallet Provider Props
 */
interface EVMWalletProviderProps {
  children: React.ReactNode;
  projectId?: string;
}

/**
 * EVM Wallet Provider
 * Provides wagmi configuration for EVM wallet connections
 */
export function EVMWalletProvider({ children, projectId }: EVMWalletProviderProps) {
  const queryClient = useMemo(() => new QueryClient(), []);

  const config = useMemo(() => {
    // Don't initialize connectors that require window during SSR
    if (typeof window === 'undefined') {
      return createConfig({
        chains: [mainnet, base, baseSepolia, sepolia],
        connectors: [],
        transports: {
          [mainnet.id]: http(),
          [base.id]: http(),
          [baseSepolia.id]: http(),
          [sepolia.id]: http(),
        },
        ssr: true,
      });
    }

    // Only use WalletConnect connector for universal wallet support
    const connectorsList = [];

    if (projectId) {
      connectorsList.push(
        walletConnect({
          projectId,
          showQrModal: true,
          metadata: {
            name: 'X402 Polymarket',
            description: 'Multi-chain payment platform with X402 protocol',
            url: typeof window !== 'undefined' ? window.location.origin : 'https://x402.com',
            icons: ['https://avatars.githubusercontent.com/u/37784886'],
          },
        })
      );
    } else {
      console.warn('WalletConnect Project ID is not set. Please add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to your .env.local file.');
    }

    return createConfig({
      chains: [mainnet, base, baseSepolia, sepolia],
      connectors: connectorsList,
      transports: {
        [mainnet.id]: http(),
        [base.id]: http(),
        [baseSepolia.id]: http(),
        [sepolia.id]: http(),
      },
    });
  }, [projectId]);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/**
 * Solana Wallet Provider Props
 */
interface SolanaWalletProviderProps {
  children: React.ReactNode;
  network?: WalletAdapterNetwork;
  endpoint?: string;
  autoConnect?: boolean;
}

/**
 * Solana Wallet Provider
 * Provides Solana wallet adapter configuration
 */
export function SolanaWalletProviderComponent({
  children,
  network = WalletAdapterNetwork.Devnet,
  endpoint,
  autoConnect = false,
}: SolanaWalletProviderProps) {
  // Use custom endpoint or default cluster URL
  const solanaEndpoint = useMemo(
    () => endpoint || clusterApiUrl(network),
    [endpoint, network]
  );

  // Initialize wallets - only on client side
  const wallets = useMemo(
    () => {
      // Return empty array during SSR
      if (typeof window === 'undefined') {
        return [];
      }

      // Initialize all wallet adapters with proper network configuration
      const walletAdapters = [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(), // Try without network param
        new CoinbaseWalletAdapter(),
        new Coin98WalletAdapter(),
        new NightlyWalletAdapter(),
        new TrustWalletAdapter(),
        new TorusWalletAdapter(),
        new LedgerWalletAdapter(),
      ];

      // Log detected wallets for debugging
      console.log('Initializing Solana wallet adapters:', walletAdapters.length);

      // Check wallet adapter readiness
      setTimeout(() => {
        console.log('📋 All wallet adapters:', walletAdapters.map(w => ({
          name: w.name,
          readyState: w.readyState,
          url: w.url,
        })));

        const solflare = walletAdapters.find(w => w.name === 'Solflare');
        if (solflare) {
          console.log('Solflare adapter:', {
            name: solflare.name,
            ready: solflare.readyState,
            url: solflare.url,
          });
        }

        // Check if window.solflare exists
        if (typeof window !== 'undefined' && (window as any).solflare) {
          console.log('Solflare extension detected in window object');
        } else {
          console.warn('Solflare extension NOT found in window object');
        }
      }, 1000);

      return walletAdapters;
    },
    [network]
  );

  // Error handler for wallet connection issues
  const onError = (error: Error) => {
    console.error('❌ Solana wallet error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  };

  return (
    <ConnectionProvider endpoint={solanaEndpoint}>
      <WalletProvider wallets={wallets} autoConnect={autoConnect} onError={onError}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

/**
 * Multi-Chain Wallet Provider Props
 */
interface MultiChainWalletProviderProps {
  children: React.ReactNode;
  walletConnectProjectId?: string;
  solanaNetwork?: WalletAdapterNetwork;
  solanaEndpoint?: string;
  solanaAutoConnect?: boolean;
}

/**
 * Multi-Chain Wallet Provider
 * Combines both EVM and Solana wallet providers
 *
 * @example
 * ```tsx
 * // In your root layout or app component
 * <MultiChainWalletProvider
 *   walletConnectProjectId="your-project-id"
 *   solanaNetwork={WalletAdapterNetwork.Mainnet}
 * >
 *   <YourApp />
 * </MultiChainWalletProvider>
 * ```
 */
export function MultiChainWalletProvider({
  children,
  walletConnectProjectId,
  solanaNetwork = WalletAdapterNetwork.Devnet,
  solanaEndpoint,
  solanaAutoConnect = false,
}: MultiChainWalletProviderProps) {
  return (
    <EVMWalletProvider projectId={walletConnectProjectId}>
      <SolanaWalletProviderComponent
        network={solanaNetwork}
        endpoint={solanaEndpoint}
        autoConnect={solanaAutoConnect}
      >
        {children}
      </SolanaWalletProviderComponent>
    </EVMWalletProvider>
  );
}
