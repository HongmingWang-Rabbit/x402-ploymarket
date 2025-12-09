import { env } from './env';

export const x402Config = {
  facilitatorUrl: env.x402FacilitatorUrl,
  paymentAddress: env.x402PaymentAddress,
  network: env.chainId,

  // Default prices for different operations (in USDC)
  prices: {
    marketCreation: 1.0,
    swap: 0.01,
    mint: 0.01,
    redeem: 0.01,
  } as const,
} as const;

export type X402Config = typeof x402Config;
