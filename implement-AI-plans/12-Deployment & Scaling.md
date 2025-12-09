# 12. Deployment & Scaling

This document outlines deployment strategies for the AI prediction market system, including worker architecture, containerization, and scaling approaches.

---

## 12.1 Monorepo Structure

```
x402-ploymarket/
├── ai-prediction-market-front-end/   # Next.js frontend
├── prediction-market-back-end/       # Fastify backend
├── contract/                         # Anchor smart contract
├── workers/                          # NEW: AI workers
│   ├── src/
│   │   ├── crawler.ts
│   │   ├── extractor.ts
│   │   ├── generator.ts
│   │   ├── validator.ts
│   │   ├── publisher.ts
│   │   ├── resolver.ts
│   │   ├── dispute-agent.ts
│   │   ├── scheduler.ts
│   │   └── shared/
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── .env.example
├── packages/
│   └── shared-types/                 # NEW: Shared TypeScript types
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
└── package.json                      # Workspace root
```

---

## 12.2 Service Configuration

### Backend Server

```yaml
# docker-compose.yml (backend section)
backend:
  build: ./prediction-market-back-end
  ports:
    - "3001:3001"
  environment:
    - DATABASE_URL=${DATABASE_URL}
    - RABBITMQ_URL=${RABBITMQ_URL}
    - INTERNAL_JWT_SECRET=${INTERNAL_JWT_SECRET}
    - ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET}
    - SOLANA_RPC_URL=${SOLANA_RPC_URL}
  depends_on:
    - postgres
    - rabbitmq
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

### Worker Containers

Each worker runs as a separate container:

```yaml
# docker-compose.yml (workers section)
worker-crawler:
  build:
    context: ./workers
    dockerfile: Dockerfile
  command: ["node", "dist/crawler.js"]
  environment:
    - RABBITMQ_URL=${RABBITMQ_URL}
    - DATABASE_URL=${DATABASE_URL}
    - WORKER_API_KEY=${CRAWLER_API_KEY}
    - BACKEND_URL=http://backend:3001
  depends_on:
    - rabbitmq
    - backend

worker-extractor:
  build:
    context: ./workers
    dockerfile: Dockerfile
  command: ["node", "dist/extractor.js"]
  environment:
    - RABBITMQ_URL=${RABBITMQ_URL}
    - DATABASE_URL=${DATABASE_URL}
    - OPENAI_API_KEY=${OPENAI_API_KEY}
    - WORKER_API_KEY=${EXTRACTOR_API_KEY}
    - BACKEND_URL=http://backend:3001
  depends_on:
    - rabbitmq
    - backend

worker-generator:
  build:
    context: ./workers
    dockerfile: Dockerfile
  command: ["node", "dist/generator.js"]
  environment:
    - RABBITMQ_URL=${RABBITMQ_URL}
    - DATABASE_URL=${DATABASE_URL}
    - OPENAI_API_KEY=${OPENAI_API_KEY}
    - WORKER_API_KEY=${GENERATOR_API_KEY}
    - BACKEND_URL=http://backend:3001
  depends_on:
    - rabbitmq
    - backend

worker-validator:
  build:
    context: ./workers
    dockerfile: Dockerfile
  command: ["node", "dist/validator.js"]
  environment:
    - RABBITMQ_URL=${RABBITMQ_URL}
    - DATABASE_URL=${DATABASE_URL}
    - OPENAI_API_KEY=${OPENAI_API_KEY}
    - WORKER_API_KEY=${VALIDATOR_API_KEY}
    - BACKEND_URL=http://backend:3001
  depends_on:
    - rabbitmq
    - backend

worker-publisher:
  build:
    context: ./workers
    dockerfile: Dockerfile
  command: ["node", "dist/publisher.js"]
  environment:
    - RABBITMQ_URL=${RABBITMQ_URL}
    - DATABASE_URL=${DATABASE_URL}
    - SOLANA_RPC_URL=${SOLANA_RPC_URL}
    - PUBLISHER_WALLET_SECRET=${PUBLISHER_WALLET_SECRET}
    - WORKER_API_KEY=${PUBLISHER_API_KEY}
    - BACKEND_URL=http://backend:3001
  depends_on:
    - rabbitmq
    - backend

worker-resolver:
  build:
    context: ./workers
    dockerfile: Dockerfile
  command: ["node", "dist/resolver.js"]
  environment:
    - RABBITMQ_URL=${RABBITMQ_URL}
    - DATABASE_URL=${DATABASE_URL}
    - OPENAI_API_KEY=${OPENAI_API_KEY}
    - SOLANA_RPC_URL=${SOLANA_RPC_URL}
    - RESOLVER_WALLET_SECRET=${RESOLVER_WALLET_SECRET}
    - WORKER_API_KEY=${RESOLVER_API_KEY}
    - BACKEND_URL=http://backend:3001
  depends_on:
    - rabbitmq
    - backend

worker-dispute-agent:
  build:
    context: ./workers
    dockerfile: Dockerfile
  command: ["node", "dist/dispute-agent.js"]
  environment:
    - RABBITMQ_URL=${RABBITMQ_URL}
    - DATABASE_URL=${DATABASE_URL}
    - OPENAI_API_KEY=${OPENAI_API_KEY}
    - WORKER_API_KEY=${DISPUTE_AGENT_API_KEY}
    - BACKEND_URL=http://backend:3001
  depends_on:
    - rabbitmq
    - backend

worker-scheduler:
  build:
    context: ./workers
    dockerfile: Dockerfile
  command: ["node", "dist/scheduler.js"]
  environment:
    - RABBITMQ_URL=${RABBITMQ_URL}
    - DATABASE_URL=${DATABASE_URL}
    - WORKER_API_KEY=${SCHEDULER_API_KEY}
    - BACKEND_URL=http://backend:3001
  depends_on:
    - rabbitmq
    - backend
```

---

## 12.3 Infrastructure Components

### PostgreSQL

```yaml
postgres:
  image: postgres:15
  environment:
    - POSTGRES_USER=prediction
    - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    - POSTGRES_DB=prediction_market
  volumes:
    - postgres_data:/var/lib/postgresql/data
  ports:
    - "5432:5432"
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U prediction"]
    interval: 10s
    timeout: 5s
    retries: 5
```

### RabbitMQ

```yaml
rabbitmq:
  image: rabbitmq:3-management
  environment:
    - RABBITMQ_DEFAULT_USER=prediction
    - RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASSWORD}
  ports:
    - "5672:5672"   # AMQP
    - "15672:15672" # Management UI
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq
  healthcheck:
    test: ["CMD", "rabbitmq-diagnostics", "check_running"]
    interval: 30s
    timeout: 10s
    retries: 5
```

### Frontend

```yaml
frontend:
  build: ./ai-prediction-market-front-end
  ports:
    - "3000:3000"
  environment:
    - NEXT_PUBLIC_API_URL=http://localhost:3001
    - NEXT_PUBLIC_SOLANA_NETWORK=devnet
  depends_on:
    - backend
```

---

## 12.4 Worker Dockerfile

```dockerfile
# workers/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

# Health check endpoint (for workers that expose one)
EXPOSE 9090

# Default command (overridden in docker-compose)
CMD ["node", "dist/scheduler.js"]
```

---

## 12.5 Environment Files

### workers/.env.example

```env
# RabbitMQ
RABBITMQ_URL=amqp://prediction:password@localhost:5672

# Database
DATABASE_URL=postgresql://prediction:password@localhost:5432/prediction_market

# OpenAI (for workers that need it)
OPENAI_API_KEY=sk-...

# Backend API
BACKEND_URL=http://localhost:3001

# Worker API Key (unique per worker type)
WORKER_API_KEY=worker-api-key-here

# Solana (for publisher/resolver)
SOLANA_RPC_URL=https://api.devnet.solana.com
PUBLISHER_WALLET_SECRET=base58-encoded-secret
RESOLVER_WALLET_SECRET=base58-encoded-secret

# Health check port
HEALTH_PORT=9090

# Logging
LOG_LEVEL=info
SERVICE_NAME=worker-generator
```

---

## 12.6 Horizontal Scaling

### Worker Scaling

Workers can scale independently based on queue depth:

```yaml
# docker-compose.scale.yml
version: "3.8"
services:
  worker-generator:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: "1"
          memory: 512M
        reservations:
          cpus: "0.5"
          memory: 256M
```

Scale command:
```bash
docker-compose up -d --scale worker-generator=3 --scale worker-resolver=2
```

### Queue-Based Auto-Scaling

Monitor queue depth and scale workers accordingly:

```typescript
// scripts/auto-scale.ts
async function checkAndScale() {
  const queues = ['candidates', 'drafts.validate', 'markets.publish', 'markets.resolve'];

  for (const queue of queues) {
    const { messageCount } = await channel.checkQueue(queue);

    if (messageCount > 100) {
      // Scale up
      await scaleWorker(getWorkerName(queue), 'up');
    } else if (messageCount < 10) {
      // Scale down (minimum 1)
      await scaleWorker(getWorkerName(queue), 'down');
    }
  }
}
```

### API Server Scaling

Backend can run multiple instances behind a load balancer:

```yaml
backend:
  deploy:
    replicas: 2
    resources:
      limits:
        cpus: "2"
        memory: 1G
```

---

## 12.7 Kubernetes Deployment

For production, use Kubernetes for better orchestration:

### Worker Deployment

```yaml
# k8s/worker-generator-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker-generator
spec:
  replicas: 2
  selector:
    matchLabels:
      app: worker-generator
  template:
    metadata:
      labels:
        app: worker-generator
    spec:
      containers:
        - name: generator
          image: x402/worker:latest
          command: ["node", "dist/generator.js"]
          envFrom:
            - secretRef:
                name: worker-secrets
            - configMapRef:
                name: worker-config
          resources:
            requests:
              cpu: "500m"
              memory: "256Mi"
            limits:
              cpu: "1000m"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /health
              port: 9090
            initialDelaySeconds: 30
            periodSeconds: 30
```

### HorizontalPodAutoscaler

```yaml
# k8s/worker-generator-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-generator-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: worker-generator
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: External
      external:
        metric:
          name: rabbitmq_queue_messages
          selector:
            matchLabels:
              queue: candidates
        target:
          type: AverageValue
          averageValue: "50"
```

---

## 12.8 Database Configuration

### Connection Pooling

```typescript
// workers/src/shared/db.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                    // Max connections per worker
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000
});
```

### Read Replicas (Production)

For high-read workloads:

```typescript
// Use read replica for queries, primary for writes
const readPool = new Pool({ connectionString: process.env.DATABASE_READ_URL });
const writePool = new Pool({ connectionString: process.env.DATABASE_URL });
```

---

## 12.9 CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker images
        run: |
          docker build -t x402/backend:${{ github.sha }} ./prediction-market-back-end
          docker build -t x402/frontend:${{ github.sha }} ./ai-prediction-market-front-end
          docker build -t x402/worker:${{ github.sha }} ./workers
          docker push x402/backend:${{ github.sha }}
          docker push x402/frontend:${{ github.sha }}
          docker push x402/worker:${{ github.sha }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/backend backend=x402/backend:${{ github.sha }}
          kubectl set image deployment/frontend frontend=x402/frontend:${{ github.sha }}
          kubectl set image deployment/worker-generator generator=x402/worker:${{ github.sha }}
          # ... other workers
```

---

## 12.10 Monitoring Setup

### Prometheus Metrics

```yaml
# k8s/prometheus-config.yaml
scrape_configs:
  - job_name: 'workers'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: worker-.*
        action: keep
```

### Grafana Dashboard

Key panels:
1. Queue depths (all queues)
2. Worker processing times
3. LLM API latency
4. Resolution success rate
5. Active workers by type
6. Error rates by service

---

## 12.11 Disaster Recovery

### Database Backups

```bash
# Daily automated backup
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d).sql.gz

# Upload to S3
aws s3 cp backup_$(date +%Y%m%d).sql.gz s3://x402-backups/
```

### RabbitMQ Persistence

RabbitMQ queues are configured as durable with persistent messages:

```typescript
await channel.assertQueue(queueName, {
  durable: true,
  arguments: {
    'x-queue-type': 'quorum'  // High availability
  }
});
```

### Recovery Procedure

1. Restore PostgreSQL from backup
2. RabbitMQ messages recover automatically (durable queues)
3. Re-process any failed messages from DLQ
4. Verify worker connectivity

---

## 12.12 Local Development

### Quick Start

```bash
# 1. Start infrastructure
docker-compose up -d postgres rabbitmq

# 2. Run migrations
cd prediction-market-back-end && pnpm migrate

# 3. Start backend
cd prediction-market-back-end && pnpm dev

# 4. Start workers (in separate terminals)
cd workers && pnpm dev:generator
cd workers && pnpm dev:validator
# ... etc

# 5. Start frontend
cd ai-prediction-market-front-end && pnpm dev
```

### Development Docker Compose

```yaml
# docker-compose.dev.yml
version: "3.8"
services:
  postgres:
    image: postgres:15
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_PASSWORD=devpassword
      - POSTGRES_DB=prediction_market

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=dev
      - RABBITMQ_DEFAULT_PASS=devpassword
```
