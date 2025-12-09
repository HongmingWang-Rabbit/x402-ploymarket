export { env } from './env';
export { contractConfig } from './contracts';
export { x402Config } from './x402';
export type { ChainId, ChainType } from './env';

// Re-export for convenience
import { env } from './env';

export const config = {
  api: {
    baseUrl: env.apiUrl,
  },
  chain: {
    id: env.chainId,
    type: env.chain,
    network: env.network,
  },
} as const;
