# 8. Oracles & Deterministic Resolution

This document describes how market outcomes are determined using official sources, ensuring that all resolution is deterministic, auditable, and machine-verifiable.

---

## 8.1 Oracle Types

### Official Website Oracle

Fetches data from official company/product websites.

- **Method**: HTML scraping, API requests
- **Validation**: Ensure page contains required proof elements
- **Examples**:
  - Product pages (apple.com/shop)
  - Press release pages (newsroom.example.com)
  - Official documentation

```typescript
// Example allowed source
{
  "name": "Apple Store - iPhone",
  "url": "https://www.apple.com/shop/buy-iphone",
  "method": "html_scrape",
  "condition": "Page contains 'iPhone 16' with 'Buy' button visible",
  "selector": ".as-productinfosection-mainpanel"
}
```

### Official Social Media Oracle

Checks verified company accounts on social platforms.

- **Method**: Platform APIs or RSS feeds
- **Validation**: Posts must be from verified official accounts
- **Supported Platforms**: Twitter/X, LinkedIn, Facebook

```typescript
// Example allowed source
{
  "name": "Apple Twitter",
  "url": "https://twitter.com/Apple",
  "method": "social_post",
  "condition": "Tweet from @Apple mentions 'iPhone 16 available'"
}
```

### Official API Oracle

Uses official data feeds for structured data.

- **Method**: REST/GraphQL API calls
- **Validation**: Verify data matches expected schema
- **Examples**:
  - Sports APIs (official league APIs)
  - Financial APIs (official exchange APIs)
  - Government APIs (election results)

```typescript
// Example allowed source
{
  "name": "Federal Reserve API",
  "url": "https://api.federalreserve.gov/data",
  "method": "api_check",
  "condition": "interest_rate value increased from previous",
  "json_path": "$.data.currentRate"
}
```

---

## 8.2 Source Verification Rules

### Allowed Sources

- Official company websites (HTTPS only)
- Official social media accounts (verified)
- Official government APIs
- Official press release pages

### Not Allowed

- Screenshots (easily faked)
- Blogs or opinion sites
- User-generated content
- News articles (second-hand information)
- Shortened or redirect URLs
- Non-HTTPS sources

---

## 8.3 Resolver Worker Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Resolver Worker                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Receive MarketResolveMessage from queue                 │
│     - market_id, market_address, expiry                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Fetch market from database                              │
│     - Get resolution rules (must_meet_all, allowed_sources) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Fetch evidence from allowed_sources                     │
│     - For each source: HTTP GET with timeout                │
│     - Store raw HTML/JSON response                          │
│     - Compute SHA-256 hash of content                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Apply resolution logic via LLM                          │
│     - Pass market rules + fetched content to LLM            │
│     - LLM evaluates each must_meet_all condition            │
│     - LLM checks must_not_count conditions                  │
│     - LLM applies machine_resolution_logic                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Store resolution record                                 │
│     - final_result: YES or NO                               │
│     - evidence_hash: SHA-256                                │
│     - evidence_raw: full content                            │
│     - must_meet_all_results: per-condition results          │
│     - must_not_count_results: per-condition results         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Submit on-chain resolution                              │
│     - Call resolution instruction on Solana                 │
│     - Set winner_token_type (0=NO, 1=YES)                   │
│     - Store tx_signature                                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Update market status                                    │
│     - status: 'resolved'                                    │
│     - dispute_window_ends: NOW + 24 hours                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 8.4 Resolution Logic

### Condition Evaluation

```typescript
// workers/src/resolver.ts

interface ConditionResult {
  condition: string;
  met: boolean;
  evidence: string;
}

async function evaluateConditions(
  content: string,
  conditions: string[]
): Promise<ConditionResult[]> {
  const result = await callLLM('resolution', {
    content,
    conditions
  });

  return result.must_meet_all_results;
}
```

### Final Result Computation

```typescript
function computeFinalResult(
  mustMeetAll: ConditionResult[],
  mustNotCount: ConditionResult[],
  logic: MachineResolutionLogic
): 'YES' | 'NO' {
  const allMet = mustMeetAll.every(c => c.met);
  const anyExclusionTriggered = mustNotCount.some(c => c.triggered);

  if (allMet && !anyExclusionTriggered) {
    return logic.then;  // Usually 'YES'
  } else {
    return logic.else;  // Usually 'NO'
  }
}
```

---

## 8.5 Dispute Flow

### Dispute Submission

1. User submits dispute via `POST /api/v1/disputes`
2. API verifies user holds YES or NO tokens for this market
3. Dispute is queued for Dispute Agent

### Dispute Agent Processing

```
┌─────────────────────────────────────────────────────────────┐
│                    Dispute Agent Worker                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Fetch dispute, resolution, and market from DB           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Re-fetch evidence from allowed_sources                  │
│     - Compare with original resolution evidence             │
│     - Check if content has changed                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Review user-provided evidence URLs                      │
│     - Verify they are allowed sources                       │
│     - Fetch and analyze content                             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  4. LLM analysis                                            │
│     - Is disputant's claim valid?                           │
│     - Does new evidence change the outcome?                 │
│     - Apply dispute_review prompt                           │
└──────────────────────────────┬──────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │   Uphold    │     │  Overturn   │     │  Escalate   │
    │             │     │             │     │             │
    │  Original   │     │  Change     │     │  Admin      │
    │  result     │     │  result     │     │  review     │
    │  correct    │     │  on-chain   │     │  needed     │
    └─────────────┘     └─────────────┘     └─────────────┘
```

### Dispute Resolution Outcomes

| Decision | Action |
|----------|--------|
| Upheld | Original resolution stands, dispute marked as `upheld` |
| Overturned | New resolution submitted on-chain, result changed |
| Escalated | Dispute sent to admin queue for human review |

### Admin Review (Escalated Disputes)

1. Admin sees dispute in `/admin/disputes` page
2. Admin reviews:
   - Original resolution evidence
   - Disputant's claim and evidence
   - AI's reasoning for escalation
3. Admin makes final decision:
   - Uphold: Confirm original resolution
   - Overturn: Change result on-chain

---

## 8.6 Evidence Storage

All resolution evidence is stored for audit:

```typescript
interface StoredEvidence {
  evidence_hash: string;      // SHA-256 of raw content
  evidence_raw: string;       // Full HTML/JSON content
  fetched_at: string;         // Timestamp
  source_url: string;         // URL fetched
}
```

Evidence is stored in the `resolutions` table in PostgreSQL.

---

## 8.7 Edge Cases

### Source Unreachable

If an allowed source is unreachable at resolution time:

1. Retry 3 times with exponential backoff
2. If still unreachable, mark resolution as `failed`
3. Send to DLQ for manual review
4. Admin can manually resolve or wait for source recovery

### Timing Edge Cases

For time-sensitive markets:

1. Resolver fetches evidence as close to expiry as possible
2. Timestamp of fetch is recorded
3. If disputed due to timing:
   - Compare fetch time with evidence timestamp
   - Consider web archive if available

### Conflicting Sources

If multiple allowed sources give conflicting information:

1. LLM identifies the conflict
2. Resolution marked as `needs_review`
3. Admin makes final determination

---

## 8.8 Finalization

After the 24-hour dispute window:

1. Scheduler cron checks for resolved markets past dispute window
2. If no disputes or all disputes resolved:
   - Update status to `finalized`
   - Claims are enabled on-chain
3. If active dispute:
   - Wait for dispute resolution
   - Extend finalization until dispute resolved
