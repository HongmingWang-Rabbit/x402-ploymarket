/**
 * RabbitMQ message types for worker communication
 */

import { MarketCategory } from './market';

/**
 * Queue: news.raw
 * Published by: Crawler
 * Consumed by: Extractor
 */
export interface NewsRawMessage {
  news_id: string;
  source: string;
  url: string;
  title: string;
  content: string;
  published_at: string;
  category_hint?: string;
}

/**
 * Queue: candidates
 * Published by: Extractor, Backend (for user proposals)
 * Consumed by: Generator
 */
export interface CandidateMessage {
  candidate_id: string;
  news_id: string | null; // null for user proposals
  entities: string[];
  event_type: string;
  category_hint: MarketCategory;
  relevant_text: string;
  proposal_id?: string; // present for user proposals
}

/**
 * Queue: drafts.validate
 * Published by: Generator
 * Consumed by: Validator
 */
export interface DraftValidateMessage {
  draft_market_id: string;
  source_type: 'news' | 'proposal';
  source_id: string;
}

/**
 * Queue: markets.publish
 * Published by: Validator
 * Consumed by: Publisher
 */
export interface MarketPublishMessage {
  draft_market_id: string;
  validation_id: string;
}

/**
 * Queue: markets.resolve
 * Published by: Scheduler
 * Consumed by: Resolver
 */
export interface MarketResolveMessage {
  market_id: string;
  market_address: string;
  expiry: string;
}

/**
 * Queue: disputes
 * Published by: Backend (when user submits dispute)
 * Consumed by: Dispute Agent
 */
export interface DisputeMessage {
  dispute_id: string;
  resolution_id: string;
  market_address: string;
}

/**
 * Queue: config.refresh
 * Published by: Admin actions
 * Consumed by: All workers
 */
export interface ConfigRefreshMessage {
  key: string;
  timestamp: string;
}

/**
 * Union type for all queue messages
 */
export type QueueMessage =
  | NewsRawMessage
  | CandidateMessage
  | DraftValidateMessage
  | MarketPublishMessage
  | MarketResolveMessage
  | DisputeMessage
  | ConfigRefreshMessage;

/**
 * Queue names as constants
 */
export const QUEUE_NAMES = {
  NEWS_RAW: 'news.raw',
  CANDIDATES: 'candidates',
  DRAFTS_VALIDATE: 'drafts.validate',
  MARKETS_PUBLISH: 'markets.publish',
  MARKETS_RESOLVE: 'markets.resolve',
  DISPUTES: 'disputes',
  CONFIG_REFRESH: 'config.refresh',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
