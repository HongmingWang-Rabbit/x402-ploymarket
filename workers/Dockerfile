# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types ./packages/shared-types
COPY workers ./workers

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared-types first, then workers
RUN pnpm --filter @x402/shared-types build
RUN pnpm --filter workers build

# Production stage
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY workers/package.json ./workers/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/workers/dist ./workers/dist

WORKDIR /app/workers

# Default to generator worker - override with WORKER_TYPE env var
ENV WORKER_TYPE=generator

# Use shell form to allow variable expansion
CMD node dist/${WORKER_TYPE}.js
