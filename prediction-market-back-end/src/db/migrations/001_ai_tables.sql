-- Migration: 001_ai_tables.sql
-- Description: Create AI prediction market tables
-- Created: 2024-12-07

-- Enable pg_trgm extension for similarity searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- news_items: Stores ingested news articles
-- ============================================================================
CREATE TABLE IF NOT EXISTS news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source info
  source VARCHAR(64) NOT NULL,
  source_url TEXT NOT NULL,

  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,

  -- Processing
  status VARCHAR(32) NOT NULL DEFAULT 'ingested',
  extracted_entities TEXT[],
  event_type VARCHAR(64),

  -- Deduplication
  content_hash VARCHAR(64) NOT NULL UNIQUE,

  -- Timestamps
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  CONSTRAINT valid_news_status CHECK (status IN ('ingested', 'extracted', 'processed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_news_items_status ON news_items(status);
CREATE INDEX IF NOT EXISTS idx_news_items_source ON news_items(source);
CREATE INDEX IF NOT EXISTS idx_news_items_content_hash ON news_items(content_hash);
CREATE INDEX IF NOT EXISTS idx_news_items_ingested_at ON news_items(ingested_at DESC);

-- ============================================================================
-- ai_markets: Stores AI-generated market metadata and resolution rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_address VARCHAR(64),

  -- Display info
  title VARCHAR(256) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(32) NOT NULL,
  image_url TEXT,

  -- AI generation info
  ai_version VARCHAR(64) NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL,
  source_news_id UUID REFERENCES news_items(id),

  -- Resolution rules (JSON)
  resolution JSONB NOT NULL,

  -- Status tracking
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  validation_decision JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,

  -- Audit
  created_by VARCHAR(64) NOT NULL,

  CONSTRAINT valid_category CHECK (category IN ('politics', 'product_launch', 'finance', 'sports', 'entertainment', 'technology', 'misc')),
  CONSTRAINT valid_ai_market_status CHECK (status IN ('draft', 'pending_review', 'active', 'resolving', 'resolved', 'finalized', 'disputed', 'canceled'))
);

CREATE INDEX IF NOT EXISTS idx_ai_markets_status ON ai_markets(status);
CREATE INDEX IF NOT EXISTS idx_ai_markets_category ON ai_markets(category);
CREATE INDEX IF NOT EXISTS idx_ai_markets_market_address ON ai_markets(market_address);
CREATE INDEX IF NOT EXISTS idx_ai_markets_created_at ON ai_markets(created_at DESC);

-- ============================================================================
-- proposals: Stores user-submitted market proposals
-- ============================================================================
CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64),

  -- User input
  proposal_text TEXT NOT NULL,
  category_hint VARCHAR(32),

  -- Processing results
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
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

CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_user_id ON proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_ip_address ON proposals(ip_address);

-- Add FK from ai_markets to proposals (after proposals table exists)
ALTER TABLE ai_markets
  ADD COLUMN IF NOT EXISTS source_proposal_id UUID REFERENCES proposals(id);

-- ============================================================================
-- candidates: Stores extracted market candidates from news
-- ============================================================================
CREATE TABLE IF NOT EXISTS candidates (
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

CREATE INDEX IF NOT EXISTS idx_candidates_processed ON candidates(processed);
CREATE INDEX IF NOT EXISTS idx_candidates_news_id ON candidates(news_id);

-- ============================================================================
-- resolutions: Stores market resolution records
-- ============================================================================
CREATE TABLE IF NOT EXISTS resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES ai_markets(id),
  market_address VARCHAR(64) NOT NULL,

  -- Result
  final_result VARCHAR(3) NOT NULL,
  resolution_source TEXT NOT NULL,

  -- Evidence
  evidence_hash VARCHAR(64) NOT NULL,
  evidence_raw TEXT NOT NULL,

  -- Verification
  must_meet_all_results JSONB NOT NULL,
  must_not_count_results JSONB NOT NULL,

  -- Status
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
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

CREATE INDEX IF NOT EXISTS idx_resolutions_market_id ON resolutions(market_id);
CREATE INDEX IF NOT EXISTS idx_resolutions_status ON resolutions(status);
CREATE INDEX IF NOT EXISTS idx_resolutions_dispute_window ON resolutions(dispute_window_ends);

-- ============================================================================
-- disputes: Stores dispute records
-- ============================================================================
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id UUID NOT NULL REFERENCES resolutions(id),
  market_address VARCHAR(64) NOT NULL,

  -- Disputant
  user_address VARCHAR(64) NOT NULL,
  user_token_balance JSONB NOT NULL,

  -- Dispute content
  reason TEXT NOT NULL,
  evidence_urls TEXT[],

  -- Review
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  ai_review JSONB,
  admin_review JSONB,

  -- Result
  new_result VARCHAR(3),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,

  CONSTRAINT valid_dispute_status CHECK (status IN ('pending', 'reviewing', 'upheld', 'overturned', 'escalated'))
);

CREATE INDEX IF NOT EXISTS idx_disputes_resolution_id ON disputes(resolution_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_user_address ON disputes(user_address);

-- ============================================================================
-- audit_logs: Stores immutable audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id UUID NOT NULL,

  -- Details
  actor VARCHAR(64) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',

  -- AI tracking
  ai_version VARCHAR(64),
  llm_request_id VARCHAR(128),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- ai_config: Stores AI configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(64) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(64) NOT NULL
);

-- Insert default config values (only if not exists)
INSERT INTO ai_config (key, value, updated_by) VALUES
  ('ai_version', '"v1.0"', 'system'),
  ('llm_model', '"gpt-3.5-turbo"', 'system'),
  ('validation_confidence_threshold', '0.7', 'system'),
  ('categories', '["politics", "product_launch", "finance", "sports", "entertainment", "technology", "misc"]', 'system'),
  ('rate_limits', '{"propose_per_minute": 5, "propose_per_hour": 20, "propose_per_day": 50, "dispute_per_hour": 3, "dispute_per_day": 10}', 'system'),
  ('dispute_window_hours', '24', 'system'),
  ('max_retries', '3', 'system')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- rss_feeds: Stores RSS feed configuration for crawler
-- ============================================================================
CREATE TABLE IF NOT EXISTS rss_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  url TEXT NOT NULL UNIQUE,
  category_hint VARCHAR(32),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rss_feeds_active ON rss_feeds(active);

-- ============================================================================
-- worker_api_keys: Stores API keys for worker authentication
-- ============================================================================
CREATE TABLE IF NOT EXISTS worker_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_type VARCHAR(32) NOT NULL,
  api_key_hash VARCHAR(64) NOT NULL UNIQUE,
  permissions TEXT[] NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_worker_api_keys_hash ON worker_api_keys(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_worker_api_keys_type ON worker_api_keys(worker_type);

-- ============================================================================
-- rate_limits: Stores rate limit tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(128) NOT NULL,
  endpoint VARCHAR(64) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_type VARCHAR(16) NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT rate_limits_unique UNIQUE (identifier, endpoint, window_start, window_type)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
