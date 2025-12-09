# 10. Security, Rate Limits & Governance

This document defines security measures, rate limiting, and governance for the AI prediction market system.

---

## Rate Limiting

### User Rate Limits

| Endpoint | Per Minute | Per Hour | Per Day | Identifier |
|----------|------------|----------|---------|------------|
| `POST /api/v1/propose` | 3 | 20 | 100 | User ID or IP |
| `POST /api/v1/disputes` | - | 5 | 20 | User ID |
| `GET /api/v1/markets` | 60 | 1000 | - | IP |

### Implementation

```typescript
// prediction-market-back-end/src/middleware/rate-limit.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client';

interface RateLimitConfig {
  perMinute?: number;
  perHour?: number;
  perDay?: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/v1/propose': { perMinute: 3, perHour: 20, perDay: 100 },
  '/api/v1/disputes': { perHour: 5, perDay: 20 }
};

export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const path = request.routerPath;
  const config = RATE_LIMITS[path];

  if (!config) return;

  const identifier = request.user?.id || request.ip;

  // Check each window
  for (const [window, limit] of Object.entries(config)) {
    if (!limit) continue;

    const windowType = window.replace('per', '').toLowerCase();
    const count = await getRequestCount(identifier, path, windowType);

    if (count >= limit) {
      const retryAfter = getRetryAfter(windowType);
      reply.header('Retry-After', retryAfter);
      reply.status(429).send({
        error: 'rate_limit_exceeded',
        message: `You have exceeded the ${windowType} limit for this endpoint.`,
        retry_after: retryAfter
      });
      return;
    }
  }

  // Increment counters
  await incrementRequestCount(identifier, path);
}

async function getRequestCount(
  identifier: string,
  endpoint: string,
  windowType: string
): Promise<number> {
  const result = await db.query(`
    SELECT COALESCE(SUM(count), 0) as total
    FROM rate_limits
    WHERE identifier = $1
      AND endpoint = $2
      AND window_type = $3
      AND window_start > NOW() - INTERVAL '1 ${windowType}'
  `, [identifier, endpoint, windowType]);

  return parseInt(result.rows[0].total);
}

async function incrementRequestCount(
  identifier: string,
  endpoint: string
): Promise<void> {
  const windows = ['minute', 'hour', 'day'];

  for (const window of windows) {
    await db.query(`
      INSERT INTO rate_limits (identifier, endpoint, window_start, window_type, count)
      VALUES ($1, $2, date_trunc($3, NOW()), $3, 1)
      ON CONFLICT (identifier, endpoint, window_start, window_type)
      DO UPDATE SET count = rate_limits.count + 1
    `, [identifier, endpoint, window]);
  }
}
```

---

## Worker Authentication

### API Key Management

Workers authenticate using API keys stored in the database (hashed).

```typescript
// Workers request JWT tokens using API keys
// prediction-market-back-end/src/routes/v1/auth/worker-token.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../../db/client';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export async function getWorkerToken(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const apiKey = request.headers['x-worker-api-key'] as string;
  const workerType = request.headers['x-worker-type'] as string;

  if (!apiKey || !workerType) {
    return reply.status(401).send({ error: 'Missing API key or worker type' });
  }

  // Hash the API key for comparison
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Look up in database
  const result = await db.query(`
    SELECT id, worker_type, permissions
    FROM worker_api_keys
    WHERE api_key_hash = $1
      AND worker_type = $2
      AND active = true
      AND (expires_at IS NULL OR expires_at > NOW())
  `, [keyHash, workerType]);

  if (result.rows.length === 0) {
    return reply.status(401).send({ error: 'Invalid API key' });
  }

  const worker = result.rows[0];

  // Generate short-lived JWT (5-15 min)
  const token = jwt.sign(
    {
      sub: worker.id,
      type: 'worker',
      worker_type: workerType,
      permissions: worker.permissions
    },
    process.env.INTERNAL_JWT_SECRET!,
    { expiresIn: '15m' }
  );

  // Update last used
  await db.query(
    `UPDATE worker_api_keys SET last_used_at = NOW() WHERE id = $1`,
    [worker.id]
  );

  return reply.send({
    token,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    worker_type: workerType,
    permissions: worker.permissions
  });
}
```

### Worker Permissions

| Worker | Permissions |
|--------|-------------|
| Crawler | `ingest_news`, `read_config` |
| Extractor | `read_news`, `create_candidate`, `read_config` |
| Generator | `read_candidate`, `create_draft`, `read_config`, `call_llm` |
| Validator | `read_draft`, `update_draft`, `create_validation`, `read_config`, `call_llm` |
| Publisher | `read_draft`, `publish_market`, `update_market`, `read_config` |
| Resolver | `read_market`, `resolve_market`, `update_market`, `read_config`, `call_llm` |
| Dispute Agent | `read_dispute`, `update_dispute`, `read_market`, `read_config`, `call_llm` |

---

## Prompt Injection Protection

### Pre-Filtering

```typescript
// workers/src/shared/security/prompt-filter.ts

const DANGEROUS_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /forget\s+(everything|all)/i,
  /you\s+are\s+now/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<\|system\|>/i,
  /<\|user\|>/i,
  /pretend\s+you\s+are/i,
  /act\s+as\s+if/i,
  /disregard\s+(the\s+)?(above|previous)/i
];

const FORBIDDEN_CONTENT = [
  /\b(kill|murder|assassinate|bomb|terror)\b/i,
  /\b(drug|cocaine|heroin|meth)\s+(deal|sell|buy)/i,
  /\b(child|minor)\s+(abuse|exploit)/i
];

export function filterProposalText(text: string): {
  safe: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for prompt injection
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(text)) {
      issues.push('Potential prompt injection detected');
      break;
    }
  }

  // Check for forbidden content
  for (const pattern of FORBIDDEN_CONTENT) {
    if (pattern.test(text)) {
      issues.push('Forbidden content detected');
      break;
    }
  }

  return {
    safe: issues.length === 0,
    issues
  };
}
```

### LLM Safety Verification

Run a secondary LLM check before processing (see 6-Prompt Templates.md for safety_check prompt).

---

## Threat Defenses

### 1. Market Manipulation Prevention

Only deterministic markets allowed:
- Self-referential markets are rejected
- Markets controllable by single person are rejected
- All sources must be official and HTTPS

### 2. Evidence Hashing

All resolution evidence is hashed (SHA-256) and stored for audit.

### 3. Dispute Window Protection

- 24-hour dispute window after resolution (contract handles on-chain)
- Claims paused during dispute window
- Only token holders can dispute
- AI reviews disputes before admin escalation

---

## Admin Authentication

### JWT Structure

```typescript
interface AdminJWT {
  sub: string;           // User ID
  type: 'admin';
  role: 'admin' | 'super_admin';
  permissions: string[];
  iat: number;
  exp: number;
}
```

### Admin Middleware

```typescript
// prediction-market-back-end/src/middleware/admin-auth.ts

export async function adminAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const token = request.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return reply.status(401).send({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as AdminJWT;

    if (decoded.type !== 'admin') {
      return reply.status(403).send({ error: 'Not an admin token' });
    }

    request.admin = decoded;
  } catch (error) {
    return reply.status(401).send({ error: 'Invalid token' });
  }
}
```

---

## Audit Logging

All sensitive operations are logged to `audit_logs` table:

| Action | Entity Type | Logged Data |
|--------|-------------|-------------|
| `proposal_submitted` | proposal | User ID, text, IP |
| `draft_generated` | market | Source, confidence |
| `validation_completed` | market | Decision, reason |
| `market_published` | market | TX signature, address |
| `resolution_started` | resolution | Market, source |
| `resolution_completed` | resolution | Result, evidence hash |
| `dispute_submitted` | dispute | User, reason |
| `dispute_resolved` | dispute | Decision, reviewer |
| `admin_action` | various | Admin ID, action |

---

## API Key Rotation

Worker API keys should be rotated monthly:

```typescript
// Script: scripts/rotate-worker-keys.ts

async function rotateWorkerKeys(): Promise<void> {
  const workers = ['crawler', 'extractor', 'generator', 'validator', 'publisher', 'resolver', 'dispute_agent'];

  for (const worker of workers) {
    // Generate new key
    const newKey = crypto.randomBytes(32).toString('hex');
    const newHash = crypto.createHash('sha256').update(newKey).digest('hex');

    // Deactivate old key (don't delete for audit)
    await db.query(`
      UPDATE worker_api_keys
      SET active = false
      WHERE worker_type = $1 AND active = true
    `, [worker]);

    // Create new key
    await db.query(`
      INSERT INTO worker_api_keys (worker_type, api_key_hash, permissions, active)
      VALUES ($1, $2, $3, true)
    `, [worker, newHash, getWorkerPermissions(worker)]);

    console.log(`${worker}: ${newKey}`);
  }
}
```

---

## Security Checklist

### Pre-Deployment

- [ ] All API keys are stored securely (not in code)
- [ ] HTTPS is enforced for all endpoints
- [ ] Rate limiting is configured
- [ ] CORS is restricted to frontend domain
- [ ] Admin JWT secret is separate from worker JWT secret
- [ ] Database has proper access controls
- [ ] RabbitMQ requires authentication

### Ongoing

- [ ] Monitor rate limit violations
- [ ] Review audit logs weekly
- [ ] Rotate worker API keys monthly
- [ ] Review dispute escalations
- [ ] Monitor for unusual proposal patterns
