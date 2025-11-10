# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **decentralized prediction market platform** combining:
- **Solana smart contracts** (inspired by Polymarket) using USDC as collateral
- **Next.js frontend** with X402 payment protocol integration for paywalled content
- Support for both **EVM (Base Sepolia)** and **Solana (Devnet)** blockchain payments

## Project Structure

```
├── contract/                         # Solana prediction market smart contract
│   ├── programs/prediction-market/   # Anchor program source
│   │   └── src/
│   │       ├── instructions/         # Market operations (swap, mint, redeem, etc.)
│   │       ├── state/                # State structures (Config, Market)
│   │       ├── math/                 # LMSR pricing algorithm, fixed-point math
│   │       └── lib.rs                # Program entry point
│   ├── cli/                          # CLI tools for contract interaction
│   ├── src/                          # Frontend components for contract testing
│   ├── Anchor.toml                   # Anchor configuration
│   └── package.json                  # Contract dev dependencies
│
└── x402-polymarket-frontend/         # Next.js 16 frontend
    ├── app/
    │   ├── paywall/                  # Multi-chain payment page
    │   ├── providers/                # Wallet context providers
    │   ├── hooks/                    # Wallet hooks (EVM, Solana, unified)
    │   └── utils/                    # Wallet & payment utilities
    ├── components/                   # UI components
    ├── middleware.ts                 # X402 payment verification middleware
    └── package.json                  # Frontend dependencies
```

## Development Commands

### Contract (Solana Anchor)

Navigate to `contract/` directory first:

```bash
# Build the Anchor program
anchor build

# Run tests (requires local validator or configured network)
anchor test

# Deploy to localnet (ensure solana-test-validator is running)
anchor deploy

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Upgrade existing program
anchor upgrade target/deploy/prediction_market.so --program-id <PROGRAM_ID>

# Run specific test
anchor test --skip-build tests/<test-file>.ts

# CLI operations (see cli/command.ts for available commands)
npm run script -- <command>

# Lint contracts
npm run lint
npm run lint:fix
```

**Important**: The contract uses **Anchor 0.32.1**. Program ID: `EgEc7fuse6eQ3UwqeWGFncDtbTwozWCy4piydbeRaNrU` (devnet).

### Frontend (Next.js)

Navigate to `x402-polymarket-frontend/` directory first:

```bash
# Install dependencies
pnpm install

# Run development server (http://localhost:3000)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

## Key Architectural Concepts

### Solana Contract Architecture

**Core Principle**: 1:1 collateral backing with USDC
- **Precision Binding**: YES/NO tokens have same decimal precision as collateral (6 decimals for USDC)
- **1 USDC = 1 YES + 1 NO** token set (Polymarket's core mechanic)
- **LMSR Pricing**: Logarithmic Market Scoring Rule for automated market making
- **Fee Structure**: Configurable swap fees (collected in USDC) and LP fees

**Key Instructions**:
- `configure`: Initialize global config (admin-only)
- `create_market`: Create new prediction market
- `mint_complete_set`: Mint YES+NO tokens by depositing USDC
- `redeem_complete_set`: Burn YES+NO tokens to recover USDC
- `swap`: Buy/sell tokens via LMSR AMM (uses USDC transfers, not SOL)
- `seed_pool`: Add initial liquidity to market
- `add_liquidity` / `withdraw_liquidity`: LP operations
- `resolution`: Resolve market outcome (YES/NO/INVALID)
- `claim_rewards`: Claim winnings after resolution

**State Accounts**:
- `Config`: Global configuration (admin, fees, USDC vault)
- `Market`: Individual market state (reserves, LMSR params, status)
- `Whitelist`: Creator whitelist for market creation

**Important Notes**:
- All amounts are in **USDC** (6 decimals), not SOL
- Swap fees go to `team_usdc_ata`, LP fees stay in pool
- Circuit breaker prevents excessive price movements
- Emergency pause functionality for admin intervention

### Frontend Architecture

**Multi-Chain Payment System**:
- **X402 Protocol**: EVM payment verification (Base Sepolia testnet)
- **Solana Direct Transfer**: Native SOL payments
- **Modular Wallet Layer**: Unified interface for EVM (wagmi) and Solana (wallet-adapter)

**Key Components**:

1. **Payment Middleware** (`middleware.ts`):
   - Checks for `payment-session` cookie
   - Redirects to `/paywall` if no valid session
   - Integrates x402-next for EVM payment verification

2. **Paywall System** (`app/paywall/page.tsx`):
   - **ChainSwitcher**: Toggle between EVM/Solana
   - **WalletButton**: Connect wallet UI
   - **EVMPaymentForm**: x402 protocol payment (EIP-712 signatures)
   - **SolanaPaymentForm**: Direct SOL transfer

3. **Wallet Hooks** (`app/hooks/wallet/`):
   - `useEVMWallet`: wagmi wrapper for EVM chains
   - `useSolanaWallet`: Solana wallet-adapter wrapper
   - `useWallet`: Unified interface abstracting chain differences

4. **Payment Layer** (`app/utils/payment/`):
   - `PaymentManager`: Orchestrates multiple payment providers
   - `WalletPaymentProvider`: Crypto wallet payments
   - Ready for extension (Stripe, etc.)

**Environment Configuration**:

Required `.env` variables (see `.env.example` in frontend):
```env
# X402 (EVM)
NEXT_PUBLIC_RECEIVER_ADDRESS=<recipient-wallet>
NEXT_PUBLIC_NETWORK=base-sepolia
NEXT_PUBLIC_FACILITATOR_URL=https://facilitator.x402.com
NEXT_PUBLIC_CDP_CLIENT_KEY=<coinbase-key>

# Solana
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
```

## Testing & Deployment

### Contract Testing

- Anchor tests are in TypeScript (no dedicated `tests/` dir, check root for test files)
- Test accounts use `keys/admin.json` wallet
- Run `solana-test-validator` before local testing
- See `DEPLOY_GUIDE.md` for deployment checklist

### Frontend Testing

- Test EVM payments on Base Sepolia (get test USDC from Circle faucet)
- Test Solana payments on Devnet (get SOL from Solana faucet)
- Payment verification happens server-side in `app/actions.ts`

## Important Warnings

1. **Contract Precision**: Never change token decimals independently from collateral decimals - this breaks 1:1 backing
2. **Whitelist Seeds**: Contract uses `"wl-seed"` for whitelist PDA - changing this invalidates all existing accounts
3. **Swap Logic**: Uses USDC token transfers (not SOL system transfers) - see `market.rs::swap` lines 353-626
4. **Frontend Middleware**: Matcher excludes `_next/static`, `_next/image`, `favicon.ico` to avoid payment checks on assets
5. **Production Deployment**: Frontend uses testnet networks by default - switch to mainnet for production

## Common Development Tasks

### Adding a new prediction market (contract):
1. Ensure creator is whitelisted (or whitelist disabled in config)
2. Call `create_market` with market parameters
3. Call `seed_pool` to add initial liquidity
4. Users can now call `swap` to trade or `mint_complete_set` to participate

### Adding a new protected route (frontend):
1. Add route config in `middleware.ts` payment routes
2. Create corresponding page in `app/`
3. Middleware automatically enforces payment for that route

### Extending to new payment provider (frontend):
1. Create new provider class implementing `PaymentProvider` interface in `app/utils/payment/providers/`
2. Add provider type to `PaymentProviderType` enum
3. Register in `PaymentManager` configuration
4. Update paywall UI to include new payment option

## Key Dependencies

**Contract**:
- `@coral-xyz/anchor: 0.32.1` - Solana framework
- `@solana/web3.js: ^1.98.0` - Solana SDK
- `@solana/spl-token: ^0.4.8` - Token program interaction

**Frontend**:
- `next: 16.0.0` - React framework
- `x402-next: ^0.7.1` - X402 payment middleware
- `wagmi: ^2.19.2` - EVM wallet connection
- `@solana/wallet-adapter-react: ^0.15.39` - Solana wallet connection
- `viem: ^2.38.5` - TypeScript EVM library

## Documentation Files

- `contract/README.md`: Comprehensive contract documentation (v1.1.1 changelog, architecture)
- `contract/DEPLOY_GUIDE.md`: Step-by-step deployment instructions
- `x402-polymarket-frontend/README.md`: Frontend setup and X402 protocol explanation
- `x402-polymarket-frontend/PAYWALL_INTEGRATION.md`: Multi-chain paywall implementation guide
- `x402-polymarket-frontend/ARCHITECTURE.md`: Frontend architecture details
- `x402-polymarket-frontend/WALLET_INTEGRATION_GUIDE.md`: Wallet integration patterns