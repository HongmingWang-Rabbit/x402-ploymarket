# 2. High-Level Architecture

## Overview

The AI-driven prediction market system extends the existing x402-ploymarket architecture with:
- **Workers**: Separate Node.js processes for AI tasks
- **Message Queue**: RabbitMQ for worker communication
- **Shared Types**: npm workspace package for type safety
- **Extended API**: Versioned endpoints for AI features

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │  Frontend        │    │  Admin Panel     │    │  Wallet          │       │
│  │  - Markets list  │    │  - Proposals     │    │  - Sign txs      │       │
│  │  - Trading       │    │  - Disputes      │    │  - Connect       │       │
│  │  - Proposals     │    │  - AI Config     │    │                  │       │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘       │
│           │                       │                       │                  │
└───────────┼───────────────────────┼───────────────────────┼──────────────────┘
            │                       │                       │
            ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Fastify Backend Server                             │   │
│  │                                                                       │   │
│  │  Existing Routes:              New Routes (v1):                       │   │
│  │  ├── /api/config              ├── /api/v1/propose                    │   │
│  │  ├── /api/markets             ├── /api/v1/markets                    │   │
│  │  ├── /api/trading             ├── /api/v1/admin/ingest               │   │
│  │  ├── /api/liquidity           ├── /api/v1/admin/proposals            │   │
│  │  └── /api/metadata            ├── /api/v1/admin/disputes             │   │
│  │                               ├── /api/v1/worker/* (internal)        │   │
│  │                               └── /api/v1/auth/worker-token          │   │
│  │                                                                       │   │
│  │  Middleware:                                                          │   │
│  │  ├── x402 validation                                                  │   │
│  │  ├── Rate limiting (3/min, 20/hr, 100/day for /propose)              │   │
│  │  ├── JWT authentication                                               │   │
│  │  └── Worker API key validation                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
            ▼                      ▼                      ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────────────┐
│   PostgreSQL      │  │   RabbitMQ        │  │   Solana Blockchain           │
│                   │  │                   │  │                               │
│  Tables:          │  │  Queues:          │  │  Program:                     │
│  ├── markets      │  │  ├── news.raw     │  │  ├── create_market            │
│  ├── proposals    │  │  ├── candidates   │  │  ├── swap                     │
│  ├── news_items   │  │  ├── drafts.*     │  │  ├── add_liquidity            │
│  ├── validations  │  │  ├── markets.*    │  │  ├── resolution               │
│  ├── resolutions  │  │  ├── disputes     │  │  └── ...                      │
│  ├── audit_logs   │  │  └── *.dlq        │  │                               │
│  └── ai_config    │  │                   │  │  State:                       │
│                   │  │  Exchanges:       │  │  ├── Market account           │
└─────────┬─────────┘  │  └── prediction   │  │  ├── Config account           │
          │            │      .market      │  │  └── LP positions             │
          │            └─────────┬─────────┘  └───────────────────────────────┘
          │                      │
          └──────────┬───────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            WORKER LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Crawler    │  │  Extractor  │  │  Generator  │  │  Validator  │         │
│  │             │  │             │  │             │  │             │         │
│  │  RSS feeds  │─▶│  NLP/Entity │─▶│  LLM call   │─▶│  LLM + rules│         │
│  │  Manual API │  │  extraction │  │  Draft mkt  │  │  Approve/   │         │
│  │             │  │             │  │             │  │  Reject     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────┬──────┘         │
│                                                            │                 │
│                                    ┌───────────────────────┘                 │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Publisher  │  │  Resolver   │  │  Dispute    │  │  Scheduler  │         │
│  │             │  │             │  │  Agent      │  │  (Cron)     │         │
│  │  On-chain   │◀─│  Fetch src  │◀─│  Review     │◀─│  Check      │         │
│  │  create_mkt │  │  Apply rules│  │  disputes   │  │  expiry     │         │
│  │             │  │  Resolve    │  │             │  │  1 min      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure (Monorepo)

```
x402-ploymarket/
├── ai-prediction-market-front-end/     # Existing Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/
│   │   │   │   ├── proposals/          # NEW: Review proposals
│   │   │   │   ├── disputes/           # NEW: Review disputes
│   │   │   │   └── ai-config/          # NEW: AI configuration
│   │   │   └── propose/                # NEW: User proposal page
│   │   ├── features/
│   │   │   └── proposals/              # NEW: Proposal feature module
│   │   └── ...
│   ├── package.json
│   └── .env
│
├── prediction-market-back-end/         # Existing Fastify backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── v1/                     # NEW: Versioned AI routes
│   │   │   │   ├── propose.ts
│   │   │   │   ├── admin/
│   │   │   │   └── worker/
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── ai/                     # NEW: AI service layer
│   │   │   │   ├── llm.service.ts
│   │   │   │   └── queue.service.ts
│   │   │   └── ...
│   │   └── ...
│   ├── package.json
│   └── .env
│
├── contract/                           # Existing Anchor program
│   └── ...
│
├── workers/                            # NEW: AI worker processes
│   ├── src/
│   │   ├── crawler.ts
│   │   ├── extractor.ts
│   │   ├── generator.ts
│   │   ├── validator.ts
│   │   ├── publisher.ts
│   │   ├── resolver.ts
│   │   ├── dispute-agent.ts
│   │   ├── scheduler.ts                # Cron job for resolution
│   │   └── shared/
│   │       ├── queue.ts                # RabbitMQ connection
│   │       ├── db.ts                   # PostgreSQL connection
│   │       ├── llm.ts                  # OpenAI client
│   │       └── auth.ts                 # JWT handling
│   ├── package.json
│   └── .env
│
├── packages/                           # NEW: Shared packages
│   └── shared-types/
│       ├── src/
│       │   ├── index.ts
│       │   ├── market.ts               # Market types
│       │   ├── proposal.ts             # Proposal types
│       │   ├── resolution.ts           # Resolution types
│       │   ├── news.ts                 # News/candidate types
│       │   ├── queue.ts                # Queue message types
│       │   └── api.ts                  # API request/response types
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                        # NEW: Workspace root
├── pnpm-workspace.yaml                 # NEW: Workspace config
└── implement-AI-plans/                 # This documentation
```

---

## Component Responsibilities

### 1. Crawler
- **Purpose**: Collect news from official sources
- **Input**: RSS feeds, manual ingest API
- **Output**: Raw news items to `news.raw` queue
- **Scaling**: Single instance (IO-bound)

### 2. Extractor
- **Purpose**: Identify market-worthy events and extract entities
- **Input**: `news.raw` queue
- **Output**: Candidate objects to `candidates` queue
- **Scaling**: 1-2 instances

### 3. Generator
- **Purpose**: Create draft market JSON from candidates/proposals
- **Input**: `candidates` queue, direct API calls for user proposals
- **Output**: Draft markets to `drafts.validate` queue
- **Scaling**: 2-4 instances (LLM-bound)

### 4. Validator
- **Purpose**: Check draft markets for completeness and clarity
- **Input**: `drafts.validate` queue
- **Output**: `approved` → `markets.publish`, `rejected` → stored, `needs_human` → admin queue
- **Scaling**: 2-4 instances (LLM-bound)

### 5. Publisher
- **Purpose**: Publish approved markets on-chain
- **Input**: `markets.publish` queue
- **Output**: Solana transaction, market status update
- **Scaling**: Single instance (transaction ordering)

### 6. Resolver
- **Purpose**: Determine market outcomes
- **Input**: `markets.resolve` queue (from scheduler)
- **Output**: Resolution decision, on-chain settlement
- **Scaling**: 2-4 instances

### 7. Dispute Agent
- **Purpose**: Process and evaluate disputes
- **Input**: `disputes` queue
- **Output**: Resolution confirmation or admin escalation
- **Scaling**: 1-2 instances

### 8. Scheduler (Cron)
- **Purpose**: Check for markets ready for resolution
- **Input**: PostgreSQL query (expiry time)
- **Output**: Messages to `markets.resolve` queue
- **Frequency**: Every 1 minute

---

## Data Flow Diagrams

### User Proposal Flow

```
User                API Server              Generator           Validator           Publisher
  │                     │                      │                    │                   │
  │  POST /propose      │                      │                    │                   │
  │────────────────────▶│                      │                    │                   │
  │                     │  Check duplicates    │                    │                   │
  │                     │──────────────────────│                    │                   │
  │                     │                      │                    │                   │
  │                     │  Queue: candidates   │                    │                   │
  │                     │─────────────────────▶│                    │                   │
  │                     │                      │                    │                   │
  │                     │                      │  LLM: generate     │                   │
  │                     │                      │  draft market      │                   │
  │                     │                      │                    │                   │
  │                     │                      │  Queue: drafts     │                   │
  │                     │                      │───────────────────▶│                   │
  │                     │                      │                    │                   │
  │                     │                      │                    │  LLM: validate    │
  │                     │                      │                    │                   │
  │                     │                      │                    │  If approved:     │
  │                     │                      │                    │  Queue: publish   │
  │                     │                      │                    │──────────────────▶│
  │                     │                      │                    │                   │
  │                     │                      │                    │                   │  On-chain
  │                     │                      │                    │                   │  create_market
  │                     │  Response: draft +   │                    │                   │
  │◀────────────────────│  confidence + status │                    │                   │
  │                     │                      │                    │                   │
```

### Resolution Flow

```
Scheduler           Resolver             Oracle Sources          Blockchain
    │                  │                      │                      │
    │  Check expiry    │                      │                      │
    │  (every 1 min)   │                      │                      │
    │                  │                      │                      │
    │  Queue: resolve  │                      │                      │
    │─────────────────▶│                      │                      │
    │                  │                      │                      │
    │                  │  Fetch allowed       │                      │
    │                  │  sources             │                      │
    │                  │─────────────────────▶│                      │
    │                  │                      │                      │
    │                  │◀─────────────────────│                      │
    │                  │  HTML/JSON response  │                      │
    │                  │                      │                      │
    │                  │  Apply must_meet_all │                      │
    │                  │  Apply must_not_count│                      │
    │                  │  Compute result      │                      │
    │                  │                      │                      │
    │                  │  Store evidence hash │                      │
    │                  │  Update DB           │                      │
    │                  │                      │                      │
    │                  │  resolution() tx     │                      │
    │                  │─────────────────────────────────────────────▶│
    │                  │                      │                      │
    │                  │                      │     Start 24h        │
    │                  │                      │     dispute window   │
    │                  │                      │                      │
```

---

## Environment Configuration

### Backend (.env)
```bash
# Existing
PORT=3001
DATABASE_URL=postgresql://...
SOLANA_RPC_URL=https://...
PROGRAM_ID=...

# New AI additions
RABBITMQ_URL=amqp://localhost:5672
OPENAI_API_KEY=sk-...
INTERNAL_JWT_SECRET=...
RATE_LIMIT_PROPOSE_PER_MIN=3
RATE_LIMIT_PROPOSE_PER_HOUR=20
RATE_LIMIT_PROPOSE_PER_DAY=100
```

### Workers (.env)
```bash
DATABASE_URL=postgresql://...
RABBITMQ_URL=amqp://localhost:5672
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo
SOLANA_RPC_URL=https://...
PROGRAM_ID=...
PUBLISHER_PRIVATE_KEY=...  # For on-chain transactions
API_BASE_URL=http://localhost:3001
INTERNAL_JWT_SECRET=...
```

### Frontend (.env)
```bash
# Existing
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_PROGRAM_ID=...

# No changes needed - frontend talks to backend API
```

---

## Message Queue Design

### Exchanges
- `prediction.market` (topic exchange)

### Queues

| Queue | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `news.raw` | Crawler | Extractor | Raw news for processing |
| `news.raw.dlq` | RabbitMQ | Manual | Failed news processing |
| `candidates` | Extractor | Generator | Candidate events |
| `candidates.dlq` | RabbitMQ | Manual | Failed extraction |
| `drafts.validate` | Generator | Validator | Draft markets for validation |
| `drafts.validate.dlq` | RabbitMQ | Manual | Failed generation |
| `markets.publish` | Validator | Publisher | Approved markets |
| `markets.publish.dlq` | RabbitMQ | Manual | Failed publishing |
| `markets.resolve` | Scheduler | Resolver | Markets ready for resolution |
| `markets.resolve.dlq` | RabbitMQ | Manual | Failed resolution |
| `disputes` | API | Dispute Agent | User disputes |
| `disputes.dlq` | RabbitMQ | Manual | Failed dispute processing |

### Retry Policy
- 3 retries with exponential backoff (1s, 5s, 30s)
- After 3 failures → move to DLQ
- DLQ messages require manual review
