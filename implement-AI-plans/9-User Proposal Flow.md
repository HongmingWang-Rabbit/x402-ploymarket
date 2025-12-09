# 9. User Proposal Flow

This document describes the complete user journey from proposal submission to market publication, including the frontend integration.

---

## 9.1 Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Proposal Flow                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User                   Frontend               Backend              Workers  │
│   │                        │                      │                    │     │
│   │  Fill proposal form    │                      │                    │     │
│   │───────────────────────▶│                      │                    │     │
│   │                        │                      │                    │     │
│   │                        │  POST /api/v1/propose│                    │     │
│   │                        │─────────────────────▶│                    │     │
│   │                        │                      │                    │     │
│   │                        │                      │  Check duplicates  │     │
│   │                        │                      │──────────────────▶│     │
│   │                        │                      │                    │     │
│   │                        │                      │  Queue: candidates │     │
│   │                        │                      │───────────────────▶│     │
│   │                        │                      │                    │     │
│   │                        │                      │         ┌──────────┤     │
│   │                        │                      │         │Generator │     │
│   │                        │                      │         │  Worker  │     │
│   │                        │                      │         └──────────┤     │
│   │                        │                      │                    │     │
│   │                        │                      │         ┌──────────┤     │
│   │                        │                      │         │Validator │     │
│   │                        │                      │         │  Worker  │     │
│   │                        │                      │         └──────────┤     │
│   │                        │                      │                    │     │
│   │                        │  Response: draft +   │                    │     │
│   │                        │  validation + rules  │                    │     │
│   │                        │◀─────────────────────│                    │     │
│   │                        │                      │                    │     │
│   │  Show draft preview    │                      │                    │     │
│   │◀───────────────────────│                      │                    │     │
│   │                        │                      │                    │     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9.2 Frontend Integration

### Proposal Page

**Path**: `/app/propose/page.tsx`

```typescript
// app/propose/page.tsx

'use client';

import { useState } from 'react';
import { ProposalForm } from '@/features/proposals/components/ProposalForm';
import { DraftPreview } from '@/features/proposals/components/DraftPreview';
import { ExistingMarketMatch } from '@/features/proposals/components/ExistingMarketMatch';
import { useSubmitProposal } from '@/features/proposals/hooks/useSubmitProposal';

export default function ProposePage() {
  const { mutate: submit, data, isLoading, isError, error } = useSubmitProposal();
  const [showResult, setShowResult] = useState(false);

  const handleSubmit = async (proposal: ProposalInput) => {
    await submit(proposal);
    setShowResult(true);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Propose a Market</h1>

      <ProposalForm onSubmit={handleSubmit} isLoading={isLoading} />

      {isLoading && <ProcessingIndicator />}

      {isError && <ErrorMessage error={error} />}

      {showResult && data && (
        <>
          {data.status === 'matched' && data.existing_market && (
            <ExistingMarketMatch market={data.existing_market} />
          )}

          {data.draft_market && (
            <DraftPreview
              draft={data.draft_market}
              validationStatus={data.validation_status}
              rulesSummary={data.rules_summary}
            />
          )}

          {data.validation_status === 'needs_human' && (
            <NeedsHumanNotice reason={data.draft_market.validation_decision?.reason} />
          )}
        </>
      )}
    </div>
  );
}
```

### Form Submission

```typescript
// features/proposals/hooks/useSubmitProposal.ts

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ProposeRequest, ProposeResponse } from '@x402/shared-types';

export function useSubmitProposal() {
  return useMutation({
    mutationFn: async (input: ProposeRequest): Promise<ProposeResponse> => {
      const response = await apiClient.post('/api/v1/propose', input);
      return response.data;
    },
    onError: (error: any) => {
      if (error.response?.status === 429) {
        // Rate limited - show retry message
      }
    }
  });
}
```

---

## 9.3 Backend Processing

### Proposal Endpoint

```typescript
// prediction-market-back-end/src/routes/v1/propose.ts

import { FastifyInstance } from 'fastify';
import { ProposeRequest, ProposeResponse } from '@x402/shared-types';
import { checkDuplicates } from '../services/duplicate.service';
import { publishMessage } from '../services/queue.service';

export async function proposeRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: ProposeRequest }>('/propose', {
    preHandler: [fastify.rateLimitMiddleware],
    handler: async (request, reply) => {
      const { proposal_text, category_hint, user_id } = request.body;

      // 1. Safety pre-filter
      const safetyCheck = filterProposalText(proposal_text);
      if (!safetyCheck.safe) {
        return reply.status(400).send({
          error: 'unsafe_content',
          message: 'Proposal contains inappropriate content',
          issues: safetyCheck.issues
        });
      }

      // 2. Create proposal record
      const proposalId = await createProposal({
        proposal_text,
        category_hint,
        user_id: user_id || request.user?.id,
        ip_address: request.ip
      });

      // 3. Check for existing similar markets
      const duplicates = await checkDuplicates(proposal_text);
      if (duplicates.length > 0 && duplicates[0].similarity > 0.9) {
        await updateProposal(proposalId, {
          status: 'matched',
          matched_market_id: duplicates[0].id
        });

        return reply.send({
          proposal_id: proposalId,
          status: 'matched',
          existing_market: {
            id: duplicates[0].id,
            market_address: duplicates[0].market_address,
            title: duplicates[0].title,
            similarity_score: duplicates[0].similarity
          },
          draft_market: null
        });
      }

      // 4. Queue for AI generation
      await publishMessage('candidates', {
        candidate_id: crypto.randomUUID(),
        news_id: null,
        entities: [],
        event_type: 'user_proposal',
        category_hint: category_hint || 'misc',
        relevant_text: proposal_text,
        proposal_id: proposalId
      });

      // 5. Wait for processing (with timeout)
      const result = await waitForProcessing(proposalId, 30000);

      return reply.send(result);
    }
  });
}
```

### Processing Workflow

```typescript
// prediction-market-back-end/src/services/proposal.service.ts

async function waitForProcessing(
  proposalId: string,
  timeout: number
): Promise<ProposeResponse> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const proposal = await getProposal(proposalId);

    if (proposal.status === 'draft_created' || proposal.status === 'approved' ||
        proposal.status === 'rejected' || proposal.status === 'needs_human') {
      const draft = proposal.draft_market_id
        ? await getDraftMarket(proposal.draft_market_id)
        : null;

      return {
        proposal_id: proposalId,
        status: proposal.status,
        existing_market: null,
        draft_market: draft ? {
          id: draft.id,
          title: draft.title,
          description: draft.description,
          category: draft.category,
          confidence_score: draft.confidence_score,
          resolution: draft.resolution
        } : null,
        validation_status: draft?.validation_decision?.status,
        rules_summary: draft?.validation_decision?.rules_summary
      };
    }

    // Poll every 500ms
    await sleep(500);
  }

  // Timeout - return pending status
  return {
    proposal_id: proposalId,
    status: 'processing',
    existing_market: null,
    draft_market: null
  };
}
```

---

## 9.4 AI Generation

### Generator Worker (User Proposals)

```typescript
// workers/src/generator.ts

// Handle user proposals differently from news candidates
async function handleUserProposal(message: CandidateMessage & { proposal_id?: string }) {
  if (!message.proposal_id) {
    return handleNewsCandidate(message);
  }

  // User proposal flow
  const llmResponse = await callLLM('market_generation', {
    input: {
      proposal_text: message.relevant_text,
      category_hint: message.category_hint
    }
  });

  const draft = createDraftMarket(llmResponse, {
    source_proposal_id: message.proposal_id,
    created_by: 'generator_worker_v1'
  });

  await saveDraft(draft);

  // Update proposal
  await updateProposal(message.proposal_id, {
    status: 'draft_created',
    draft_market_id: draft.id,
    confidence_score: draft.confidence_score
  });

  // Queue for validation
  await publishMessage('drafts.validate', {
    draft_market_id: draft.id,
    source_type: 'proposal',
    source_id: message.proposal_id
  });
}
```

---

## 9.5 Validation

### Validator Worker

```typescript
// workers/src/validator.ts

async function validateDraft(message: DraftValidateMessage) {
  const draft = await getDraft(message.draft_market_id);
  const result = await runValidation(draft);

  // Update draft with validation decision
  await updateDraft(message.draft_market_id, {
    status: result.decision === 'approved' ? 'approved' :
            result.decision === 'needs_human' ? 'pending_review' : 'rejected',
    validation_decision: {
      status: result.decision,
      reason: result.reason,
      evidence: result.evidence,
      validated_at: new Date().toISOString(),
      validated_by: 'validator_worker_v1',
      rules_summary: {
        must_meet_all: draft.resolution.criteria.must_meet_all,
        must_not_count: draft.resolution.criteria.must_not_count,
        allowed_sources: draft.resolution.criteria.allowed_sources.map(s => s.name)
      }
    }
  });

  // Update proposal status
  if (message.source_type === 'proposal') {
    await updateProposal(message.source_id, {
      status: result.decision
    });
  }

  // If approved, queue for publishing
  if (result.decision === 'approved') {
    await publishMessage('markets.publish', {
      draft_market_id: message.draft_market_id,
      validation_id: result.id
    });
  }
}
```

---

## 9.6 Status States

### Proposal Status Flow

```
pending → processing → matched (if duplicate found)
                    ↘
                      draft_created → approved → published
                                   → rejected
                                   → needs_human → approved (by admin)
                                                 → rejected (by admin)
```

### Frontend Status Display

```typescript
// features/proposals/components/ProposalStatusBadge.tsx

const STATUS_CONFIG = {
  pending: { color: 'gray', label: 'Pending' },
  processing: { color: 'blue', label: 'Processing...', animate: true },
  matched: { color: 'yellow', label: 'Similar Market Found' },
  draft_created: { color: 'blue', label: 'Draft Created' },
  approved: { color: 'green', label: 'Approved' },
  rejected: { color: 'red', label: 'Rejected' },
  needs_human: { color: 'orange', label: 'Under Review' },
  published: { color: 'green', label: 'Published' }
};

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge color={config.color} animate={config.animate}>
      {config.label}
    </Badge>
  );
}
```

---

## 9.7 Error Handling

### Rate Limit Error

```typescript
// Frontend handling
if (error.response?.status === 429) {
  const retryAfter = error.response.headers['retry-after'];
  showToast({
    type: 'warning',
    message: `Too many proposals. Please wait ${formatDuration(retryAfter)}.`
  });
}
```

### Safety Filter Error

```typescript
if (error.response?.data?.error === 'unsafe_content') {
  showToast({
    type: 'error',
    message: 'Your proposal contains content that cannot be processed.'
  });
}
```

### Processing Timeout

If processing takes longer than expected:

1. Return `status: 'processing'`
2. Frontend shows "Processing..." with option to check later
3. User can poll for status using `GET /api/v1/proposals/{id}`

---

## 9.8 Admin Review Flow

### `needs_human` Proposals

When a proposal is flagged for human review:

1. **Frontend**: Shows "Under Review" badge with explanation
2. **Admin Panel**: Proposal appears in `/admin/proposals`
3. **Admin Actions**:
   - View draft and validation details
   - Modify resolution rules if needed
   - Approve (queue for publishing) or Reject

### Admin Review Endpoint

```typescript
// POST /api/v1/admin/proposals/{proposal_id}/review

{
  "decision": "approve",
  "modifications": {
    "resolution": {
      "criteria": {
        "must_meet_all": ["Updated condition..."]
      }
    }
  },
  "reason": "Clarified resolution criteria"
}
```

After admin approval:
1. Draft is updated with modifications
2. Draft status changes to `approved`
3. Proposal status changes to `approved`
4. Market is queued for publishing
5. User can see their market is now active

---

## 9.9 Complete Example

### User Submits: "Will Apple release iPhone 16 before September?"

**Step 1: Submit**
```json
POST /api/v1/propose
{
  "proposal_text": "Will Apple release iPhone 16 before September?",
  "category_hint": "product_launch"
}
```

**Step 2: No Duplicate Found** → Queue for generation

**Step 3: AI Generates Draft**
```json
{
  "title": "iPhone 16 Release by September 2024",
  "confidence_score": 0.85,
  "resolution": {
    "exact_question": "Will Apple make iPhone 16 available...",
    "criteria": { ... }
  }
}
```

**Step 4: Validator Approves**
```json
{
  "status": "approved",
  "reason": "Clear, deterministic rules with official sources"
}
```

**Step 5: Response to User**
```json
{
  "proposal_id": "abc123",
  "status": "approved",
  "draft_market": { ... },
  "validation_status": "approved",
  "rules_summary": {
    "must_meet_all": ["Available on apple.com", "Buy button visible"],
    "must_not_count": ["Pre-orders", "Beta devices"],
    "allowed_sources": ["Apple Official Website"]
  }
}
```

**Step 6: Publisher Creates On-Chain Market**

User can now see their market is live!
