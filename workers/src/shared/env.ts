import dotenv from 'dotenv';

dotenv.config();

export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',

  // RabbitMQ
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',

  // Solana
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  PROGRAM_ID: process.env.PROGRAM_ID || '',
  PUBLISHER_PRIVATE_KEY: process.env.PUBLISHER_PRIVATE_KEY || '',

  // API
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001',
  WORKER_API_KEY: process.env.WORKER_API_KEY || '',

  // Worker config
  WORKER_TYPE: process.env.WORKER_TYPE || 'unknown',

  // Feature flags
  DRY_RUN: process.env.DRY_RUN === 'true',
} as const;

export function validateEnv(requiredKeys: (keyof typeof env)[]): void {
  const missing = requiredKeys.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
