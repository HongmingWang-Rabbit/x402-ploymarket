-- Migration: 002_fix_candidates_news_id.sql
-- Description: Make news_id nullable in candidates table for user proposals
-- Created: 2024-12-08

-- Drop the NOT NULL constraint on news_id to allow user proposals
ALTER TABLE candidates ALTER COLUMN news_id DROP NOT NULL;
