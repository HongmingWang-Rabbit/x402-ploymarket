# 3. Data Models

This document defines all data structures used in the AI prediction market system, including the relationship between on-chain and off-chain data.

---

## Data Storage Strategy

| Data Type | Storage | Reason |
|-----------|---------|--------|
| Market state (balances, LP shares) | On-chain (Solana) | Trust, finality |
| Market parameters (name, expiry) | On-chain (Solana) | Immutability |
| AI rules (must_meet_all, etc.) | Off-chain (PostgreSQL) | Flexibility, size |
| Market metadata (description, image) | Off-chain (PostgreSQL) | Rich content |
| Proposals | Off-chain (PostgreSQL) | Draft state |
| Audit logs | Off-chain (PostgreSQL) | Compliance |
| News items | Off-chain (PostgreSQL) | Processing queue |

---

## On-Chain Market (Existing Contract)

The Solana smart contract stores minimal market data. Reference: `contract/programs/prediction-market/src/state/market.rs`

```rust
// Key fields from existing Market struct
pub struct Market {
    pub yes_token_mint: Pubkey,
    pub no_token_mint: Pubkey,
    pub creator: Pubkey,
    pub display_name: String,           // Max 64 chars
    pub is_completed: bool,
    pub start_slot: Option<u64>,
    pub ending_slot: Option<u64>,
    pub winner_token_type: u8,          // 0=NO, 1=YES, 2=draw
    pub market_paused: bool,
    pub initial_yes_prob: u16,          // Basis points (2000-8000)
    pub created_at: i64,
    // ... pool state, LP tracking, etc.
}

// CreateMarketParams
pub struct CreateMarketParams {
    pub yes_symbol: String,
    pub yes_uri: String,
    pub start_slot: Option<u64>,
    pub ending_slot: Option<u64>,
    pub display_name: String,
    pub initial_yes_prob: u16,
}
```

---

## Off-Chain Data Models

### AI Market Metadata

Stored in PostgreSQL, linked to on-chain market by `market_address`.

```typescript
// Location: packages/shared-types/src/market.ts

export type MarketCategory =
  | 'politics'
  | 'product_launch'
  | 'finance'
  | 'sports'
  | 'entertainment'
  | 'technology'
  | 'misc';

export type MarketStatus =
  | 'draft'           // AI generated, not yet published
  | 'pending_review'  // Needs human review
  | 'active'          // Published on-chain
  | 'resolving'       // Past expiry, awaiting resolution
  | 'resolved'        // Resolution submitted, in dispute window
  | 'finalized'       // Dispute window passed, claims enabled
  | 'disputed'        // Under dispute review
  | 'canceled';       // Canceled before resolution

export interface AIMarketMetadata {
  id: string;                           // UUID
  market_address: string | null;        // Solana pubkey (null if draft)

  // Display info
  title: string;
  description: string;
  category: MarketCategory;
  image_url?: string;

  // AI generation info
  ai_version: string;                   // e.g., "v1.0"
  confidence_score: number;             // 0.0 - 1.0
  source_proposal_id?: string;          // If from user proposal
  source_news_id?: string;              // If from news crawler

  // Resolution rules (AI-generated)
  resolution: ResolutionRules;

  // Status tracking
  status: MarketStatus;
  validation_decision?: ValidationDecision;

  // Timestamps
  created_at: string;                   // ISO 8601
  published_at?: string;
  resolved_at?: string;
  finalized_at?: string;

  // Audit
  created_by: string;                   // "ai_worker_v1" or user ID
}
```

### Resolution Rules

```typescript
// Location: packages/shared-types/src/resolution.ts

export interface AllowedSource {
  name: string;                         // "Official Website", "Twitter/X", etc.
  url: string;                          // Full URL
  method: 'html_scrape' | 'api_check' | 'social_post';
  condition: string;                    // Human-readable verification condition
  selector?: string;                    // CSS selector for HTML scraping
  json_path?: string;                   // JSONPath for API responses
}

export interface MachineResolutionLogic {
  if: string;                           // Condition description
  then: 'YES' | 'NO';
  else: 'YES' | 'NO';
}

export interface ResolutionRules {
  type: 'binary';
  exact_question: string;               // Unambiguous question

  criteria: {
    must_meet_all: string[];            // All must be true for YES
    must_not_count: string[];           // Conditions that don't count
    allowed_sources: AllowedSource[];   // Official verification sources
    machine_resolution_logic: MachineResolutionLogic;
  };

  expiry: string;                       // ISO 8601 timestamp
}
```

### Validation Decision

```typescript
// Location: packages/shared-types/src/proposal.ts

export type ValidationStatus = 'approved' | 'rejected' | 'needs_human';

export interface ValidationDecision {
  status: ValidationStatus;
  reason: string;
  evidence: string[];                   // Specific issues found
  validated_at: string;
  validated_by: string;                 // "validator_worker_v1"

  rules_summary: {
    must_meet_all: string[];
    must_not_count: string[];
    allowed_sources: string[];          // Source names only
  };
}
```

### User Proposal

```typescript
// Location: packages/shared-types/src/proposal.ts

export type ProposalStatus =
  | 'pending'         // Waiting for processing
  | 'processing'      // Being processed by AI
  | 'matched'         // Matched to existing market
  | 'draft_created'   // Draft market created
  | 'approved'        // Validation passed
  | 'rejected'        // Validation failed
  | 'needs_human'     // Requires admin review
  | 'published';      // Market published on-chain

export interface Proposal {
  id: string;                           // UUID
  user_id?: string;                     // Wallet address or null for guest

  // User input
  proposal_text: string;                // Natural language proposal
  category_hint?: MarketCategory;

  // Processing results
  status: ProposalStatus;
  matched_market_id?: string;           // If matched to existing
  draft_market_id?: string;             // If draft created

  // AI response
  confidence_score?: number;
  rejection_reason?: string;

  // Timestamps
  created_at: string;
  processed_at?: string;

  // Rate limiting
  ip_address?: string;                  // For rate limiting guests
}
```

### News Item

```typescript
// Location: packages/shared-types/src/news.ts

export type NewsStatus =
  | 'ingested'        // Raw, not yet processed
  | 'extracted'       // Entities extracted
  | 'processed'       // Market generated (or skipped)
  | 'skipped';        // Not suitable for market

export interface NewsItem {
  id: string;                           // UUID

  // Source info
  source: string;                       // "reuters_rss", "manual", etc.
  source_url: string;

  // Content
  title: string;
  content: string;
  published_at: string;                 // Original publication time

  // Processing
  status: NewsStatus;
  extracted_entities?: string[];
  event_type?: string;                  // "product_launch", "earnings", etc.

  // Deduplication
  content_hash: string;                 // SHA-256 of normalized content

  // Timestamps
  ingested_at: string;
  processed_at?: string;
}
```

### Candidate (Extracted Event)

```typescript
// Location: packages/shared-types/src/news.ts

export interface Candidate {
  id: string;                           // UUID
  news_id: string;                      // Source news item

  // Extracted info
  entities: string[];                   // Company names, products, people
  event_type: string;                   // Classification
  category_hint: MarketCategory;

  // Context
  relevant_text: string;                // Excerpt from news

  // Processing
  processed: boolean;
  draft_market_id?: string;

  created_at: string;
}
```

### Resolution Record

```typescript
// Location: packages/shared-types/src/resolution.ts

export type ResolutionStatus =
  | 'pending'         // Not yet resolved
  | 'resolved'        // Resolution submitted
  | 'disputed'        // Under dispute
  | 'finalized';      // Dispute window passed

export interface ResolutionRecord {
  id: string;                           // UUID
  market_id: string;                    // AI market metadata ID
  market_address: string;               // On-chain address

  // Result
  final_result: 'YES' | 'NO';
  resolution_source: string;            // URL used for resolution

  // Evidence
  evidence_hash: string;                // SHA-256 of fetched content
  evidence_raw: string;                 // Raw HTML/JSON (for audit)

  // Verification
  must_meet_all_results: {
    condition: string;
    met: boolean;
    evidence: string;
  }[];
  must_not_count_results: {
    condition: string;
    triggered: boolean;
    evidence?: string;
  }[];

  // Status
  status: ResolutionStatus;
  resolved_by: string;                  // "resolver_worker_v1"
  resolved_at: string;

  // On-chain
  tx_signature?: string;

  // Dispute window
  dispute_window_ends: string;          // ISO 8601
  finalized_at?: string;
}
```

### Dispute

```typescript
// Location: packages/shared-types/src/resolution.ts

export type DisputeStatus =
  | 'pending'         // Awaiting AI review
  | 'reviewing'       // AI is reviewing
  | 'upheld'          // Original resolution confirmed
  | 'overturned'      // Resolution changed
  | 'escalated';      // Sent to admin

export interface Dispute {
  id: string;                           // UUID
  resolution_id: string;
  market_address: string;

  // Disputant
  user_address: string;                 // Must hold YES or NO tokens
  user_token_balance: {
    yes: number;
    no: number;
  };

  // Dispute content
  reason: string;                       // User's explanation
  evidence_urls?: string[];             // User-provided sources

  // Review
  status: DisputeStatus;
  ai_review?: {
    decision: 'upheld' | 'overturned' | 'escalate';
    reasoning: string;
    reviewed_at: string;
  };
  admin_review?: {
    decision: 'upheld' | 'overturned';
    reasoning: string;
    admin_id: string;
    reviewed_at: string;
  };

  // Result
  new_result?: 'YES' | 'NO';            // If overturned

  created_at: string;
  resolved_at?: string;
}
```

### Audit Log

```typescript
// Location: packages/shared-types/src/api.ts

export type AuditAction =
  | 'proposal_submitted'
  | 'draft_generated'
  | 'validation_completed'
  | 'market_published'
  | 'resolution_started'
  | 'resolution_completed'
  | 'dispute_submitted'
  | 'dispute_resolved'
  | 'admin_action';

export interface AuditLog {
  id: string;                           // UUID

  // Context
  action: AuditAction;
  entity_type: 'proposal' | 'market' | 'resolution' | 'dispute';
  entity_id: string;

  // Details
  actor: string;                        // Worker ID, user address, or admin ID
  details: Record<string, unknown>;     // Action-specific data

  // AI tracking
  ai_version?: string;
  llm_request_id?: string;              // OpenAI request ID for debugging

  created_at: string;
}
```

### AI Config

```typescript
// Location: packages/shared-types/src/api.ts

export interface AIConfig {
  id: string;
  key: string;                          // Config key
  value: string;                        // JSON-encoded value
  updated_at: string;
  updated_by: string;
}

// Key config entries:
// - "ai_version": "v1.0"
// - "llm_model": "gpt-3.5-turbo"
// - "categories": ["politics", "product_launch", ...]
// - "rate_limits": { "propose_per_min": 3, ... }
```

---

## Queue Message Types

```typescript
// Location: packages/shared-types/src/queue.ts

export interface NewsRawMessage {
  news_id: string;
  source: string;
  url: string;
  title: string;
  content: string;
  published_at: string;
}

export interface CandidateMessage {
  candidate_id: string;
  news_id: string;
  entities: string[];
  event_type: string;
  category_hint: MarketCategory;
  relevant_text: string;
}

export interface DraftValidateMessage {
  draft_market_id: string;
  source_type: 'news' | 'proposal';
  source_id: string;
}

export interface MarketPublishMessage {
  draft_market_id: string;
  validation_id: string;
}

export interface MarketResolveMessage {
  market_id: string;
  market_address: string;
  expiry: string;
}

export interface DisputeMessage {
  dispute_id: string;
  resolution_id: string;
  market_address: string;
}
```

---

## Mapping: AI Draft → On-Chain Market

When publishing an AI-generated draft market to the blockchain:

| AI Market Metadata | CreateMarketParams | Notes |
|--------------------|-------------------|-------|
| `title` | `display_name` | Truncated to 64 chars |
| `resolution.expiry` | `ending_slot` | Converted from timestamp to slot |
| (not stored) | `yes_symbol` | Generated: "YES-{short_id}" |
| (not stored) | `yes_uri` | Points to metadata JSON |
| (default) | `start_slot` | Usually `None` (immediate) |
| `resolution.criteria` → AI estimate | `initial_yes_prob` | AI estimates initial probability |

The full resolution rules (`must_meet_all`, `allowed_sources`, etc.) remain in the PostgreSQL database, linked by `market_address`.
