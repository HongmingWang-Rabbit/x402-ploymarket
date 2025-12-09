# AI Prediction Market - Architecture & Implementation Plan

## Overview

Recreating the prediction market application with:
- **Frontend**: Next.js 15 (App Router) with TypeScript
- **Backend**: Fastify with TypeScript (deploy to Railway)
- **State**: React Context (UI) + TanStack React Query (server state)
- **Blockchain**: Solana (modular design for future multi-chain)
- **Payments**: x402 protocol integration

---

## Part 1: Frontend Architecture

### Directory Structure

```
ai-prediction-market-front-end/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (main)/                   # Main layout group
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # Home/Markets list
│   │   │   ├── markets/
│   │   │   │   ├── page.tsx          # Markets list
│   │   │   │   ├── create/page.tsx   # Create market
│   │   │   │   └── [address]/page.tsx # Market detail
│   │   │   ├── portfolio/page.tsx    # User portfolio
│   │   │   └── admin/
│   │   │       ├── page.tsx
│   │   │       └── initialize/page.tsx
│   │   ├── api/                      # API routes (if needed)
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css
│   │
│   ├── components/                   # UI Components
│   │   ├── ui/                       # Primitives (Button, Input, Card, etc.)
│   │   ├── layout/                   # Header, Footer, Navigation
│   │   ├── market/                   # Market-specific components
│   │   │   ├── MarketCard.tsx
│   │   │   ├── MarketList.tsx
│   │   │   ├── TradingPanel.tsx
│   │   │   ├── LiquidityPanel.tsx
│   │   │   └── MarketStats.tsx
│   │   ├── wallet/                   # Wallet connection UI
│   │   │   ├── ConnectButton.tsx
│   │   │   ├── WalletStatus.tsx
│   │   │   └── ChainSelector.tsx
│   │   └── common/                   # Shared components
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── Toast.tsx
│   │
│   ├── features/                     # Feature modules (business logic)
│   │   ├── markets/
│   │   │   ├── hooks/
│   │   │   │   ├── useMarkets.ts
│   │   │   │   ├── useMarket.ts
│   │   │   │   └── useCreateMarket.ts
│   │   │   ├── api.ts                # API calls
│   │   │   └── types.ts
│   │   ├── trading/
│   │   │   ├── hooks/
│   │   │   │   ├── useSwap.ts
│   │   │   │   ├── useMint.ts
│   │   │   │   └── useRedeem.ts
│   │   │   └── utils.ts
│   │   ├── liquidity/
│   │   │   └── hooks/
│   │   │       ├── useAddLiquidity.ts
│   │   │       └── useWithdrawLiquidity.ts
│   │   ├── portfolio/
│   │   │   └── hooks/
│   │   │       └── usePortfolio.ts
│   │   └── payment/
│   │       ├── hooks/
│   │       │   └── useX402Payment.ts
│   │       └── x402.ts
│   │
│   ├── lib/                          # Core libraries
│   │   ├── blockchain/               # Blockchain abstraction layer
│   │   │   ├── types.ts              # Shared blockchain types
│   │   │   ├── provider.tsx          # Blockchain provider context
│   │   │   ├── solana/               # Solana implementation
│   │   │   │   ├── client.ts         # PredictionMarketClient
│   │   │   │   ├── config.ts
│   │   │   │   ├── wallet.tsx
│   │   │   │   └── idl/
│   │   │   │       └── prediction_market.json
│   │   │   └── adapters/             # Future chain adapters
│   │   │       └── index.ts
│   │   ├── api/                      # API client
│   │   │   └── client.ts
│   │   └── utils/                    # Pure utilities
│   │       ├── format.ts
│   │       ├── validation.ts
│   │       └── constants.ts
│   │
│   ├── providers/                    # React Context providers
│   │   ├── index.tsx                 # Combined providers
│   │   ├── QueryProvider.tsx
│   │   ├── WalletProvider.tsx
│   │   └── ToastProvider.tsx
│   │
│   ├── config/                       # Configuration
│   │   ├── index.ts                  # Main config export
│   │   ├── contracts.ts
│   │   ├── x402.ts
│   │   └── env.ts                    # Environment validation
│   │
│   └── types/                        # Global TypeScript types
│       ├── index.ts
│       ├── market.ts
│       └── api.ts
│
├── public/
├── .env.example
├── .env.local
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### Key Design Principles

1. **Feature-Based Organization**: Group related hooks, API calls, and types together
2. **Blockchain Abstraction Layer**: Abstract chain-specific code behind interfaces
3. **Separation of Concerns**: UI components have no business logic
4. **Co-location**: Keep related code together (hooks near components that use them)
5. **Single Source of Truth**: Config in one place, types in one place

---

## Part 2: Backend Architecture

### Directory Structure

```
prediction-market-back-end/
├── src/
│   ├── index.ts                      # Entry point
│   ├── app.ts                        # Fastify app setup
│   │
│   ├── routes/                       # API routes
│   │   ├── index.ts                  # Route registration
│   │   ├── markets/
│   │   │   ├── index.ts              # /markets routes
│   │   │   ├── create.ts             # POST /markets/create
│   │   │   └── handlers.ts
│   │   ├── trading/
│   │   │   ├── index.ts              # /trading routes
│   │   │   ├── swap.ts               # POST /trading/swap
│   │   │   └── handlers.ts
│   │   └── health.ts                 # Health check
│   │
│   ├── services/                     # Business logic
│   │   ├── market.service.ts
│   │   ├── trading.service.ts
│   │   └── payment.service.ts
│   │
│   ├── blockchain/                   # Blockchain interactions
│   │   ├── solana/
│   │   │   ├── client.ts
│   │   │   ├── config.ts
│   │   │   └── idl/
│   │   └── types.ts
│   │
│   ├── middleware/                   # Fastify middleware
│   │   ├── x402.ts                   # x402 payment validation
│   │   ├── auth.ts                   # Optional auth
│   │   └── error.ts                  # Error handling
│   │
│   ├── plugins/                      # Fastify plugins
│   │   ├── cors.ts
│   │   └── swagger.ts
│   │
│   ├── config/                       # Configuration
│   │   ├── index.ts
│   │   └── env.ts
│   │
│   ├── utils/                        # Utilities
│   │   ├── logger.ts
│   │   └── errors.ts
│   │
│   └── types/                        # TypeScript types
│       ├── index.ts
│       └── api.ts
│
├── .env.example
├── .env
├── tsconfig.json
├── package.json
└── Dockerfile                        # For Railway deployment
```

---

## Part 3: Implementation Steps

### Phase 1: Project Setup (Frontend + Backend)

#### Frontend Setup
1. Initialize Next.js 15 with TypeScript
2. Configure Tailwind CSS
3. Set up ESLint + Prettier
4. Create base folder structure
5. Configure path aliases (@/ imports)
6. Set up environment variables

#### Backend Setup
1. Initialize Fastify project with TypeScript
2. Configure ESLint + Prettier
3. Set up folder structure
4. Configure environment variables
5. Add Dockerfile for Railway
6. Set up basic health check endpoint

### Phase 2: Core Infrastructure

#### Frontend
1. Create UI primitives (Button, Input, Card, Modal)
2. Set up React Query provider
3. Create error boundary component
4. Set up toast notifications
5. Create loading states/skeletons

#### Backend
1. Set up Fastify plugins (CORS, Swagger)
2. Create error handling middleware
3. Set up logging (pino)
4. Create base service pattern

### Phase 3: Blockchain Integration

#### Shared
1. Copy IDL from existing project
2. Create Solana config

#### Frontend
1. Create blockchain abstraction layer (IBlockchainAdapter interface)
2. Implement Solana adapter
3. Create wallet provider (Solana wallet adapter)
4. Create PredictionMarketClient wrapper
5. Export unified blockchain hook (useBlockchain)

#### Backend
1. Create Solana client
2. Set up backend wallet management
3. Create transaction signing utilities

### Phase 4: x402 Payment Integration

#### Frontend
1. Create useX402Payment hook
2. Create payment flow utilities

#### Backend
1. Implement x402 middleware for Fastify
2. Create payment validation service
3. Add payment endpoints

### Phase 5: Feature Implementation

#### Markets Feature
**Frontend:**
1. useMarkets hook (list markets with pagination)
2. useMarket hook (single market data)
3. useCreateMarket hook (create market mutation)
4. MarketCard component
5. MarketList component
6. CreateMarketForm component
7. Markets page
8. Create Market page

**Backend:**
1. GET /markets - List markets
2. GET /markets/:address - Get market
3. POST /markets/create - Create market (with x402)

#### Trading Feature
**Frontend:**
1. useSwap hook
2. useMint hook
3. useRedeem hook
4. TradingPanel component (swap UI)
5. MintRedeemPanel component
6. Market detail page integration

**Backend:**
1. POST /trading/swap - Execute swap (with x402)
2. POST /trading/mint - Mint complete set
3. POST /trading/redeem - Redeem complete set

#### Liquidity Feature
**Frontend:**
1. useAddLiquidity hook
2. useWithdrawLiquidity hook
3. LiquidityPanel component

**Backend:**
1. POST /liquidity/add
2. POST /liquidity/withdraw

#### Portfolio Feature
**Frontend:**
1. usePortfolio hook
2. PortfolioSummary component
3. PositionsList component
4. Portfolio page

#### Admin Feature
**Frontend:**
1. useAdminInit hook
2. Admin pages

### Phase 6: Polish & Testing
1. Add loading states everywhere
2. Improve error messages
3. Add input validation
4. Responsive design check
5. Performance optimization (memoization)

---

## Part 4: Key Interfaces

### Blockchain Abstraction Layer

```typescript
// lib/blockchain/types.ts
interface IBlockchainAdapter {
  readonly chain: ChainType;

  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getAddress(): string | null;

  // Markets
  getMarkets(limit?: number, offset?: number): Promise<Market[]>;
  getMarket(address: string): Promise<Market>;

  // Trading (wallet-based)
  swap(params: SwapParams): Promise<TransactionResult>;
  mintCompleteSet(params: MintParams): Promise<TransactionResult>;
  redeemCompleteSet(params: RedeemParams): Promise<TransactionResult>;

  // Liquidity
  addLiquidity(params: AddLiquidityParams): Promise<TransactionResult>;
  withdrawLiquidity(params: WithdrawLiquidityParams): Promise<TransactionResult>;
}

// This allows future chains to implement the same interface
type ChainType = 'solana' | 'evm' | 'sui' | 'aptos'; // extensible
```

### API Client Pattern

```typescript
// lib/api/client.ts
class APIClient {
  private baseUrl: string;

  async createMarket(params: CreateMarketParams): Promise<CreateMarketResponse>;
  async swap(params: SwapParams): Promise<SwapResponse>;
  // ... other methods
}
```

---

## Part 5: Configuration

### Frontend Environment Variables

```env
# .env.example
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM
NEXT_PUBLIC_X402_FACILITATOR_URL=https://x402.org/facilitator
```

### Backend Environment Variables

```env
# .env.example
PORT=3001
NODE_ENV=development
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
BACKEND_PRIVATE_KEY=<base58_encoded_private_key>
PROGRAM_ID=CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM
X402_PAYMENT_ADDRESS=<payment_receiving_address>
X402_FACILITATOR_URL=https://x402.org/facilitator
```

---

## Part 6: Improvements Over Original

| Area | Original Issue | New Approach |
|------|----------------|--------------|
| Code Organization | Mixed concerns in hooks | Feature-based modules |
| Blockchain | Tight coupling to Solana | Abstraction layer |
| Type Safety | `as any` casts | Proper typing |
| Error Handling | Inconsistent | Centralized error boundary + typed errors |
| State Management | Scattered contexts | React Query + minimal context |
| Configuration | Hardcoded values | Centralized config with validation |
| API | Next.js API routes | Separate Fastify backend |
| Testing | None | Ready for unit/integration tests |
| Scalability | Monolithic | Modular, replaceable parts |

---

## Estimated Implementation Order

1. **Setup** (Frontend + Backend base)
2. **UI Components** (primitives)
3. **Blockchain Layer** (Solana adapter)
4. **Wallet Connection**
5. **Markets Feature** (list, view)
6. **x402 Integration**
7. **Market Creation**
8. **Trading Feature**
9. **Liquidity Feature**
10. **Portfolio Feature**
11. **Admin Feature**
12. **Polish**

---

## Ready to Proceed?

This plan creates a modular, scalable, and maintainable codebase that:
- Separates frontend and backend concerns
- Abstracts blockchain interactions for future multi-chain support
- Uses modern React patterns (React Query, feature modules)
- Follows best practices for TypeScript and code organization
- Is easy to test and extend
