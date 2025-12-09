// Environment variables with type safety
// All NEXT_PUBLIC_ variables are available on client

// Chain ID format: '{chain}-{network}' e.g., 'solana-devnet', 'ethereum-sepolia'
export type ChainId = 'solana-devnet' | 'solana-mainnet' | 'ethereum-sepolia' | 'base-sepolia' | 'cardano-preprod';
export type ChainType = 'solana' | 'ethereum' | 'base' | 'cardano';

// Parse chain and network from chainId
const parseChainId = (chainId: string): { chain: ChainType; network: string } => {
  const [chain, network] = chainId.split('-');
  return { chain: chain as ChainType, network };
};

const chainId = (process.env.NEXT_PUBLIC_CHAIN_ID || 'solana-devnet') as ChainId;
const { chain, network } = parseChainId(chainId);

export const env = {
  // API
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',

  // Chain selection
  chainId,
  chain,
  network,

  // Fallback Solana config (used if backend is unavailable)
  solanaRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  programId: process.env.NEXT_PUBLIC_PROGRAM_ID || '',

  // x402
  x402FacilitatorUrl: process.env.NEXT_PUBLIC_X402_FACILITATOR_URL || 'https://x402.org/facilitator',
  x402PaymentAddress: process.env.NEXT_PUBLIC_X402_PAYMENT_ADDRESS || '',

  // Feature flags
  isDev: process.env.NEXT_PUBLIC_DEV === 'true',
  isProd: process.env.NODE_ENV === 'production',
} as const;

export type Env = typeof env;
