-- Migration: 005_add_token_mints.sql
-- Description: Add YES/NO token mint addresses to ai_markets, fix news status constraint
-- Created: 2024-12-09

-- Add token mint columns for on-chain market tracking
ALTER TABLE ai_markets
  ADD COLUMN IF NOT EXISTS yes_token_mint VARCHAR(64),
  ADD COLUMN IF NOT EXISTS no_token_mint VARCHAR(64);

-- Index for quick lookup by token mints
CREATE INDEX IF NOT EXISTS idx_ai_markets_yes_token ON ai_markets(yes_token_mint);
CREATE INDEX IF NOT EXISTS idx_ai_markets_no_token ON ai_markets(no_token_mint);

-- Fix news_items status constraint to match actual worker usage
-- Workers use: 'pending', 'processed', 'error'
-- Old constraint allowed: 'ingested', 'extracted', 'processed', 'skipped'
ALTER TABLE news_items DROP CONSTRAINT IF EXISTS valid_news_status;
ALTER TABLE news_items ADD CONSTRAINT valid_news_status
  CHECK (status IN ('pending', 'ingested', 'extracted', 'processed', 'skipped', 'error'));
