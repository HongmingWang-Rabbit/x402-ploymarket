import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Solana
  SOLANA_RPC_URL: z.string().default('https://api.devnet.solana.com'),
  SOLANA_NETWORK: z.enum(['devnet', 'mainnet-beta']).default('devnet'),
  PROGRAM_ID: z.string(),
  BACKEND_PRIVATE_KEY: z.string(),

  // x402
  X402_PAYMENT_ADDRESS: z.string(),
  X402_FACILITATOR_URL: z.string().default('https://x402.org/facilitator'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Database (Neon)
  DATABASE_URL: z.string().optional(),

  // RabbitMQ
  RABBITMQ_URL: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-3.5-turbo'),

  // AI Rate Limits
  RATE_LIMIT_PROPOSE_PER_MIN: z.coerce.number().default(5),
  RATE_LIMIT_PROPOSE_PER_HOUR: z.coerce.number().default(20),
  RATE_LIMIT_PROPOSE_PER_DAY: z.coerce.number().default(50),

  // Internal JWT for workers
  INTERNAL_JWT_SECRET: z.string().optional(),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.format());
    throw new Error('Invalid environment variables');
  }

  return result.data;
};

export const env = parseEnv();

export type Env = z.infer<typeof envSchema>;
