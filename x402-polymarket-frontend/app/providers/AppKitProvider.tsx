'use client';

import React, { ReactNode } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { WagmiProvider } from 'wagmi';
import { mainnet, base, baseSepolia, sepolia, solana, solanaTestnet, solanaDevnet } from '@reown/appkit/networks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

// 0. Setup queryClient
const queryClient = new QueryClient();

// 1. Get projectId from environment
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'dummy-project-id';

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  console.warn('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set - using dummy project ID');
}

// 2. Create wagmiConfig
const metadata = {
  name: 'X402 Polymarket',
  description: 'Multi-chain payment platform with X402 protocol',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://x402.com',
  icons: ['https://avatars.githubusercontent.com/u/37784886'],
};

const wagmiAdapter = new WagmiAdapter({
  networks: [mainnet, base, baseSepolia, sepolia],
  projectId,
});

// 3. Create modal - always initialize to prevent hook errors
createAppKit({
  adapters: [wagmiAdapter],
  networks: [
    // EVM networks
    mainnet,
    base,
    baseSepolia,
    sepolia,
    // Solana networks
    solanaDevnet,
    solanaTestnet,
    solana,
  ],
  projectId,
  metadata,
  features: {
    analytics: true, // Optional - Enable analytics
  },
});

export function AppKitProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
