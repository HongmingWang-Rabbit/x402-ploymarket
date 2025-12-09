# 7. Rule & Schema Templates

This document defines the schema templates and TypeScript types used across the AI prediction market system.

---

## Shared Types Package Location

All types are located in `packages/shared-types/src/`.

```
packages/shared-types/
├── src/
│   ├── index.ts          # Main exports
│   ├── market.ts         # Market types
│   ├── proposal.ts       # Proposal types
│   ├── resolution.ts     # Resolution types
│   ├── news.ts           # News/candidate types
│   ├── queue.ts          # Queue message types
│   └── api.ts            # API request/response types
├── package.json
└── tsconfig.json
```

---

## 7.1 Package Configuration

```json
// packages/shared-types/package.json
{
  "name": "@x402/shared-types",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

---

## 7.2 TypeScript Types

### Market Types

```typescript
// packages/shared-types/src/market.ts

export type MarketCategory =
  | 'politics'
  | 'product_launch'
  | 'finance'
  | 'sports'
  | 'entertainment'
  | 'technology'
  | 'misc';

export type MarketStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'resolving'
  | 'resolved'
  | 'finalized'
  | 'disputed'
  | 'canceled';

export interface AllowedSource {
  name: string;
  url: string;
  method: 'html_scrape' | 'api_check' | 'social_post';
  condition: string;
  selector?: string;
  json_path?: string;
}

export interface MachineResolutionLogic {
  if: string;
  then: 'YES' | 'NO';
  else: 'YES' | 'NO';
}

export interface ResolutionRules {
  type: 'binary';
  exact_question: string;
  criteria: {
    must_meet_all: string[];
    must_not_count: string[];
    allowed_sources: AllowedSource[];
    machine_resolution_logic: MachineResolutionLogic;
  };
  expiry: string;
}

export interface AIMarketMetadata {
  id: string;
  market_address: string | null;
  title: string;
  description: string;
  category: MarketCategory;
  image_url?: string;
  ai_version: string;
  confidence_score: number;
  source_proposal_id?: string;
  source_news_id?: string;
  resolution: ResolutionRules;
  status: MarketStatus;
  validation_decision?: ValidationDecision;
  created_at: string;
  published_at?: string;
  resolved_at?: string;
  finalized_at?: string;
  created_by: string;
}
```

### Proposal Types

```typescript
// packages/shared-types/src/proposal.ts

import { MarketCategory } from './market';

export type ProposalStatus =
  | 'pending'
  | 'processing'
  | 'matched'
  | 'draft_created'
  | 'approved'
  | 'rejected'
  | 'needs_human'
  | 'published';

export type ValidationStatus = 'approved' | 'rejected' | 'needs_human';

export interface ValidationDecision {
  status: ValidationStatus;
  reason: string;
  evidence: string[];
  validated_at: string;
  validated_by: string;
  rules_summary: {
    must_meet_all: string[];
    must_not_count: string[];
    allowed_sources: string[];
  };
}

export interface Proposal {
  id: string;
  user_id?: string;
  proposal_text: string;
  category_hint?: MarketCategory;
  status: ProposalStatus;
  matched_market_id?: string;
  draft_market_id?: string;
  confidence_score?: number;
  rejection_reason?: string;
  created_at: string;
  processed_at?: string;
  ip_address?: string;
}
```

### Resolution Types

```typescript
// packages/shared-types/src/resolution.ts

export type ResolutionStatus = 'pending' | 'resolved' | 'disputed' | 'finalized';
export type DisputeStatus = 'pending' | 'reviewing' | 'upheld' | 'overturned' | 'escalated';

export interface ResolutionRecord {
  id: string;
  market_id: string;
  market_address: string;
  final_result: 'YES' | 'NO';
  resolution_source: string;
  evidence_hash: string;
  evidence_raw: string;
  must_meet_all_results: Array<{
    condition: string;
    met: boolean;
    evidence: string;
  }>;
  must_not_count_results: Array<{
    condition: string;
    triggered: boolean;
    evidence?: string;
  }>;
  status: ResolutionStatus;
  resolved_by: string;
  resolved_at: string;
  tx_signature?: string;
  dispute_window_ends: string;
  finalized_at?: string;
}

export interface Dispute {
  id: string;
  resolution_id: string;
  market_address: string;
  user_address: string;
  user_token_balance: {
    yes: number;
    no: number;
  };
  reason: string;
  evidence_urls?: string[];
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
  new_result?: 'YES' | 'NO';
  created_at: string;
  resolved_at?: string;
}
```

### News Types

```typescript
// packages/shared-types/src/news.ts

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
```

### Queue Message Types

```typescript
// packages/shared-types/src/queue.ts

import { MarketCategory } from './market';

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

### API Types

```typescript
// packages/shared-types/src/api.ts

import { AIMarketMetadata, MarketCategory } from './market';
import { ValidationDecision } from './proposal';
import { ResolutionRules } from './market';

// Request types
export interface ProposeRequest {
  proposal_text: string;
  category_hint?: MarketCategory;
  user_id?: string;
}

export interface ReviewProposalRequest {
  decision: 'approve' | 'reject';
  modifications?: Partial<AIMarketMetadata>;
  reason: string;
}

export interface DisputeRequest {
  market_address: string;
  reason: string;
  evidence_urls?: string[];
}

// Response types
export interface ProposeResponse {
  proposal_id: string;
  status: string;
  existing_market: {
    id: string;
    market_address: string;
    title: string;
    similarity_score: number;
  } | null;
  draft_market: {
    id: string;
    title: string;
    description: string;
    category: MarketCategory;
    confidence_score: number;
    resolution: ResolutionRules;
  } | null;
  validation_status?: string;
  rules_summary?: {
    must_meet_all: string[];
    must_not_count: string[];
    allowed_sources: string[];
  };
}

// Audit types
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
  id: string;
  action: AuditAction;
  entity_type: 'proposal' | 'market' | 'resolution' | 'dispute';
  entity_id: string;
  actor: string;
  details: Record<string, unknown>;
  ai_version?: string;
  llm_request_id?: string;
  created_at: string;
}

export interface AIConfig {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  updated_by: string;
}
```

### Index Export

```typescript
// packages/shared-types/src/index.ts

export * from './market';
export * from './proposal';
export * from './resolution';
export * from './news';
export * from './queue';
export * from './api';
```

---

## 7.3 JSON Schema for Validation

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AIMarketMetadata",
  "type": "object",
  "required": ["id", "title", "description", "category", "ai_version", "confidence_score", "resolution", "status", "created_at", "created_by"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "market_address": { "type": ["string", "null"] },
    "title": { "type": "string", "maxLength": 256 },
    "description": { "type": "string" },
    "category": {
      "type": "string",
      "enum": ["politics", "product_launch", "finance", "sports", "entertainment", "technology", "misc"]
    },
    "image_url": { "type": "string", "format": "uri" },
    "ai_version": { "type": "string" },
    "confidence_score": { "type": "number", "minimum": 0, "maximum": 1 },
    "resolution": {
      "type": "object",
      "required": ["type", "exact_question", "criteria", "expiry"],
      "properties": {
        "type": { "type": "string", "enum": ["binary"] },
        "exact_question": { "type": "string" },
        "criteria": {
          "type": "object",
          "required": ["must_meet_all", "must_not_count", "allowed_sources", "machine_resolution_logic"],
          "properties": {
            "must_meet_all": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
            "must_not_count": { "type": "array", "items": { "type": "string" } },
            "allowed_sources": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["name", "url", "method", "condition"],
                "properties": {
                  "name": { "type": "string" },
                  "url": { "type": "string", "format": "uri" },
                  "method": { "type": "string", "enum": ["html_scrape", "api_check", "social_post"] },
                  "condition": { "type": "string" }
                }
              },
              "minItems": 1
            },
            "machine_resolution_logic": {
              "type": "object",
              "required": ["if", "then", "else"],
              "properties": {
                "if": { "type": "string" },
                "then": { "type": "string", "enum": ["YES", "NO"] },
                "else": { "type": "string", "enum": ["YES", "NO"] }
              }
            }
          }
        },
        "expiry": { "type": "string", "format": "date-time" }
      }
    },
    "status": {
      "type": "string",
      "enum": ["draft", "pending_review", "active", "resolving", "resolved", "finalized", "disputed", "canceled"]
    },
    "created_at": { "type": "string", "format": "date-time" },
    "created_by": { "type": "string" }
  }
}
```

---

## 7.4 Using in Backend/Workers/Frontend

### Backend

```typescript
// prediction-market-back-end/package.json
{
  "dependencies": {
    "@x402/shared-types": "workspace:*"
  }
}

// Usage
import { AIMarketMetadata, ProposeRequest, ProposeResponse } from '@x402/shared-types';
```

### Workers

```typescript
// workers/package.json
{
  "dependencies": {
    "@x402/shared-types": "workspace:*"
  }
}

// Usage
import { CandidateMessage, MarketResolveMessage } from '@x402/shared-types';
```

### Frontend

```typescript
// ai-prediction-market-front-end/package.json
{
  "dependencies": {
    "@x402/shared-types": "workspace:*"
  }
}

// Usage
import type { AIMarketMetadata, ResolutionRules } from '@x402/shared-types';
```
