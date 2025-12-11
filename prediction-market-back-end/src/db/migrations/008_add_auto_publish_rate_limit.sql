-- Migration: 008_add_auto_publish_rate_limit.sql
-- Description: Add auto_publish_per_hour rate limit config and rate_limited status
-- Created: 2024-12-10

-- ============================================================================
-- Update rate_limits config to include auto_publish_per_hour
-- ============================================================================
UPDATE ai_config
SET
  value = '{"propose_per_minute": 5, "propose_per_hour": 20, "propose_per_day": 50, "dispute_per_hour": 3, "dispute_per_day": 10, "auto_publish_per_hour": 3}',
  updated_at = NOW(),
  updated_by = 'migration'
WHERE key = 'rate_limits';

-- ============================================================================
-- Add 'rate_limited' to valid ai_market_status constraint
-- ============================================================================
ALTER TABLE ai_markets DROP CONSTRAINT IF EXISTS valid_ai_market_status;
ALTER TABLE ai_markets ADD CONSTRAINT valid_ai_market_status
  CHECK (status IN ('draft', 'pending_review', 'active', 'resolving', 'resolved', 'finalized', 'disputed', 'canceled', 'rate_limited'));
