# 11. Logging, Monitoring & Testing

This document describes system observability, error tracking, performance metrics, and testing strategy.

---

## 11.1 Logging

### Log Levels

| Level | Usage |
|-------|-------|
| `error` | Unrecoverable errors, failed operations |
| `warn` | Recoverable issues, rate limits, retries |
| `info` | Normal operations, state changes |
| `debug` | Detailed debugging (development only) |

### Structured Logging

```typescript
// workers/src/shared/logger.ts

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  base: {
    service: process.env.SERVICE_NAME,
    version: process.env.npm_package_version
  }
});

// Usage
logger.info({ proposalId, userId }, 'Proposal submitted');
logger.error({ error, marketId }, 'Resolution failed');
```

### Log Categories

#### Event Logs
- User submissions
- AI draft generation
- Validations
- Publishing
- Resolutions

```typescript
// Log format
{
  "level": "info",
  "time": "2024-06-01T12:00:00.000Z",
  "service": "generator",
  "action": "draft_generated",
  "entity_type": "market",
  "entity_id": "uuid",
  "duration_ms": 1234,
  "confidence_score": 0.85
}
```

#### Error Logs
- Stack traces
- API failures
- Resolution inconsistencies

```typescript
{
  "level": "error",
  "time": "2024-06-01T12:00:00.000Z",
  "service": "resolver",
  "action": "resolution_failed",
  "market_id": "uuid",
  "error": "Source unreachable",
  "retry_count": 3,
  "stack": "..."
}
```

#### Audit Logs
- Stored in database `audit_logs` table
- Immutable record of all decisions
- Linked to proposal/market IDs

---

## 11.2 Monitoring

### Worker Health

```typescript
// workers/src/shared/health.ts

import express from 'express';

const healthApp = express();
const PORT = process.env.HEALTH_PORT || 9090;

let isHealthy = true;
let lastProcessed = Date.now();

healthApp.get('/health', (req, res) => {
  const stale = Date.now() - lastProcessed > 5 * 60 * 1000; // 5 min

  if (!isHealthy || stale) {
    res.status(503).json({ status: 'unhealthy', stale });
  } else {
    res.json({ status: 'healthy', lastProcessed });
  }
});

healthApp.get('/ready', (req, res) => {
  // Check dependencies
  const ready = isConnectedToDb && isConnectedToQueue;
  res.status(ready ? 200 : 503).json({ ready });
});

healthApp.listen(PORT);
```

### Queue Monitoring

```typescript
// Monitor queue lengths
async function monitorQueues() {
  const queues = ['news.raw', 'candidates', 'drafts.validate', 'markets.publish', 'markets.resolve', 'disputes'];

  for (const queue of queues) {
    const { messageCount, consumerCount } = await channel.checkQueue(queue);

    metrics.gauge(`queue.${queue}.messages`, messageCount);
    metrics.gauge(`queue.${queue}.consumers`, consumerCount);

    // Alert if queue is backing up
    if (messageCount > 100) {
      logger.warn({ queue, messageCount }, 'Queue backlog detected');
    }
  }
}

setInterval(monitorQueues, 60000); // Every minute
```

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `queue.*.messages` | Queue message count | > 100 |
| `queue.*.consumers` | Active consumers | < 1 |
| `worker.processing_time` | Message processing duration | > 30s |
| `llm.latency` | OpenAI API latency | > 10s |
| `resolution.success_rate` | Resolution success percentage | < 95% |
| `proposal.approval_rate` | Proposals approved by AI | Track trend |

### Alerting

```yaml
# Example alerting rules (Prometheus/Grafana)
groups:
  - name: prediction-market
    rules:
      - alert: QueueBacklog
        expr: queue_messages > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Queue {{ $labels.queue }} has {{ $value }} messages"

      - alert: WorkerDown
        expr: up{job="worker"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Worker {{ $labels.instance }} is down"

      - alert: ResolutionFailureRate
        expr: rate(resolution_failures[5m]) > 0.05
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High resolution failure rate"
```

---

## 11.3 Analytics

### Market Metrics

```sql
-- Active markets by category
SELECT category, COUNT(*)
FROM ai_markets
WHERE status = 'active'
GROUP BY category;

-- Average confidence score
SELECT AVG(confidence_score) as avg_confidence
FROM ai_markets
WHERE created_at > NOW() - INTERVAL '7 days';

-- Resolution success rate
SELECT
  COUNT(*) FILTER (WHERE status = 'finalized') as successful,
  COUNT(*) FILTER (WHERE status IN ('resolved', 'finalized', 'disputed')) as total,
  COUNT(*) FILTER (WHERE status = 'finalized')::float /
    COUNT(*) FILTER (WHERE status IN ('resolved', 'finalized', 'disputed')) as success_rate
FROM resolutions;
```

### User Engagement

```sql
-- Proposals per day
SELECT DATE(created_at), COUNT(*)
FROM proposals
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at);

-- Approval/rejection rate
SELECT
  status,
  COUNT(*),
  COUNT(*)::float / SUM(COUNT(*)) OVER () as percentage
FROM proposals
WHERE status IN ('approved', 'rejected', 'needs_human')
GROUP BY status;
```

### System Performance

```typescript
// Track LLM latency
const startTime = Date.now();
const result = await callLLM('market_generation', input);
const latency = Date.now() - startTime;

metrics.histogram('llm.latency', latency, { prompt_type: 'market_generation' });
```

---

## 11.4 Dashboard

### Metrics Dashboard (Grafana)

**Panels:**
1. Active workers status (up/down)
2. Queue lengths over time
3. Proposals submitted per hour
4. AI validation decisions (pie chart)
5. Resolution success rate
6. LLM latency percentiles (p50, p95, p99)
7. Error rate by service

### Admin Dashboard (Frontend)

**Path**: `/admin/ai-config`

Display:
- Current `ai_version`
- Markets created today
- Proposals pending review
- Recent resolutions
- Active disputes

---

## 11.5 Testing Strategy

### Unit Tests

```typescript
// workers/src/__tests__/generator.test.ts

import { generateDraftMarket } from '../generator';

describe('Generator Worker', () => {
  it('generates valid market JSON from candidate', async () => {
    const candidate = {
      entities: ['Apple', 'iPhone 16'],
      event_type: 'product_launch',
      category_hint: 'product_launch',
      relevant_text: 'Apple announces iPhone 16...'
    };

    const draft = await generateDraftMarket(candidate);

    expect(draft.title).toBeDefined();
    expect(draft.resolution.type).toBe('binary');
    expect(draft.resolution.criteria.must_meet_all.length).toBeGreaterThan(0);
    expect(draft.resolution.criteria.allowed_sources.length).toBeGreaterThan(0);
  });

  it('rejects proposals about violence', async () => {
    const result = filterProposalText('Will the assassination succeed?');
    expect(result.safe).toBe(false);
    expect(result.issues).toContain('Forbidden content detected');
  });
});
```

### Mock Data

```typescript
// workers/src/__tests__/fixtures/mock-sources.ts

export const MOCK_SOURCES = {
  'https://www.apple.com/shop/buy-iphone': `
    <html>
      <div class="product-tile">
        <h2>iPhone 16</h2>
        <button class="buy-button">Buy</button>
      </div>
    </html>
  `,
  'https://www.apple.com/newsroom': `
    <html>
      <article>
        <h1>Apple Announces iPhone 16</h1>
        <time>September 10, 2024</time>
      </article>
    </html>
  `
};

// Mock HTTP client for tests
jest.mock('../shared/http', () => ({
  fetchUrl: jest.fn((url) => MOCK_SOURCES[url] || '<html>Not found</html>')
}));
```

### Integration Tests

```typescript
// workers/src/__tests__/integration/full-flow.test.ts

describe('Full Proposal Flow', () => {
  let localValidator: TestValidator;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    localValidator = await startTestValidator();
  });

  afterAll(async () => {
    await testDb.cleanup();
    await localValidator.stop();
  });

  it('processes proposal end-to-end', async () => {
    // 1. Submit proposal
    const response = await api.post('/api/v1/propose', {
      proposal_text: 'Will Apple release iPhone 16 in September 2024?',
      category_hint: 'product_launch'
    });

    expect(response.status).toBe(200);
    expect(response.data.proposal_id).toBeDefined();

    // 2. Wait for processing
    await waitFor(() => {
      const proposal = testDb.getProposal(response.data.proposal_id);
      return proposal.status !== 'processing';
    }, { timeout: 30000 });

    // 3. Verify draft was created
    const proposal = await testDb.getProposal(response.data.proposal_id);
    expect(proposal.status).toBe('approved');
    expect(proposal.draft_market_id).toBeDefined();

    // 4. Verify draft structure
    const draft = await testDb.getDraft(proposal.draft_market_id);
    expect(draft.resolution.criteria.must_meet_all.length).toBeGreaterThan(0);
    expect(draft.validation_decision.status).toBe('approved');
  });
});
```

### Deterministic Resolution Tests

```typescript
// workers/src/__tests__/resolver.test.ts

describe('Resolver Worker', () => {
  const testCases = [
    {
      name: 'iPhone available - YES',
      market: IPHONE_MARKET_FIXTURE,
      source_content: '<button class="buy-button">Buy iPhone 16</button>',
      expected_result: 'YES'
    },
    {
      name: 'iPhone pre-order only - NO',
      market: IPHONE_MARKET_FIXTURE,
      source_content: '<button class="preorder-button">Pre-order iPhone 16</button>',
      expected_result: 'NO'
    },
    {
      name: 'No iPhone 16 mentioned - NO',
      market: IPHONE_MARKET_FIXTURE,
      source_content: '<button class="buy-button">Buy iPhone 15</button>',
      expected_result: 'NO'
    }
  ];

  test.each(testCases)('$name', async ({ market, source_content, expected_result }) => {
    mockFetch(market.resolution.criteria.allowed_sources[0].url, source_content);

    const result = await resolveMarket(market);

    expect(result.final_result).toBe(expected_result);
  });

  it('produces same result for same input', async () => {
    const market = IPHONE_MARKET_FIXTURE;
    const content = '<button class="buy-button">Buy iPhone 16</button>';

    mockFetch(market.resolution.criteria.allowed_sources[0].url, content);

    const result1 = await resolveMarket(market);
    const result2 = await resolveMarket(market);

    expect(result1.final_result).toBe(result2.final_result);
    expect(result1.must_meet_all_results).toEqual(result2.must_meet_all_results);
  });
});
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
      rabbitmq:
        image: rabbitmq:3
        ports:
          - 5672:5672

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test:unit

      - name: Run integration tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/test
          RABBITMQ_URL: amqp://localhost:5672
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY_TEST }}
```
