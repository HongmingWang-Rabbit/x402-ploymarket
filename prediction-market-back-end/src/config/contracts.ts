// Contract addresses per chain
// Update these when deploying to new chains/networks

export interface ChainContract {
  chainId: string;
  chainName: string;
  network: string;
  programId: string; // Contract/program address
  rpcUrl: string;
  explorerUrl: string;
  // Token addresses
  usdcMint?: string;
  // Status
  enabled: boolean;
}

export const CHAIN_CONTRACTS: ChainContract[] = [
  // Solana
  {
    chainId: 'solana-devnet',
    chainName: 'Solana',
    network: 'devnet',
    programId: 'CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM',
    rpcUrl: 'https://api.devnet.solana.com',
    explorerUrl: 'https://explorer.solana.com',
    usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    enabled: true,
  },
  {
    chainId: 'solana-mainnet',
    chainName: 'Solana',
    network: 'mainnet-beta',
    programId: '', // TODO: Deploy to mainnet
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://explorer.solana.com',
    usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    enabled: false,
  },

  // EVM Chains (placeholder)
  {
    chainId: 'ethereum-sepolia',
    chainName: 'Ethereum',
    network: 'sepolia',
    programId: '', // TODO: Deploy contract
    rpcUrl: 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
    usdcMint: '', // USDC on Sepolia
    enabled: false,
  },
  {
    chainId: 'base-sepolia',
    chainName: 'Base',
    network: 'sepolia',
    programId: '', // TODO: Deploy contract
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    usdcMint: '',
    enabled: false,
  },

  // Cardano (placeholder)
  {
    chainId: 'cardano-preprod',
    chainName: 'Cardano',
    network: 'preprod',
    programId: '', // TODO: Deploy contract
    rpcUrl: '',
    explorerUrl: 'https://preprod.cardanoscan.io',
    enabled: false,
  },
];

// Get all enabled chains
export function getEnabledChains(): ChainContract[] {
  return CHAIN_CONTRACTS.filter((c) => c.enabled);
}

// Get contract by chain ID
export function getContractByChainId(chainId: string): ChainContract | undefined {
  return CHAIN_CONTRACTS.find((c) => c.chainId === chainId);
}
