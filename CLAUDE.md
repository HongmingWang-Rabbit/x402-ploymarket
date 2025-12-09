# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

x402-ploymarket is a decentralized prediction market platform built on Solana with x402 payment protocol integration. The project consists of three main components: a Next.js frontend, a Fastify backend, and an Anchor smart contract.

## Commands

### Frontend (ai-prediction-market-front-end/)
```bash
pnpm dev         # Development server (port 3000)
pnpm build       # Production build
pnpm lint        # ESLint check
```

### Backend (prediction-market-back-end/)
```bash
pnpm dev         # Development server with watch (port 3001)
pnpm build       # TypeScript compilation
pnpm typecheck   # Type checking without emit
pnpm lint        # ESLint check
```

### Workers (workers/)
```bash
pnpm dev:generator      # Run market generator worker
pnpm dev:validator      # Run market validator worker
pnpm dev:publisher      # Run blockchain publisher worker
pnpm dev:scheduler      # Run scheduled task worker
pnpm dev:resolver       # Run market resolution worker
pnpm dev:dispute-agent  # Run dispute handling worker
pnpm dev:crawler        # Run news crawler worker
pnpm dev:extractor      # Run data extractor worker
pnpm build              # TypeScript compilation
pnpm lint               # ESLint check
```

### Smart Contract (contract/)
```bash
anchor build                           # Compile program
anchor test                            # Full test suite with validator
yarn test                              # Run Mocha tests only
node scripts/init-localhost.js         # Initialize on localnet
node scripts/init-devnet.js            # Initialize on devnet
node scripts/test-market-flow.js       # End-to-end flow test
```

## Architecture

### Four-Layer Structure
- **Frontend**: Next.js 16 with App Router, React Query, Solana wallet adapters
- **Backend**: Fastify server handling API routes with x402 payment validation middleware
- **Workers**: TypeScript workers for AI market generation, validation, blockchain publishing, and scheduling
- **Contract**: Anchor-based Solana program using LMSR pricing algorithm

### Frontend Organization (ai-prediction-market-front-end/src/)
- `app/` - Next.js App Router pages
- `features/` - Feature modules (markets, trading, liquidity, portfolio) with co-located hooks, types, and API calls
- `lib/blockchain/` - Blockchain abstraction layer with `IBlockchainAdapter` interface for multi-chain support
- `lib/api/` - API client for backend communication
- `config/` - Environment and contract configuration
- `providers/` - React Context providers for wallet and app state

### Backend Organization (prediction-market-back-end/src/)
- `routes/` - API endpoints (markets, trading, liquidity, metadata, config)
- `services/` - Business logic layer
- `blockchain/solana/` - Solana client integration
- `middleware/` - x402 validation and error handling
- `config/` - Environment and contract configuration

### Workers Organization (workers/src/)
- `generator.ts` - AI-powered market question generation using OpenAI
- `validator.ts` - Validates generated markets against quality criteria
- `publisher.ts` - Publishes validated markets to Solana blockchain
- `scheduler.ts` - Manages scheduled tasks and market lifecycle
- `resolver.ts` - Resolves markets based on outcomes
- `dispute-agent.ts` - Handles market dispute resolution
- `crawler.ts` - Crawls news sources for market ideas
- `extractor.ts` - Extracts structured data from crawled content
- `lib/` - Shared utilities (database, message queue, OpenAI client, Solana client)

### Smart Contract Organization (contract/programs/prediction-market/src/)
- `instructions/` - Instruction handlers split into `admin/` and `market/`
- `state/` - Account structures (config.rs, market.rs)
- `math/` - LMSR pricing, fixed-point arithmetic, calculators
- `lib.rs` - Program entry point with 30+ instruction declarations

## Key Concepts

### LMSR Pricing
The contract uses Logarithmic Market Scoring Rule for dynamic market pricing. Implementation in `contract/programs/prediction-market/src/math/lmsr.rs`.

### Blockchain Abstraction
Frontend uses `IBlockchainAdapter` interface (`lib/blockchain/`) allowing pluggable blockchain implementations (currently Solana, designed for future multi-chain support).

### x402 Payment Integration
Backend middleware validates x402 payments for meta-transaction support. Configuration in `src/config/x402.ts` (frontend) and `src/middleware/` (backend).

### Single-Sided Liquidity
Users deposit only USDC; the contract auto-mints YES/NO tokens proportionally.

### Worker Pipeline
Workers communicate via RabbitMQ message queues:
1. **Crawler** → crawls news sources for potential market topics
2. **Extractor** → extracts structured data from crawled content
3. **Generator** → uses OpenAI to create market questions
4. **Validator** → validates market quality and criteria
5. **Publisher** → publishes approved markets to Solana
6. **Scheduler** → manages market lifecycle events
7. **Resolver** → determines market outcomes
8. **Dispute Agent** → handles disputed resolutions

## Important Configuration Files

- **Program IDs**: `contract/Anchor.toml` (per-network program IDs)
- **Frontend Config**: `ai-prediction-market-front-end/src/config/`
- **Backend Config**: `prediction-market-back-end/src/config/`
- **Workers Config**: `workers/.env` (see `workers/.env.example` for template)
- **Shared Types**: `packages/shared-types/` (shared TypeScript types for backend and workers)
- **Frontend Port**: 3000
- **Backend Port**: 3001

## Monorepo Structure

This is a pnpm workspace monorepo:
```
x402-ploymarket/
├── ai-prediction-market-front-end/   # Next.js frontend
├── prediction-market-back-end/       # Fastify API server
├── workers/                          # Background workers
├── contract/                         # Anchor smart contract
├── packages/
│   └── shared-types/                 # Shared TypeScript types
├── pnpm-workspace.yaml               # Workspace config
└── package.json                      # Root package
```

### Workspace Commands (from root)
```bash
pnpm install                          # Install all dependencies
pnpm --filter <package> <cmd>         # Run command in specific package
pnpm -w run test                      # Run tests from workspace root
```

## Deployment

### Railway Deployment
Both backend and workers are configured for Railway deployment:
- `prediction-market-back-end/railway.toml` - Backend service config
- `workers/railway.toml` - Workers service config
- Workers use `WORKER_TYPE` env var to run different workers from a single Docker image

### Required External Services
- **PostgreSQL/Neon**: Database for markets, users, transactions
- **RabbitMQ**: Message queue for worker communication
- **OpenAI**: AI-powered market generation
- **Solana RPC**: Blockchain interactions (devnet/mainnet)

## Current State

- Active branch: `new-version`
- Network: Devnet (configurable)
- Legacy frontend exists in `old-x402-polymarket-frontend/` (deprecated)
