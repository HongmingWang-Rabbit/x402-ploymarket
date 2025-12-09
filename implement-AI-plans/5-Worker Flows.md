# 5. Worker Flows

This document describes the detailed operations for each worker component, including message handling, retry logic, and error handling.

---

## Worker Architecture Overview

All workers are separate Node.js processes that:
1. Connect to RabbitMQ for message queuing
2. Connect to PostgreSQL for data persistence
3. Authenticate with the API server via JWT
4. Process messages asynchronously

```
┌─────────────────────────────────────────────────────────────────┐
│                         Worker Process                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │
│  │  RabbitMQ   │   │ PostgreSQL  │   │   OpenAI    │           │
│  │  Consumer   │   │   Client    │   │   Client    │           │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘           │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Message Handler                       │   │
│  │  1. Receive message from queue                          │   │
│  │  2. Validate message schema                             │   │
│  │  3. Process (DB read/write, LLM call, etc.)            │   │
│  │  4. Publish result to next queue                        │   │
│  │  5. Acknowledge message                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Error Handler                         │   │
│  │  - Retry with exponential backoff (1s, 5s, 30s)        │   │
│  │  - Move to DLQ after 3 failures                         │   │
│  │  - Log errors with context                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5.1 Crawler Worker

**Purpose**: Collect news from official sources for market candidate extraction.

**Initial Scope**: Minimal - manual ingest API + basic RSS polling.

### Input
- RSS feed URLs (configured in database)
- Manual ingest via admin API

### Output
- Messages to `news.raw` queue

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Crawler Worker                          │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │  RSS Poller │    │  Manual API │    │  (Future)   │
    │  (Cron 15m) │    │  Webhook    │    │  Social API │
    └──────┬──────┘    └──────┬──────┘    └─────────────┘
           │                  │
           ▼                  ▼
    ┌─────────────────────────────────────────────────────┐
    │  1. Fetch content                                   │
    │  2. Normalize (title, content, timestamp, source)   │
    │  3. Compute content_hash (SHA-256)                  │
    │  4. Check for duplicates in DB                      │
    │  5. If new: Insert to news_items table              │
    │  6. Publish to news.raw queue                       │
    └─────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Queue:         │
                    │  news.raw       │
                    └─────────────────┘
```

### Code Structure

```typescript
// workers/src/crawler.ts

import { connectQueue, publishMessage } from './shared/queue';
import { db } from './shared/db';
import { NewsRawMessage } from '@x402/shared-types';
import Parser from 'rss-parser';
import crypto from 'crypto';

const RSS_POLL_INTERVAL = 15 * 60 * 1000; // 15 minutes

async function pollRSSFeeds() {
  const feeds = await db.query('SELECT * FROM rss_feeds WHERE active = true');
  const parser = new Parser();

  for (const feed of feeds) {
    try {
      const result = await parser.parseURL(feed.url);

      for (const item of result.items) {
        const contentHash = crypto
          .createHash('sha256')
          .update(item.title + item.content)
          .digest('hex');

        // Check for duplicates
        const existing = await db.query(
          'SELECT id FROM news_items WHERE content_hash = $1',
          [contentHash]
        );

        if (existing.rows.length > 0) continue;

        // Insert new item
        const newsId = await db.query(
          `INSERT INTO news_items (source, source_url, title, content, published_at, content_hash, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'ingested')
           RETURNING id`,
          [feed.name, item.link, item.title, item.content, item.pubDate, contentHash]
        );

        // Publish to queue
        const message: NewsRawMessage = {
          news_id: newsId.rows[0].id,
          source: feed.name,
          url: item.link,
          title: item.title,
          content: item.content || '',
          published_at: item.pubDate
        };

        await publishMessage('news.raw', message);
      }
    } catch (error) {
      console.error(`Failed to poll ${feed.url}:`, error);
    }
  }
}

// Start polling
setInterval(pollRSSFeeds, RSS_POLL_INTERVAL);
pollRSSFeeds(); // Initial poll
```

---

## 5.2 Extractor Worker

**Purpose**: Identify market-worthy events and extract entities from news items.

### Input
- `news.raw` queue

### Output
- Messages to `candidates` queue
- Updates to `news_items` table

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Extractor Worker                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Queue:         │
                    │  news.raw       │
                    └────────┬────────┘
                             │
                             ▼
    ┌─────────────────────────────────────────────────────┐
    │  1. Receive NewsRawMessage                          │
    │  2. Apply NLP to extract:                           │
    │     - Named entities (companies, products, people)  │
    │     - Event type (product_launch, earnings, etc.)   │
    │     - Category hint                                 │
    │  3. Filter: Is this suitable for a market?          │
    │     - Has clear event with date/deadline            │
    │     - Has official source potential                 │
    │     - Not forbidden topic                           │
    │  4. If suitable: Create candidate record            │
    │  5. Publish to candidates queue                     │
    │  6. Update news_items status to 'extracted'         │
    │  7. ACK message                                     │
    └─────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Queue:         │
                    │  candidates     │
                    └─────────────────┘
```

### Entity Extraction (Simple NLP)

For initial implementation, use rule-based extraction + LLM fallback:

```typescript
// workers/src/extractor.ts

import { consumeQueue, publishMessage } from './shared/queue';
import { callLLM } from './shared/llm';
import { NewsRawMessage, CandidateMessage, MarketCategory } from '@x402/shared-types';

const EVENT_KEYWORDS = {
  product_launch: ['launch', 'release', 'announce', 'unveil', 'introduce'],
  earnings: ['earnings', 'quarterly', 'revenue', 'profit', 'financial results'],
  politics: ['election', 'vote', 'senate', 'congress', 'president'],
  sports: ['championship', 'finals', 'tournament', 'match', 'game'],
  // ...
};

async function extractCandidate(message: NewsRawMessage): Promise<CandidateMessage | null> {
  // Simple keyword-based event detection
  const text = `${message.title} ${message.content}`.toLowerCase();

  let eventType: string | null = null;
  let categoryHint: MarketCategory = 'misc';

  for (const [type, keywords] of Object.entries(EVENT_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      eventType = type;
      categoryHint = type as MarketCategory;
      break;
    }
  }

  if (!eventType) {
    // Use LLM for complex cases
    const llmResponse = await callLLM('extractor', {
      title: message.title,
      content: message.content
    });

    if (!llmResponse.is_market_worthy) {
      return null;
    }

    eventType = llmResponse.event_type;
    categoryHint = llmResponse.category;
  }

  // Extract entities using LLM
  const entities = await callLLM('entity_extraction', {
    title: message.title,
    content: message.content
  });

  return {
    candidate_id: crypto.randomUUID(),
    news_id: message.news_id,
    entities: entities.entities,
    event_type: eventType,
    category_hint: categoryHint,
    relevant_text: message.content.slice(0, 500)
  };
}

// Start consumer
consumeQueue('news.raw', async (message: NewsRawMessage) => {
  const candidate = await extractCandidate(message);

  if (candidate) {
    // Save to DB
    await db.query(
      `INSERT INTO candidates (id, news_id, entities, event_type, category_hint, relevant_text)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [candidate.candidate_id, candidate.news_id, candidate.entities,
       candidate.event_type, candidate.category_hint, candidate.relevant_text]
    );

    // Publish to next queue
    await publishMessage('candidates', candidate);
  }

  // Update news status
  await db.query(
    `UPDATE news_items SET status = $1, processed_at = NOW() WHERE id = $2`,
    [candidate ? 'extracted' : 'skipped', message.news_id]
  );
});
```

---

## 5.3 Generator Worker

**Purpose**: Create draft market JSON from candidates or user proposals using LLM.

### Input
- `candidates` queue (from news)
- Direct API calls (from user proposals)

### Output
- Messages to `drafts.validate` queue
- Draft market records in database

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Generator Worker                         │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┴──────────────────┐
           │                                     │
           ▼                                     ▼
    ┌─────────────┐                       ┌─────────────┐
    │  Queue:     │                       │  API Call   │
    │  candidates │                       │  (Proposal) │
    └──────┬──────┘                       └──────┬──────┘
           │                                     │
           └──────────────────┬──────────────────┘
                              │
                              ▼
    ┌─────────────────────────────────────────────────────┐
    │  1. Receive candidate/proposal                      │
    │  2. Build LLM prompt with:                          │
    │     - Source text/entities                          │
    │     - Category                                      │
    │     - Market JSON schema                            │
    │     - Rules for deterministic resolution            │
    │  3. Call LLM (gpt-3.5-turbo)                       │
    │  4. Parse and validate JSON response                │
    │  5. Estimate initial probability                    │
    │  6. Calculate confidence score                      │
    │  7. Save draft market to DB                         │
    │  8. Publish to drafts.validate queue                │
    │  9. ACK message                                     │
    └─────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Queue:         │
                    │  drafts.validate│
                    └─────────────────┘
```

### LLM Prompt Structure

See [6-Prompt Templates.md](./6-Prompt%20Templates.md) for full prompt.

```typescript
// workers/src/generator.ts

import { consumeQueue, publishMessage } from './shared/queue';
import { callLLM } from './shared/llm';
import { CandidateMessage, DraftValidateMessage, AIMarketMetadata } from '@x402/shared-types';
import { getAIConfig } from './shared/config';

async function generateDraftMarket(candidate: CandidateMessage): Promise<AIMarketMetadata> {
  const config = await getAIConfig();

  const llmResponse = await callLLM('market_generation', {
    entities: candidate.entities,
    event_type: candidate.event_type,
    category: candidate.category_hint,
    relevant_text: candidate.relevant_text,
    ai_version: config.ai_version
  });

  // Validate response matches schema
  const draftMarket: AIMarketMetadata = {
    id: crypto.randomUUID(),
    market_address: null,
    title: llmResponse.title,
    description: llmResponse.description,
    category: candidate.category_hint,
    ai_version: config.ai_version,
    confidence_score: llmResponse.confidence_score,
    source_news_id: candidate.news_id,
    resolution: llmResponse.resolution,
    status: 'draft',
    created_at: new Date().toISOString(),
    created_by: 'generator_worker_v1'
  };

  return draftMarket;
}

// Start consumer
consumeQueue('candidates', async (message: CandidateMessage) => {
  const draft = await generateDraftMarket(message);

  // Save to DB
  await db.query(
    `INSERT INTO ai_markets (id, title, description, category, ai_version, confidence_score,
     source_news_id, resolution, status, created_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [draft.id, draft.title, draft.description, draft.category, draft.ai_version,
     draft.confidence_score, draft.source_news_id, JSON.stringify(draft.resolution),
     draft.status, draft.created_at, draft.created_by]
  );

  // Update candidate
  await db.query(
    `UPDATE candidates SET processed = true, draft_market_id = $1 WHERE id = $2`,
    [draft.id, message.candidate_id]
  );

  // Publish to validation queue
  const validateMessage: DraftValidateMessage = {
    draft_market_id: draft.id,
    source_type: 'news',
    source_id: message.news_id
  };

  await publishMessage('drafts.validate', validateMessage);
});
```

---

## 5.4 Validator Worker

**Purpose**: Check draft markets for completeness, clarity, and compliance.

### Input
- `drafts.validate` queue

### Output
- `approved` → `markets.publish` queue
- `rejected` → Update DB status
- `needs_human` → Update DB status (admin review)

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Validator Worker                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Queue:         │
                    │  drafts.validate│
                    └────────┬────────┘
                             │
                             ▼
    ┌─────────────────────────────────────────────────────┐
    │  1. Fetch draft market from DB                      │
    │  2. Run deterministic checks:                       │
    │     - All required fields present                   │
    │     - Expiry is in the future                       │
    │     - At least one allowed_source                   │
    │     - allowed_sources are reachable (HTTP HEAD)     │
    │     - Category is valid                             │
    │  3. Check for duplicate markets (similarity > 0.9)  │
    │  4. Run LLM validation:                             │
    │     - Ambiguity check                               │
    │     - Fairness check                                │
    │     - Safety check (forbidden topics)               │
    │  5. Compute final decision                          │
    │  6. Save validation record to DB                    │
    │  7. Route based on decision                         │
    └─────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │  approved   │    │  rejected   │    │ needs_human │
    │  → publish  │    │  → log      │    │  → admin    │
    │    queue    │    │             │    │    queue    │
    └─────────────┘    └─────────────┘    └─────────────┘
```

### Validation Checks

```typescript
// workers/src/validator.ts

interface ValidationResult {
  decision: 'approved' | 'rejected' | 'needs_human';
  reason: string;
  evidence: string[];
}

async function validateDraft(draftId: string): Promise<ValidationResult> {
  const draft = await db.query('SELECT * FROM ai_markets WHERE id = $1', [draftId]);
  const market = draft.rows[0];
  const resolution = JSON.parse(market.resolution);

  const evidence: string[] = [];

  // 1. Required fields check
  if (!market.title || !market.description || !resolution.exact_question) {
    return { decision: 'rejected', reason: 'Missing required fields', evidence: ['title, description, or exact_question missing'] };
  }

  // 2. Expiry check
  if (new Date(resolution.expiry) <= new Date()) {
    return { decision: 'rejected', reason: 'Expiry date is in the past', evidence: [] };
  }

  // 3. Allowed sources check
  if (!resolution.criteria.allowed_sources || resolution.criteria.allowed_sources.length === 0) {
    return { decision: 'rejected', reason: 'No allowed sources defined', evidence: [] };
  }

  // 4. Source reachability check
  for (const source of resolution.criteria.allowed_sources) {
    try {
      const response = await fetch(source.url, { method: 'HEAD', timeout: 5000 });
      if (!response.ok) {
        evidence.push(`Source unreachable: ${source.url}`);
      }
    } catch {
      evidence.push(`Source unreachable: ${source.url}`);
    }
  }

  if (evidence.length > 0) {
    return { decision: 'needs_human', reason: 'Some sources are unreachable', evidence };
  }

  // 5. Duplicate check
  const duplicates = await checkDuplicates(market.title, resolution.exact_question);
  if (duplicates.length > 0) {
    return { decision: 'rejected', reason: 'Duplicate market exists', evidence: duplicates.map(d => d.id) };
  }

  // 6. LLM validation
  const llmResult = await callLLM('validation', {
    title: market.title,
    description: market.description,
    exact_question: resolution.exact_question,
    must_meet_all: resolution.criteria.must_meet_all,
    must_not_count: resolution.criteria.must_not_count
  });

  if (llmResult.has_ambiguity) {
    return { decision: 'needs_human', reason: 'Potential ambiguity detected', evidence: llmResult.ambiguity_details };
  }

  if (llmResult.is_forbidden) {
    return { decision: 'rejected', reason: 'Forbidden topic', evidence: llmResult.forbidden_reason };
  }

  return { decision: 'approved', reason: 'All checks passed', evidence: [] };
}
```

---

## 5.5 Publisher Worker

**Purpose**: Publish approved markets on-chain.

### Input
- `markets.publish` queue

### Output
- Solana transaction
- Update market status to `active`

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Publisher Worker                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Queue:         │
                    │  markets.publish│
                    └────────┬────────┘
                             │
                             ▼
    ┌─────────────────────────────────────────────────────┐
    │  1. Fetch draft market and validation from DB       │
    │  2. Map to CreateMarketParams:                      │
    │     - title → display_name (truncate to 64 chars)  │
    │     - expiry → ending_slot (timestamp to slot)     │
    │     - Generate yes_symbol, yes_uri                  │
    │     - AI estimate → initial_yes_prob               │
    │  3. Build Solana transaction                        │
    │  4. Sign with publisher wallet                      │
    │  5. Submit transaction                              │
    │  6. Wait for confirmation                           │
    │  7. Update DB: status = 'active', market_address   │
    │  8. Log audit entry                                 │
    │  9. ACK message                                     │
    └─────────────────────────────────────────────────────┘
```

### On-Chain Publishing

```typescript
// workers/src/publisher.ts

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { MarketPublishMessage } from '@x402/shared-types';

const PUBLISHER_KEYPAIR = Keypair.fromSecretKey(
  Buffer.from(process.env.PUBLISHER_PRIVATE_KEY!, 'base64')
);

async function publishMarket(message: MarketPublishMessage) {
  const draft = await db.query('SELECT * FROM ai_markets WHERE id = $1', [message.draft_market_id]);
  const market = draft.rows[0];
  const resolution = JSON.parse(market.resolution);

  // Convert expiry to slot
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  const currentSlot = await connection.getSlot();
  const expiryDate = new Date(resolution.expiry);
  const secondsUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / 1000);
  const slotsUntilExpiry = Math.floor(secondsUntilExpiry / 0.4); // ~400ms per slot
  const endingSlot = currentSlot + slotsUntilExpiry;

  // Prepare params
  const params = {
    yes_symbol: `YES-${market.id.slice(0, 8)}`,
    yes_uri: `${process.env.API_BASE_URL}/api/v1/markets/${market.id}/metadata`,
    start_slot: null,
    ending_slot: endingSlot,
    display_name: market.title.slice(0, 64),
    initial_yes_prob: estimateInitialProbability(resolution) // e.g., 5000 for 50%
  };

  // Build and send transaction
  const program = new Program(IDL, PROGRAM_ID, { connection });
  const tx = await program.methods
    .createMarket(params)
    .accounts({
      // ... account setup
    })
    .signers([PUBLISHER_KEYPAIR])
    .rpc();

  // Update database
  await db.query(
    `UPDATE ai_markets SET status = 'active', market_address = $1, published_at = NOW() WHERE id = $2`,
    [marketAddress.toBase58(), market.id]
  );

  // Audit log
  await db.query(
    `INSERT INTO audit_logs (action, entity_type, entity_id, actor, details)
     VALUES ('market_published', 'market', $1, 'publisher_worker_v1', $2)`,
    [market.id, JSON.stringify({ tx_signature: tx, market_address: marketAddress.toBase58() })]
  );
}
```

---

## 5.6 Resolver Worker

**Purpose**: Determine market outcomes using deterministic rules.

### Input
- `markets.resolve` queue (from scheduler)

### Output
- Resolution record in DB
- On-chain resolution transaction
- Start 24h dispute window

### Flow

See [8-Oracles & Deterministic Resolution.md](./8-Oracles%20%26%20Deterministic%20Resolution.md) for detailed resolution logic.

---

## 5.7 Dispute Agent Worker

**Purpose**: Process and evaluate disputes using AI.

### Input
- `disputes` queue

### Output
- Decision: `upheld`, `overturned`, or `escalated`
- Update dispute record

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   Dispute Agent Worker                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Queue:         │
                    │  disputes       │
                    └────────┬────────┘
                             │
                             ▼
    ┌─────────────────────────────────────────────────────┐
    │  1. Fetch dispute, resolution, and market from DB   │
    │  2. Re-fetch evidence from allowed_sources          │
    │  3. Compare with original resolution evidence       │
    │  4. Run LLM analysis:                               │
    │     - Is disputant's claim valid?                   │
    │     - Does new evidence change the outcome?         │
    │     - Is this a clear case or ambiguous?            │
    │  5. Make decision:                                  │
    │     - upheld: Original resolution correct           │
    │     - overturned: Change result                     │
    │     - escalate: Send to admin                       │
    │  6. Update dispute record                           │
    │  7. If overturned: Submit new resolution on-chain   │
    └─────────────────────────────────────────────────────┘
```

---

## 5.8 Scheduler (Cron)

**Purpose**: Check for markets ready for resolution.

### Schedule
- Runs every 1 minute

### Flow

```typescript
// workers/src/scheduler.ts

import cron from 'node-cron';
import { publishMessage } from './shared/queue';
import { MarketResolveMessage } from '@x402/shared-types';

cron.schedule('* * * * *', async () => {
  // Find markets past expiry that haven't been resolved
  const result = await db.query(`
    SELECT id, market_address, resolution->>'expiry' as expiry
    FROM ai_markets
    WHERE status = 'active'
      AND resolution->>'expiry' < NOW()
      AND market_address IS NOT NULL
  `);

  for (const market of result.rows) {
    // Update status to resolving
    await db.query(
      `UPDATE ai_markets SET status = 'resolving' WHERE id = $1`,
      [market.id]
    );

    // Publish to resolve queue
    const message: MarketResolveMessage = {
      market_id: market.id,
      market_address: market.market_address,
      expiry: market.expiry
    };

    await publishMessage('markets.resolve', message);
  }
});
```

---

## Error Handling & Retry

### Retry Policy

```typescript
// workers/src/shared/queue.ts

const RETRY_DELAYS = [1000, 5000, 30000]; // 1s, 5s, 30s

async function consumeWithRetry(queue: string, handler: Function) {
  channel.consume(queue, async (msg) => {
    const content = JSON.parse(msg.content.toString());
    const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) as number;

    try {
      await handler(content);
      channel.ack(msg);
    } catch (error) {
      console.error(`Error processing message:`, error);

      if (retryCount < RETRY_DELAYS.length) {
        // Retry with delay
        setTimeout(() => {
          channel.publish('', queue, Buffer.from(JSON.stringify(content)), {
            headers: { 'x-retry-count': retryCount + 1 }
          });
        }, RETRY_DELAYS[retryCount]);
        channel.ack(msg);
      } else {
        // Move to DLQ
        channel.publish('', `${queue}.dlq`, msg.content);
        channel.ack(msg);
      }
    }
  });
}
```
