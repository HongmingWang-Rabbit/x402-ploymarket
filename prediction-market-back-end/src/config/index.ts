import { env } from './env.js';

export const config = {
  port: parseInt(env.PORT, 10),
  nodeEnv: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',

  solana: {
    rpcUrl: env.SOLANA_RPC_URL,
    network: env.SOLANA_NETWORK,
    programId: env.PROGRAM_ID,
    backendPrivateKey: env.BACKEND_PRIVATE_KEY,
  },

  x402: {
    paymentAddress: env.X402_PAYMENT_ADDRESS,
    facilitatorUrl: env.X402_FACILITATOR_URL,
  },

  cors: {
    origin: env.CORS_ORIGIN,
  },
} as const;

export { env };
