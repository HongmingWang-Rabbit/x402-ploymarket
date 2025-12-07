# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Development server (port 3000)
pnpm build        # Production build with type checking
pnpm lint         # ESLint check
```

## Architecture

### Tech Stack
- Next.js 16 with App Router, React 19, TypeScript
- Solana blockchain via @coral-xyz/anchor and @solana/web3.js
- React Query for server state management
- Tailwind CSS 4 for styling
- x402 protocol for payment handling

### Directory Structure

```
src/
├── app/                    # Next.js App Router pages
├── features/               # Feature modules (co-located logic)
│   ├── markets/           # Market listing, creation, detail
│   ├── trading/           # Swap, mint, redeem operations
│   ├── liquidity/         # LP add/withdraw
│   ├── portfolio/         # User positions and balances
│   ├── payment/           # x402 payment integration
│   ├── admin/             # Admin/whitelist checks
│   └── config/            # App configuration hooks
├── lib/
│   ├── blockchain/        # Chain abstraction layer
│   │   ├── types.ts       # IBlockchainAdapter interface
│   │   ├── solana/        # Solana implementation
│   │   └── adapters.ts    # Adapter registry
│   └── api/               # Backend API client
├── components/            # Shared UI components
├── providers/             # React context providers
├── config/                # Environment and app config
└── types/                 # Shared TypeScript types
```

### Key Patterns

**Blockchain Abstraction Layer** (`lib/blockchain/`)
- `IBlockchainAdapter` interface defines chain-agnostic operations
- Currently implements Solana; designed for multi-chain support
- Access via `useBlockchain()` hook or `getSolanaAdapter()`

**Feature Modules** (`features/`)
- Each feature has `hooks/`, `types.ts`, and optionally `api.ts`
- Hooks use React Query with query key factories (e.g., `marketKeys.detail(address)`)
- API functions call either blockchain adapter directly or backend API

**Data Flow**
- Markets fetched from blockchain via adapter, metadata from backend API
- Metadata linked to markets by market address (not stored on-chain)
- Trading operations go through blockchain adapter with wallet signing

## Configuration

Environment variables (see `.env.example`):
- `NEXT_PUBLIC_API_URL` - Backend API (default: localhost:3001)
- `NEXT_PUBLIC_CHAIN_ID` - Chain selection (e.g., `solana-devnet`)
- `NEXT_PUBLIC_PROGRAM_ID` - Solana program ID
- `NEXT_PUBLIC_DEV` - Set to `true` to bypass admin checks

## Related Projects

This frontend works with:
- Backend: `../prediction-market-back-end/` (Fastify API server)
- Smart Contract: `../contract/` (Anchor program)
