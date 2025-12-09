/**
 * News and candidate-related types for news ingestion pipeline
 */

import { MarketCategory } from './market';

export type NewsStatus = 'ingested' | 'extracted' | 'processed' | 'skipped';

export interface NewsItem {
  id: string;
  source: string;
  source_url: string;
  title: string;
  content: string;
  published_at: string;
  status: NewsStatus;
  extracted_entities?: string[];
  event_type?: string;
  content_hash: string;
  ingested_at: string;
  processed_at?: string;
}

export interface Candidate {
  id: string;
  news_id: string;
  entities: string[];
  event_type: string;
  category_hint: MarketCategory;
  relevant_text: string;
  processed: boolean;
  draft_market_id?: string;
  created_at: string;
}

export interface RssFeed {
  id: string;
  name: string;
  url: string;
  category_hint?: MarketCategory;
  active: boolean;
  last_polled_at?: string;
  created_at: string;
}
