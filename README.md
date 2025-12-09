# X402 Polymarket

A decentralized prediction market platform built on Solana, featuring multi-chain payment support through the X402 protocol and AI-powered market generation.

## Features

- **Prediction Markets**: Create and trade on binary outcome markets using YES/NO tokens
- **Multi-Chain Payments**: Support for both EVM (Base Sepolia) and Solana (Devnet) via X402 protocol
- **Single-Sided Liquidity**: Provide liquidity using only USDC - the contract automatically mints YES/NO tokens
- **LMSR Pricing**: Logarithmic Market Scoring Rule for dynamic market pricing
- **Real-Time Trading**: Buy and sell prediction tokens with instant settlement
- **AI Market Generation**: Automated market creation from news and user proposals
- **Deterministic Resolution**: Rule-based market resolution with dispute handling

## Project Structure

```
x402-ploymarket/
├── contract/                           # Solana smart contract (Anchor)
│   └── programs/prediction-market/
├── ai-prediction-market-front-end/     # Next.js frontend
├── prediction-market-back-end/         # Fastify API server
│   ├── src/
│   │   ├── routes/                     # API endpoints
│   │   │   ├── v1/                     # AI features API
│   │   │   │   ├── propose.ts          # User proposal endpoints
│   │   │   │   └── admin/              # Admin review endpoints
│   │   ├── services/ai/                # AI service layer
│   │   └── db/migrations/              # Database migrations
├── workers/                            # AI worker processes
│   └── src/
│       ├── generator.ts                # Market generation from proposals
│       ├── validator.ts                # Draft market validation
│       ├── publisher.ts                # On-chain market publishing
│       ├── resolver.ts                 # Market resolution
│       ├── scheduler.ts                # Cron jobs for resolution/finalization
│       └── dispute-agent.ts            # Dispute review AI
├── packages/
│   └── shared-types/                   # Shared TypeScript types
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+ and pnpm 8+
- Solana CLI tools
- Anchor framework
- PostgreSQL database (or Neon)
- RabbitMQ (for AI workers)
- OpenAI API key (for AI features)
- A Solana wallet (Phantom, Backpack, etc.)

### 1. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install

# Build shared types (required before other packages)
pnpm build:types
```

### 2. Environment Setup

#### Backend (.env)

Create `prediction-market-back-end/.env`:

```env
# Server
PORT=3001
NODE_ENV=development

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM
BACKEND_PRIVATE_KEY=your_base58_private_key

# x402
X402_PAYMENT_ADDRESS=your_payment_address
X402_FACILITATOR_URL=https://x402.org/facilitator

# CORS
CORS_ORIGIN=http://localhost:3000

# Database (PostgreSQL/Neon)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# RabbitMQ (for AI workers)
RABBITMQ_URL=amqp://localhost:5672

# OpenAI (for AI features)
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o-mini

# Rate Limits
RATE_LIMIT_PROPOSE_PER_MIN=5
RATE_LIMIT_PROPOSE_PER_HOUR=20
RATE_LIMIT_PROPOSE_PER_DAY=50

# Internal Auth
INTERNAL_JWT_SECRET=your_jwt_secret
```

#### Workers (.env)

Create `workers/.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o-mini

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM
PUBLISHER_PRIVATE_KEY=your_base58_private_key

# API
API_BASE_URL=http://localhost:3001
WORKER_API_KEY=your_worker_api_key

# Feature Flags
DRY_RUN=true  # Set to false for production
```

#### Frontend (.env.local)

Create `ai-prediction-market-front-end/.env.local`:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_SOLANA_RECIPIENT=your_solana_address
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Database Setup

Run migrations to create the AI tables:

```bash
cd prediction-market-back-end
pnpm dev  # This will auto-run migrations on startup
```

Or manually:

```bash
# The migrations are run automatically when the backend starts
# Tables created: ai_markets, proposals, news_items, candidates,
#                 resolutions, disputes, audit_logs, ai_config, etc.
```

### 4. Start Services

#### Start RabbitMQ (Docker)

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

#### Start Backend

```bash
cd prediction-market-back-end
pnpm dev
# Server runs on http://localhost:3001
```

#### Start Frontend

```bash
cd ai-prediction-market-front-end
pnpm dev
# App runs on http://localhost:3000
```

#### Start AI Workers

Each worker runs as a separate process:

```bash
cd workers

# Start individual workers (in separate terminals)
pnpm dev:generator       # Market generation from proposals
pnpm dev:validator       # Draft validation
pnpm dev:publisher       # On-chain publishing
pnpm dev:resolver        # Market resolution
pnpm dev:scheduler       # Cron jobs
pnpm dev:dispute-agent   # Dispute handling
```

For production, use the compiled versions:

```bash
pnpm build
pnpm start:generator
pnpm start:validator
# etc.
```

---

## Production Deployment

### Railway Deployment

Railway is the recommended platform for deploying the backend and workers. This monorepo is configured for Railway with Docker-based deployments.

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Railway Project                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │    Backend      │    │   PostgreSQL    │                    │
│  │   (Fastify)     │◄──►│    (Neon)       │                    │
│  │   Port: 3001    │    │                 │                    │
│  └────────┬────────┘    └─────────────────┘                    │
│           │                      ▲                              │
│           │                      │                              │
│           ▼                      │                              │
│  ┌─────────────────┐             │                              │
│  │    RabbitMQ     │             │                              │
│  │  (CloudAMQP)    │             │                              │
│  └────────┬────────┘             │                              │
│           │                      │                              │
│     ┌─────┴─────┬───────────┬────┴──────┐                      │
│     ▼           ▼           ▼           ▼                      │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                    │
│ │Generator│ │Validator│ │Publisher│ │Scheduler│                 │
│ │ Worker │ │ Worker  │ │ Worker │ │ Worker │                   │
│ └────────┘ └────────┘ └────────┘ └────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Prerequisites for Railway

1. **Railway Account**: Sign up at https://railway.app
2. **GitHub Repository**: Push this repo to GitHub
3. **External Services** (recommended):
   - **PostgreSQL**: Use [Neon](https://neon.tech) (free tier available)
   - **RabbitMQ**: Use [CloudAMQP](https://cloudamqp.com) (free tier available)
   - **OpenAI API Key**: From https://platform.openai.com

#### Step 1: Install Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

#### Step 2: Create Railway Project

```bash
# Navigate to the repo root
cd /path/to/x402-ploymarket

# Initialize Railway project
railway init

# This creates a new Railway project linked to your repo
```

#### Step 3: Deploy Backend Service

**Option A: Via Railway Dashboard (Recommended for first-time setup)**

1. Go to https://railway.app/dashboard
2. Open your project
3. Click "New Service" → "GitHub Repo"
4. Select your repository
5. Configure the service:
   - **Service Name**: `backend`
   - **Root Directory**: `/` (root of monorepo)
   - **Builder**: Dockerfile
   - **Dockerfile Path**: `prediction-market-back-end/Dockerfile`
6. Add environment variables (see table below)
7. Click "Deploy"

**Option B: Via Railway CLI**

```bash
# Create and link backend service
railway service create backend

# Set Dockerfile path (important for monorepo)
railway variables set RAILWAY_DOCKERFILE_PATH=prediction-market-back-end/Dockerfile

# Set all required environment variables
railway variables set PORT=3001
railway variables set NODE_ENV=production
railway variables set DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
railway variables set SOLANA_RPC_URL="https://api.devnet.solana.com"
railway variables set SOLANA_NETWORK=devnet
railway variables set PROGRAM_ID="CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM"
railway variables set BACKEND_PRIVATE_KEY="your_base58_private_key"
railway variables set X402_PAYMENT_ADDRESS="your_payment_address"
railway variables set X402_FACILITATOR_URL="https://x402.org/facilitator"
railway variables set CORS_ORIGIN="https://your-frontend.vercel.app"
railway variables set RABBITMQ_URL="amqps://user:pass@host/vhost"
railway variables set OPENAI_API_KEY="sk-your-key"
railway variables set OPENAI_MODEL="gpt-4o-mini"
railway variables set INTERNAL_JWT_SECRET="your_jwt_secret"

# Deploy
railway up
```

**Backend Environment Variables:**

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `PORT` | Yes | `3001` | Server port (Railway auto-assigns) |
| `NODE_ENV` | Yes | `production` | Environment mode |
| `DATABASE_URL` | Yes | `postgresql://...` | Neon PostgreSQL connection string |
| `SOLANA_RPC_URL` | Yes | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `SOLANA_NETWORK` | Yes | `devnet` | Solana network (devnet/mainnet-beta) |
| `PROGRAM_ID` | Yes | `CzddKJk...` | Deployed Anchor program ID |
| `BACKEND_PRIVATE_KEY` | Yes | Base58 string | Backend wallet private key |
| `X402_PAYMENT_ADDRESS` | Yes | Solana address | Payment receiving address |
| `X402_FACILITATOR_URL` | Yes | `https://x402.org/facilitator` | X402 facilitator URL |
| `CORS_ORIGIN` | Yes | `https://your-app.com` | Frontend URL for CORS |
| `RABBITMQ_URL` | Yes | `amqps://...` | CloudAMQP connection URL |
| `OPENAI_API_KEY` | Yes | `sk-...` | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model (default: gpt-4o-mini) |
| `INTERNAL_JWT_SECRET` | Yes | Random string | JWT secret for internal auth |

#### Step 4: Deploy Worker Services

Workers share the same Docker image but run different entry points. Create a separate Railway service for each worker type.

**For each worker type (generator, validator, publisher, scheduler):**

**Via Railway Dashboard:**

1. Click "New Service" → "GitHub Repo"
2. Select the same repository
3. Configure:
   - **Service Name**: `worker-generator` (or validator, publisher, scheduler)
   - **Root Directory**: `/`
   - **Dockerfile Path**: `workers/Dockerfile`
4. Add environment variables including `WORKER_TYPE`
5. Deploy

**Via Railway CLI:**

```bash
# Create generator worker
railway service create worker-generator
railway variables set RAILWAY_DOCKERFILE_PATH=workers/Dockerfile
railway variables set WORKER_TYPE=generator
railway variables set DATABASE_URL="postgresql://..."
railway variables set RABBITMQ_URL="amqps://..."
railway variables set OPENAI_API_KEY="sk-..."
railway variables set OPENAI_MODEL="gpt-4o-mini"
railway variables set SOLANA_RPC_URL="https://api.devnet.solana.com"
railway variables set PROGRAM_ID="CzddKJk..."
railway variables set PUBLISHER_PRIVATE_KEY="your_base58_key"
railway variables set API_BASE_URL="https://your-backend.railway.app"
railway variables set WORKER_API_KEY="your_worker_api_key"
railway variables set DRY_RUN="false"
railway up

# Repeat for validator
railway service create worker-validator
railway variables set WORKER_TYPE=validator
# ... (same env vars as above)
railway up

# Repeat for publisher
railway service create worker-publisher
railway variables set WORKER_TYPE=publisher
# ... (same env vars)
railway up

# Repeat for scheduler
railway service create worker-scheduler
railway variables set WORKER_TYPE=scheduler
# ... (same env vars)
railway up
```

**Worker Environment Variables:**

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `WORKER_TYPE` | Yes | `generator` | Worker type: generator/validator/publisher/scheduler |
| `DATABASE_URL` | Yes | `postgresql://...` | Same as backend |
| `RABBITMQ_URL` | Yes | `amqps://...` | CloudAMQP connection URL |
| `OPENAI_API_KEY` | Yes | `sk-...` | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model |
| `SOLANA_RPC_URL` | Yes | `https://api.devnet.solana.com` | Solana RPC |
| `PROGRAM_ID` | Yes | `CzddKJk...` | Anchor program ID |
| `PUBLISHER_PRIVATE_KEY` | Yes | Base58 string | Publisher wallet key |
| `API_BASE_URL` | Yes | `https://backend.railway.app` | Backend URL |
| `WORKER_API_KEY` | Yes | Random string | Worker authentication key |
| `DRY_RUN` | No | `false` | Skip on-chain txs if `true` |

#### Step 5: Configure Networking

1. **Backend Public URL**:
   - In Railway dashboard, go to Backend service
   - Click "Settings" → "Networking"
   - Click "Generate Domain" for a public URL
   - Use this URL for `API_BASE_URL` in worker configs

2. **Workers (No Public URL Needed)**:
   - Workers don't need public URLs
   - They connect to RabbitMQ and PostgreSQL internally

#### Step 6: Verify Deployment

```bash
# Check backend health
curl https://your-backend.railway.app/health

# Expected response:
# {"status":"ok","timestamp":"..."}

# Check backend API
curl https://your-backend.railway.app/api/config/contracts

# Check Railway logs
railway logs --service backend
railway logs --service worker-generator
```

#### Railway Project Structure Summary

After setup, your Railway project should have:

```
Railway Project: x402-polymarket
├── backend              (prediction-market-back-end/Dockerfile)
├── worker-generator     (workers/Dockerfile, WORKER_TYPE=generator)
├── worker-validator     (workers/Dockerfile, WORKER_TYPE=validator)
├── worker-publisher     (workers/Dockerfile, WORKER_TYPE=publisher)
└── worker-scheduler     (workers/Dockerfile, WORKER_TYPE=scheduler)
```

#### Cost Optimization Tips

1. **Use Hobby Plan**: $5/month includes enough resources for testing
2. **Scale Workers**: Start with 1 instance each, scale as needed
3. **Use External Databases**: Neon and CloudAMQP free tiers are sufficient for development
4. **Disable Unused Workers**: Only run generator + validator for basic testing

#### Common Railway Issues & Solutions

**Issue: Build fails with "workspace dependency not found"**
```
Solution: Ensure RAILWAY_DOCKERFILE_PATH is set correctly and Dockerfile copies
the entire workspace structure (pnpm-workspace.yaml, packages/, etc.)
```

**Issue: Workers can't connect to backend**
```
Solution:
1. Ensure backend has a public URL generated
2. Use the Railway-provided URL (not localhost) for API_BASE_URL
3. Check CORS_ORIGIN includes the frontend domain
```

**Issue: Database connection refused**
```
Solution:
1. Verify DATABASE_URL uses SSL: ?sslmode=require
2. Check IP allowlisting in Neon dashboard
3. Railway IPs may need to be allowlisted
```

**Issue: RabbitMQ connection timeout**
```
Solution:
1. Use amqps:// (with SSL) not amqp:// for CloudAMQP
2. Verify credentials in CloudAMQP dashboard
3. Check CloudAMQP connection limits on free tier
```

---

### Alternative Deployment Options

#### Docker Compose (Self-Hosted)

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: prediction-market-back-end/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - RABBITMQ_URL=${RABBITMQ_URL}
      # ... other env vars
    depends_on:
      - rabbitmq

  worker-generator:
    build:
      context: .
      dockerfile: workers/Dockerfile
    environment:
      - WORKER_TYPE=generator
      - DATABASE_URL=${DATABASE_URL}
      - RABBITMQ_URL=${RABBITMQ_URL}
      # ... other env vars
    depends_on:
      - backend
      - rabbitmq

  # Repeat for other workers...

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
```

#### Vercel (Frontend Only)

The frontend can be deployed to Vercel:

```bash
cd ai-prediction-market-front-end
vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_API_URL`: Your Railway backend URL

---

## AI Market Generation Flow

### User Proposal Flow

1. **User submits proposal** via `POST /api/v1/propose`
   ```json
   {
     "proposal_text": "Will Apple release iPhone 16 before October 2024?",
     "category_hint": "product_launch"
   }
   ```

2. **Rate limiting** checks (5/min, 20/hour, 50/day per user)

3. **Duplicate detection** using pg_trgm similarity

4. **Generator Worker** creates draft market using LLM:
   - Title, description, resolution criteria
   - must_meet_all conditions
   - allowed_sources for verification
   - Confidence score

5. **Validator Worker** checks:
   - Clarity and unambiguity
   - Source reachability
   - Safety (no forbidden topics)
   - Routes to: approved, rejected, or needs_human

6. **Admin Review** (if needs_human):
   - `GET /api/v1/admin/proposals` - List pending proposals
   - `POST /api/v1/admin/proposals/:id/review` - Approve/reject

7. **Publisher Worker** deploys to Solana

### Market Resolution Flow

1. **Scheduler** detects markets past expiry

2. **Resolver Worker**:
   - Fetches evidence from allowed_sources
   - LLM evaluates must_meet_all conditions
   - Stores resolution with evidence hash
   - 24-hour dispute window starts

3. **Dispute Handling** (if disputed):
   - `POST /api/v1/disputes` - Submit dispute
   - Dispute Agent Worker reviews
   - Outcomes: upheld, overturned, or escalated

4. **Finalization** after dispute window

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/config/contracts` | Get contract configuration |
| POST | `/api/v1/propose` | Submit market proposal |
| GET | `/api/v1/proposals/:id` | Get proposal status |
| POST | `/api/trading/quote` | Get price quote |
| POST | `/api/trading/buy` | Buy tokens |
| POST | `/api/trading/sell` | Sell tokens |
| POST | `/api/trading/swap` | Execute swap |
| POST | `/api/liquidity/add` | Add liquidity |
| POST | `/api/liquidity/withdraw` | Withdraw liquidity |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/proposals` | List proposals needing review |
| GET | `/api/v1/admin/proposals/:id` | Get proposal details |
| POST | `/api/v1/admin/proposals/:id/review` | Approve/reject proposal |
| GET | `/api/v1/admin/disputes` | List disputes |
| GET | `/api/v1/admin/disputes/:id` | Get dispute details |
| POST | `/api/v1/admin/disputes/:id/review` | Review dispute |

### Markets Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/markets` | List all markets |
| GET | `/api/markets/:address` | Get market details |
| GET | `/api/markets/count` | Get total market count |

## Message Queues

| Queue | Publisher | Consumer | Purpose |
|-------|-----------|----------|---------|
| `news.raw` | Crawler | Extractor | Raw news items |
| `candidates` | Extractor/API | Generator | Market candidates |
| `drafts.validate` | Generator | Validator | Drafts for validation |
| `markets.publish` | Validator | Publisher | Approved markets |
| `markets.resolve` | Scheduler | Resolver | Markets to resolve |
| `disputes` | API | Dispute Agent | Disputes to review |
| `config.refresh` | Admin | All workers | Config updates |

## Database Schema (AI Tables)

Key tables:

- `ai_markets` - AI-generated market metadata
- `proposals` - User proposals with status tracking
- `candidates` - Market candidates from news/proposals
- `resolutions` - Market resolution records with evidence
- `disputes` - User disputes with AI/admin review
- `audit_logs` - Audit trail for all actions
- `rate_limits` - Per-user rate limiting

## Development

### Available Scripts

```bash
# Root workspace commands
pnpm install              # Install all dependencies
pnpm build:types          # Build shared types package
pnpm dev:backend          # Start backend in dev mode
pnpm dev:frontend         # Start frontend in dev mode
pnpm dev:workers          # Start all workers in dev mode
pnpm typecheck            # Run typecheck across all packages
pnpm lint                 # Run linting across all packages
pnpm test                 # Run integration tests

# Backend commands
cd prediction-market-back-end
pnpm dev                  # Start dev server with hot reload
pnpm build                # Build for production
pnpm start                # Start production server
pnpm typecheck            # Type check
pnpm lint                 # Lint code

# Workers commands
cd workers
pnpm dev:generator        # Start generator worker
pnpm dev:validator        # Start validator worker
pnpm dev:publisher        # Start publisher worker
pnpm dev:scheduler        # Start scheduler worker
pnpm build                # Build all workers
pnpm start:generator      # Start compiled generator
pnpm test:all             # Run all worker tests
```

### Run Type Checking

```bash
# Backend
cd prediction-market-back-end && pnpm typecheck

# Workers
cd workers && pnpm typecheck

# Shared types
cd packages/shared-types && pnpm typecheck
```

### Run Linting

```bash
cd prediction-market-back-end && pnpm lint
cd workers && pnpm lint
```

## Security Considerations

- **Rate Limiting**: Sliding window rate limits on proposal submission
- **Duplicate Detection**: pg_trgm similarity prevents duplicate markets
- **Evidence Hashing**: SHA-256 hash of resolution evidence for accountability
- **Audit Logging**: All major actions logged for accountability
- **DLQ Support**: Failed messages go to dead letter queue for inspection
- **Retry Logic**: Exponential backoff (1s, 5s, 30s) before DLQ

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `RABBITMQ_URL` | For AI | `amqp://localhost:5672` | RabbitMQ connection |
| `OPENAI_API_KEY` | For AI | - | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | LLM model to use |
| `PROGRAM_ID` | Yes | - | Solana program ID |
| `SOLANA_RPC_URL` | No | Devnet | Solana RPC endpoint |
| `DRY_RUN` | No | `false` | Skip on-chain transactions |
| `WORKER_TYPE` | Workers | `generator` | Worker type to run |

## Troubleshooting

### Workers not processing messages

1. Check RabbitMQ is running: `docker ps`
2. Check queue status: http://localhost:15672 (guest/guest)
3. Check worker logs for errors

### Database connection issues

1. Verify `DATABASE_URL` is correct
2. Check SSL mode for Neon: `?sslmode=require`
3. Ensure migrations have run

### LLM errors

1. Verify `OPENAI_API_KEY` is valid
2. Check rate limits on OpenAI dashboard
3. Review worker logs for specific errors

### Railway deployment issues

1. Check Railway logs: `railway logs --service <service-name>`
2. Verify all environment variables are set
3. Ensure Dockerfile paths are correct for monorepo structure

## License

MIT

## Support

For issues or questions:
- Check the backend/worker logs for detailed error messages
- Review the RabbitMQ management UI for queue status
- Ensure all required environment variables are set
- Open an issue on GitHub for bugs or feature requests
