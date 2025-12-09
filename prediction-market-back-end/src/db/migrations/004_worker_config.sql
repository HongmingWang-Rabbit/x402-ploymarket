-- Migration: 004_worker_config.sql
-- Description: Create worker configuration and status tracking tables
-- Created: 2024-12-09

-- ============================================================================
-- worker_config: Stores worker configuration and enabled/disabled state
-- ============================================================================
CREATE TABLE IF NOT EXISTS worker_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_type VARCHAR(32) NOT NULL UNIQUE,
  display_name VARCHAR(64) NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Scheduling
  poll_interval_ms INTEGER,  -- For polling workers like crawler
  cron_expression VARCHAR(64),  -- For cron-based workers like scheduler

  -- Queue configuration
  input_queue VARCHAR(64),
  output_queue VARCHAR(64),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_config_type ON worker_config(worker_type);
CREATE INDEX IF NOT EXISTS idx_worker_config_enabled ON worker_config(enabled);

-- ============================================================================
-- worker_heartbeats: Stores worker heartbeat and status information
-- ============================================================================
CREATE TABLE IF NOT EXISTS worker_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_type VARCHAR(32) NOT NULL,
  worker_instance_id VARCHAR(64) NOT NULL,  -- Unique ID for each running instance

  -- Status
  status VARCHAR(16) NOT NULL DEFAULT 'starting',  -- starting, running, idle, error, stopped
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metrics
  messages_processed INTEGER NOT NULL DEFAULT 0,
  messages_failed INTEGER NOT NULL DEFAULT 0,
  current_queue_size INTEGER,

  -- Error tracking
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  consecutive_errors INTEGER NOT NULL DEFAULT 0,

  -- Instance info
  hostname VARCHAR(128),
  pid INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_worker_status CHECK (status IN ('starting', 'running', 'idle', 'error', 'stopped'))
);

CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_type ON worker_heartbeats(worker_type);
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_status ON worker_heartbeats(status);
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_last_heartbeat ON worker_heartbeats(last_heartbeat);
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_heartbeats_instance ON worker_heartbeats(worker_type, worker_instance_id);

-- ============================================================================
-- Seed default worker configurations
-- ============================================================================
INSERT INTO worker_config (worker_type, display_name, description, enabled, poll_interval_ms, input_queue, output_queue) VALUES
  ('crawler', 'News Crawler', 'Polls RSS feeds for news articles', true, 900000, NULL, 'news.raw'),
  ('extractor', 'Entity Extractor', 'Extracts market candidates from news', true, NULL, 'news.raw', 'candidates'),
  ('generator', 'Market Generator', 'Generates draft markets using AI', true, NULL, 'candidates', 'drafts.validate'),
  ('validator', 'Market Validator', 'Validates draft markets for quality', true, NULL, 'drafts.validate', 'markets.publish'),
  ('publisher', 'Blockchain Publisher', 'Publishes markets to Solana', true, NULL, 'markets.publish', NULL),
  ('scheduler', 'Task Scheduler', 'Runs scheduled maintenance tasks', true, NULL, NULL, 'markets.resolve'),
  ('resolver', 'Market Resolver', 'Resolves market outcomes', true, NULL, 'markets.resolve', NULL),
  ('dispute-agent', 'Dispute Agent', 'Handles disputed resolutions', true, NULL, 'disputes', NULL)
ON CONFLICT (worker_type) DO NOTHING;

-- ============================================================================
-- Function to update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_worker_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS worker_config_updated_at ON worker_config;
CREATE TRIGGER worker_config_updated_at
  BEFORE UPDATE ON worker_config
  FOR EACH ROW
  EXECUTE FUNCTION update_worker_config_updated_at();
