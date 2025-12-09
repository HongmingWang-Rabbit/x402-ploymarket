# 14. Database Schema

This document defines the PostgreSQL database schema for the AI prediction market system.

---

## Overview

All AI-related data is stored in the same PostgreSQL database as the existing backend. Tables are prefixed with `ai_` to distinguish them from any existing tables.

---

## Tables

### ai_markets

Stores AI-generated market metadata and resolution rules.

```sql
CREATE TABLE ai_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_address VARCHAR(64),                    -- Solana pubkey (null if draft)

  -- Display info
  title VARCHAR(256) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(32) NOT NULL,
  image_url TEXT,

  -- AI generation info
  ai_version VARCHAR(16) NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL,        -- 0.00 - 1.00
  source_proposal_id UUID REFERENCES proposals(id),
  source_news_id UUID REFERENCES news_items(id),

  -- Resolution rules (JSON)
  resolution JSONB NOT NULL,

  -- Status tracking
  status VARCHAR(32) NOT NULL DEFAULT 'draft',   -- draft, pending_review, active, resolving, resolved, finalized, disputed, canceled
  validation_decision JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,

  -- Audit
  created_by VARCHAR(64) NOT NULL,

  -- Indexes
  CONSTRAINT valid_category CHECK (category IN ('politics', 'product_launch', 'finance', 'sports', 'entertainment', 'technology', 'misc')),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'pending_review', 'active', 'resolving', 'resolved', 'finalized', 'disputed', 'canceled'))
);

CREATE INDEX idx_ai_markets_status ON ai_markets(status);
CREATE INDEX idx_ai_markets_category ON ai_markets(category);
CREATE INDEX idx_ai_markets_market_address ON ai_markets(market_address);
CREATE INDEX idx_ai_markets_created_at ON ai_markets(created_at DESC);
CREATE INDEX idx_ai_markets_resolution_expiry ON ai_markets((resolution->>'expiry'));
```

### proposals

Stores user-submitted market proposals.

```sql
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64),                           -- Wallet address or null for guest

  -- User input
  proposal_text TEXT NOT NULL,
  category_hint VARCHAR(32),

  -- Processing results
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, processing, matched, draft_created, approved, rejected, needs_human, published
  matched_market_id UUID REFERENCES ai_markets(id),
  draft_market_id UUID REFERENCES ai_markets(id),

  -- AI response
  confidence_score DECIMAL(3,2),
  rejection_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  -- Rate limiting
  ip_address INET,

  CONSTRAINT valid_proposal_status CHECK (status IN ('pending', 'processing', 'matched', 'draft_created', 'approved', 'rejected', 'needs_human', 'published'))
);

CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_user_id ON proposals(user_id);
CREATE INDEX idx_proposals_created_at ON proposals(created_at DESC);
CREATE INDEX idx_proposals_ip_address ON proposals(ip_address);
```

### news_items

Stores ingested news articles.

```sql
CREATE TABLE news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source info
  source VARCHAR(64) NOT NULL,                   -- "reuters_rss", "manual", etc.
  source_url TEXT NOT NULL,

  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,

  -- Processing
  status VARCHAR(32) NOT NULL DEFAULT 'ingested', -- ingested, extracted, processed, skipped
  extracted_entities TEXT[],
  event_type VARCHAR(64),

  -- Deduplication
  content_hash VARCHAR(64) NOT NULL UNIQUE,

  -- Timestamps
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  CONSTRAINT valid_news_status CHECK (status IN ('ingested', 'extracted', 'processed', 'skipped'))
);

CREATE INDEX idx_news_items_status ON news_items(status);
CREATE INDEX idx_news_items_source ON news_items(source);
CREATE INDEX idx_news_items_content_hash ON news_items(content_hash);
CREATE INDEX idx_news_items_ingested_at ON news_items(ingested_at DESC);
```

### candidates

Stores extracted market candidates from news.

```sql
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID NOT NULL REFERENCES news_items(id),

  -- Extracted info
  entities TEXT[] NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  category_hint VARCHAR(32) NOT NULL,

  -- Context
  relevant_text TEXT NOT NULL,

  -- Processing
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  draft_market_id UUID REFERENCES ai_markets(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candidates_processed ON candidates(processed);
CREATE INDEX idx_candidates_news_id ON candidates(news_id);
```

### resolutions

Stores market resolution records.

```sql
CREATE TABLE resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES ai_markets(id),
  market_address VARCHAR(64) NOT NULL,

  -- Result
  final_result VARCHAR(3) NOT NULL,              -- YES, NO
  resolution_source TEXT NOT NULL,

  -- Evidence
  evidence_hash VARCHAR(64) NOT NULL,
  evidence_raw TEXT NOT NULL,

  -- Verification
  must_meet_all_results JSONB NOT NULL,
  must_not_count_results JSONB NOT NULL,

  -- Status
  status VARCHAR(32) NOT NULL DEFAULT 'resolved', -- pending, resolved, disputed, finalized
  resolved_by VARCHAR(64) NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- On-chain
  tx_signature VARCHAR(128),

  -- Dispute window
  dispute_window_ends TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ,

  CONSTRAINT valid_result CHECK (final_result IN ('YES', 'NO')),
  CONSTRAINT valid_resolution_status CHECK (status IN ('pending', 'resolved', 'disputed', 'finalized'))
);

CREATE INDEX idx_resolutions_market_id ON resolutions(market_id);
CREATE INDEX idx_resolutions_status ON resolutions(status);
CREATE INDEX idx_resolutions_dispute_window ON resolutions(dispute_window_ends);
```

### disputes

Stores dispute records.

```sql
CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id UUID NOT NULL REFERENCES resolutions(id),
  market_address VARCHAR(64) NOT NULL,

  -- Disputant
  user_address VARCHAR(64) NOT NULL,
  user_token_balance JSONB NOT NULL,             -- { yes: number, no: number }

  -- Dispute content
  reason TEXT NOT NULL,
  evidence_urls TEXT[],

  -- Review
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, reviewing, upheld, overturned, escalated
  ai_review JSONB,
  admin_review JSONB,

  -- Result
  new_result VARCHAR(3),                         -- YES, NO (if overturned)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,

  CONSTRAINT valid_dispute_status CHECK (status IN ('pending', 'reviewing', 'upheld', 'overturned', 'escalated'))
);

CREATE INDEX idx_disputes_resolution_id ON disputes(resolution_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_user_address ON disputes(user_address);
```

### audit_logs

Stores immutable audit trail.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id UUID NOT NULL,

  -- Details
  actor VARCHAR(64) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',

  -- AI tracking
  ai_version VARCHAR(16),
  llm_request_id VARCHAR(128),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

### ai_config

Stores AI configuration (including ai_version).

```sql
CREATE TABLE ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(64) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(64) NOT NULL
);

-- Initial config values
INSERT INTO ai_config (key, value, updated_by) VALUES
  ('ai_version', '"v1.0"', 'system'),
  ('llm_model', '"gpt-3.5-turbo"', 'system'),
  ('categories', '["politics", "product_launch", "finance", "sports", "entertainment", "technology", "misc"]', 'system'),
  ('rate_limits', '{"propose_per_min": 3, "propose_per_hour": 20, "propose_per_day": 100}', 'system');
```

### rss_feeds

Stores RSS feed configuration for crawler.

```sql
CREATE TABLE rss_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  url TEXT NOT NULL UNIQUE,
  category_hint VARCHAR(32),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rss_feeds_active ON rss_feeds(active);
```

### worker_api_keys

Stores API keys for worker authentication.

```sql
CREATE TABLE worker_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_type VARCHAR(32) NOT NULL,              -- crawler, extractor, generator, validator, publisher, resolver, dispute_agent
  api_key_hash VARCHAR(64) NOT NULL UNIQUE,      -- SHA-256 hash of API key
  permissions TEXT[] NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_worker_api_keys_hash ON worker_api_keys(api_key_hash);
CREATE INDEX idx_worker_api_keys_type ON worker_api_keys(worker_type);
```

### rate_limits

Stores rate limit tracking.

```sql
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(128) NOT NULL,              -- user_id or IP address
  endpoint VARCHAR(64) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_type VARCHAR(16) NOT NULL,              -- minute, hour, day
  count INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT rate_limits_unique UNIQUE (identifier, endpoint, window_start, window_type)
);

CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier, endpoint);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);

-- Cleanup old rate limit records (run daily)
-- DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '2 days';
```

---

## Migration Script

```sql
-- Migration: 001_ai_tables.sql
-- Run this to create all AI-related tables

BEGIN;

-- Create tables in dependency order
-- 1. news_items (no dependencies)
-- 2. proposals (references ai_markets, created after)
-- 3. ai_markets (references proposals, news_items)
-- 4. candidates (references news_items, ai_markets)
-- 5. resolutions (references ai_markets)
-- 6. disputes (references resolutions)
-- 7. audit_logs (no dependencies)
-- 8. ai_config (no dependencies)
-- 9. rss_feeds (no dependencies)
-- 10. worker_api_keys (no dependencies)
-- 11. rate_limits (no dependencies)

-- Due to circular reference between proposals and ai_markets,
-- create ai_markets first without the FK, then add it

CREATE TABLE IF NOT EXISTS news_items ( ... );
CREATE TABLE IF NOT EXISTS ai_markets ( ... );  -- Without proposal FK initially
CREATE TABLE IF NOT EXISTS proposals ( ... );

-- Add the FK after both tables exist
ALTER TABLE ai_markets
  ADD CONSTRAINT fk_source_proposal
  FOREIGN KEY (source_proposal_id) REFERENCES proposals(id);

CREATE TABLE IF NOT EXISTS candidates ( ... );
CREATE TABLE IF NOT EXISTS resolutions ( ... );
CREATE TABLE IF NOT EXISTS disputes ( ... );
CREATE TABLE IF NOT EXISTS audit_logs ( ... );
CREATE TABLE IF NOT EXISTS ai_config ( ... );
CREATE TABLE IF NOT EXISTS rss_feeds ( ... );
CREATE TABLE IF NOT EXISTS worker_api_keys ( ... );
CREATE TABLE IF NOT EXISTS rate_limits ( ... );

COMMIT;
```

---

## JSON Schema: resolution Field

The `resolution` JSONB field in `ai_markets` follows this schema:

```json
{
  "type": "binary",
  "exact_question": "Will X happen before Y?",
  "criteria": {
    "must_meet_all": ["condition 1", "condition 2"],
    "must_not_count": ["exception 1", "exception 2"],
    "allowed_sources": [
      {
        "name": "Official Website",
        "url": "https://example.com",
        "method": "html_scrape",
        "condition": "Page contains X",
        "selector": ".product-buy-button"
      }
    ],
    "machine_resolution_logic": {
      "if": "All must_meet_all satisfied AND no must_not_count triggered",
      "then": "YES",
      "else": "NO"
    }
  },
  "expiry": "2024-12-31T23:59:59Z"
}
```

---

## Queries

### Get markets for resolution

```sql
SELECT id, market_address, resolution->>'expiry' as expiry
FROM ai_markets
WHERE status = 'active'
  AND (resolution->>'expiry')::timestamptz < NOW()
  AND market_address IS NOT NULL;
```

### Check rate limit

```sql
SELECT COALESCE(SUM(count), 0) as total
FROM rate_limits
WHERE identifier = $1
  AND endpoint = $2
  AND window_type = $3
  AND window_start > NOW() - INTERVAL '1 ' || $3;
```

### Get proposals needing human review

```sql
SELECT p.*, m.title, m.resolution
FROM proposals p
JOIN ai_markets m ON p.draft_market_id = m.id
WHERE p.status = 'needs_human'
ORDER BY p.created_at ASC;
```

### Find duplicate markets

```sql
SELECT id, title, market_address,
       similarity(title, $1) as title_sim,
       similarity(resolution->>'exact_question', $2) as question_sim
FROM ai_markets
WHERE status IN ('active', 'resolving', 'resolved')
  AND (
    similarity(title, $1) > 0.7
    OR similarity(resolution->>'exact_question', $2) > 0.8
  )
ORDER BY title_sim DESC, question_sim DESC
LIMIT 5;
```

Note: Requires `pg_trgm` extension for similarity function:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```
