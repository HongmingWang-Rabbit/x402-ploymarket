/**
 * X402 Payment Integration Configuration
 *
 * x402 supports multi-chain payments including Solana
 * - paymentAddress: Your wallet address where you receive USDC payments
 * - network: The blockchain network for payments (solana, base, ethereum, etc.)
 * - For Solana markets: Use Solana address and 'solana' network
 * - For cross-chain: Can use Base/Ethereum for payments and deliver on Solana
 */
export const X402_CONFIG = {
  // Payment receiving address - Can be Solana or EVM format
  // For Solana: Use your Solana address (base58 format)
  // For Base/Ethereum: Use your EVM address (0x... format)
  // TODO: Update this with your actual payment receiving address
  paymentAddress: "Ar1Tqs2H89xmjuCxA4CuXePif9FNBazQtPhTTjEPkpcB" as any,

  // x402 facilitator URL for payment verification
  facilitatorUrl: "https://x402.org/facilitator" as `${string}://${string}`,

  // Network configuration - supports multi-chain
  // Options: 'solana', 'solana-devnet', 'base', 'base-sepolia', 'ethereum', etc.
  network: process.env.NODE_ENV === "production" ? "solana" : "solana-devnet",

  // Base price for buy-token endpoint
  basePrice: "$0.01",

  // Payment configuration
  config: {
    description: "Buy prediction market tokens with x402",
    mimeType: "application/json",
    maxTimeoutSeconds: 120,
  },
} as const;
