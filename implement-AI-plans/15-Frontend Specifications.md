# 15. Frontend Specifications

This document defines the new frontend components and pages for the AI prediction market system.

---

## Overview

The frontend extends the existing Next.js application with:
- User proposal submission page
- Admin pages for reviewing proposals and disputes
- AI configuration management
- Integration with AI-enhanced market data

---

## New Pages

### 1. User Proposal Page

**Path**: `/app/propose/page.tsx`

A page where users can submit market proposals in natural language.

```
┌─────────────────────────────────────────────────────────────────┐
│  Header                                              [Connect]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Propose a Market                       │   │
│  │                                                          │   │
│  │  What do you want to predict?                           │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ e.g., "Will Apple release iPhone 16 before         │ │   │
│  │  │ September 2024?"                                    │ │   │
│  │  │                                                     │ │   │
│  │  │                                                     │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │  Category (optional)                                     │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ Select category...                              ▼ │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │                                    [ Submit Proposal ]   │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Processing...                         │   │
│  │  ████████████████░░░░░░░░░░░░░░░                        │   │
│  │  Checking for existing markets...                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Draft Preview                         │   │
│  │                                                          │   │
│  │  Title: iPhone 16 Release by September 2024             │   │
│  │  Confidence: ████████░░ 85%                             │   │
│  │                                                          │   │
│  │  Resolution Question:                                    │   │
│  │  "Will Apple publicly release iPhone 16 for purchase    │   │
│  │   before September 30, 2024 UTC?"                        │   │
│  │                                                          │   │
│  │  ┌─ Must Meet All ─────────────────────────────────┐   │   │
│  │  │ ✓ Available for purchase on apple.com           │   │   │
│  │  │ ✓ 'Buy' button visible (not pre-order)         │   │   │
│  │  │ ✓ Before September 30, 2024 23:59:59 UTC       │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  ┌─ Does Not Count ────────────────────────────────┐   │   │
│  │  │ ✗ Pre-order availability                        │   │   │
│  │  │ ✗ Developer or beta devices                     │   │   │
│  │  │ ✗ Leaked or rumored information                 │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  ┌─ Verification Sources ──────────────────────────┐   │   │
│  │  │ 📎 Apple Official Website                       │   │   │
│  │  │    https://www.apple.com/iphone                 │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  Status: ✅ Approved - Publishing...                    │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2. Admin Proposals Page

**Path**: `/app/admin/proposals/page.tsx`

Admin page to review proposals that need human intervention.

```
┌─────────────────────────────────────────────────────────────────┐
│  Header                                              [Connect]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Admin > Proposals                                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Filter: [All ▼]  [Needs Review ▼]     Search: [____]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ⚠️ Needs Review                                         │   │
│  │                                                          │   │
│  │  "Will Tesla announce FSD v13 at AI Day?"               │   │
│  │  Submitted: 2 hours ago                                  │   │
│  │                                                          │   │
│  │  Issue: Ambiguous resolution criteria                    │   │
│  │  Details: "Announce" could mean demo, availability,      │   │
│  │           or formal announcement                         │   │
│  │                                                          │   │
│  │                           [View Details] [Approve] [Reject]│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ⚠️ Needs Review                                         │   │
│  │                                                          │   │
│  │  "Will the Fed raise rates in December?"                │   │
│  │  Submitted: 5 hours ago                                  │   │
│  │                                                          │   │
│  │  Issue: Source unreachable                               │   │
│  │  Details: federalreserve.gov returned 503               │   │
│  │                                                          │   │
│  │                           [View Details] [Approve] [Reject]│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3. Admin Disputes Page

**Path**: `/app/admin/disputes/page.tsx`

Admin page to review escalated disputes.

```
┌─────────────────────────────────────────────────────────────────┐
│  Header                                              [Connect]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Admin > Disputes                                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🔴 Escalated                                            │   │
│  │                                                          │   │
│  │  Market: "iPhone 16 Release by September 2024"          │   │
│  │  Original Result: NO                                     │   │
│  │                                                          │   │
│  │  Disputant: 7xKp...3mNq (holds 500 YES tokens)          │   │
│  │  Submitted: 12 hours ago                                 │   │
│  │                                                          │   │
│  │  Reason: "The resolution was checked at 11:58 PM UTC,   │   │
│  │  but the product page updated at 11:59 PM with the      │   │
│  │  Buy button. The evidence screenshot shows..."          │   │
│  │                                                          │   │
│  │  AI Review: Inconclusive - timing edge case             │   │
│  │                                                          │   │
│  │  Evidence provided:                                      │   │
│  │  📎 https://web.archive.org/...                         │   │
│  │                                                          │   │
│  │            [View Full Details] [Uphold NO] [Overturn YES]│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4. Admin AI Config Page

**Path**: `/app/admin/ai-config/page.tsx`

Admin page to manage AI configuration.

```
┌─────────────────────────────────────────────────────────────────┐
│  Header                                              [Connect]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Admin > AI Configuration                                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  AI Version                                              │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ v1.0                                               │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │  ⚠️ Changing version creates new audit trail            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  LLM Model                                               │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ gpt-3.5-turbo                                   ▼ │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Rate Limits                                             │   │
│  │                                                          │   │
│  │  Proposals per minute:  [3 ]                            │   │
│  │  Proposals per hour:    [20]                            │   │
│  │  Proposals per day:     [100]                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Categories                                              │   │
│  │  ☑ politics  ☑ product_launch  ☑ finance               │   │
│  │  ☑ sports    ☑ entertainment   ☑ technology  ☑ misc    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                                              [ Save Changes ]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature Module: proposals

**Path**: `/features/proposals/`

```
features/proposals/
├── hooks/
│   ├── useSubmitProposal.ts      # Submit proposal mutation
│   ├── useProposalStatus.ts      # Poll for proposal status
│   ├── useAdminProposals.ts      # Fetch proposals for admin
│   ├── useReviewProposal.ts      # Approve/reject proposal
│   └── index.ts
├── components/
│   ├── ProposalForm.tsx          # Main proposal form
│   ├── DraftPreview.tsx          # Preview AI-generated draft
│   ├── RulesDisplay.tsx          # Display must_meet_all, etc.
│   ├── ConfidenceScore.tsx       # Visual confidence indicator
│   ├── ProposalStatusBadge.tsx   # Status badge component
│   ├── ProposalList.tsx          # List for admin page
│   ├── ProposalReviewModal.tsx   # Review modal for admin
│   └── index.ts
├── types.ts                       # Proposal types
├── api.ts                         # API functions
└── index.ts
```

---

## Component Specifications

### ProposalForm

```typescript
// features/proposals/components/ProposalForm.tsx

interface ProposalFormProps {
  onSubmit: (proposal: ProposalInput) => void;
  isLoading: boolean;
}

interface ProposalInput {
  proposal_text: string;
  category_hint?: MarketCategory;
}

export function ProposalForm({ onSubmit, isLoading }: ProposalFormProps) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<MarketCategory | undefined>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Propose a Market</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label>What do you want to predict?</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g., Will Apple release iPhone 16 before September 2024?"
              rows={4}
            />
          </div>

          <div>
            <label>Category (optional)</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => onSubmit({ proposal_text: text, category_hint: category })}
            disabled={!text || isLoading}
          >
            {isLoading ? 'Processing...' : 'Submit Proposal'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### DraftPreview

```typescript
// features/proposals/components/DraftPreview.tsx

interface DraftPreviewProps {
  draft: DraftMarket;
  validationStatus: ValidationStatus;
}

export function DraftPreview({ draft, validationStatus }: DraftPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Draft Preview
          <ProposalStatusBadge status={validationStatus} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold">{draft.title}</h3>
          <ConfidenceScore score={draft.confidence_score} />
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-500">Resolution Question</h4>
          <p className="italic">"{draft.resolution.exact_question}"</p>
        </div>

        <RulesDisplay
          mustMeetAll={draft.resolution.criteria.must_meet_all}
          mustNotCount={draft.resolution.criteria.must_not_count}
          allowedSources={draft.resolution.criteria.allowed_sources}
        />
      </CardContent>
    </Card>
  );
}
```

### RulesDisplay

```typescript
// features/proposals/components/RulesDisplay.tsx

interface RulesDisplayProps {
  mustMeetAll: string[];
  mustNotCount: string[];
  allowedSources: AllowedSource[];
}

export function RulesDisplay({ mustMeetAll, mustNotCount, allowedSources }: RulesDisplayProps) {
  return (
    <div className="space-y-3">
      <div className="border rounded-lg p-3 bg-green-50">
        <h4 className="text-sm font-medium text-green-700 mb-2">Must Meet All</h4>
        <ul className="space-y-1">
          {mustMeetAll.map((condition, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
              {condition}
            </li>
          ))}
        </ul>
      </div>

      <div className="border rounded-lg p-3 bg-red-50">
        <h4 className="text-sm font-medium text-red-700 mb-2">Does Not Count</h4>
        <ul className="space-y-1">
          {mustNotCount.map((condition, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
              {condition}
            </li>
          ))}
        </ul>
      </div>

      <div className="border rounded-lg p-3 bg-blue-50">
        <h4 className="text-sm font-medium text-blue-700 mb-2">Verification Sources</h4>
        <ul className="space-y-1">
          {allowedSources.map((source, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Link className="w-4 h-4 text-blue-600 mt-0.5" />
              <div>
                <span className="font-medium">{source.name}</span>
                <br />
                <a href={source.url} className="text-xs text-blue-600 hover:underline" target="_blank">
                  {source.url}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

### ConfidenceScore

```typescript
// features/proposals/components/ConfidenceScore.tsx

interface ConfidenceScoreProps {
  score: number;  // 0.0 - 1.0
}

export function ConfidenceScore({ score }: ConfidenceScoreProps) {
  const percentage = Math.round(score * 100);
  const color = score >= 0.8 ? 'bg-green-500' : score >= 0.6 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Confidence:</span>
      <div className="flex-1 h-2 bg-gray-200 rounded-full max-w-32">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium">{percentage}%</span>
    </div>
  );
}
```

---

## Hooks

### useSubmitProposal

```typescript
// features/proposals/hooks/useSubmitProposal.ts

import { useMutation } from '@tanstack/react-query';
import { submitProposal } from '../api';

export function useSubmitProposal() {
  return useMutation({
    mutationFn: submitProposal,
    onSuccess: (data) => {
      // Handle success
    },
    onError: (error) => {
      // Handle error (rate limit, etc.)
    }
  });
}
```

### useAdminProposals

```typescript
// features/proposals/hooks/useAdminProposals.ts

import { useQuery } from '@tanstack/react-query';
import { getAdminProposals } from '../api';

interface UseAdminProposalsOptions {
  status?: 'needs_human' | 'all';
  limit?: number;
  offset?: number;
}

export function useAdminProposals(options: UseAdminProposalsOptions = {}) {
  return useQuery({
    queryKey: ['admin', 'proposals', options],
    queryFn: () => getAdminProposals(options),
    enabled: true,  // Should check admin status
  });
}
```

---

## API Functions

```typescript
// features/proposals/api.ts

import { apiClient } from '@/lib/api/client';
import { ProposalInput, ProposalResponse, AdminProposal, ReviewDecision } from './types';

export async function submitProposal(input: ProposalInput): Promise<ProposalResponse> {
  const response = await apiClient.post('/api/v1/propose', input);
  return response.data;
}

export async function getAdminProposals(options: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ proposals: AdminProposal[]; total: number }> {
  const response = await apiClient.get('/api/v1/admin/proposals', { params: options });
  return response.data;
}

export async function reviewProposal(
  proposalId: string,
  decision: ReviewDecision
): Promise<void> {
  await apiClient.post(`/api/v1/admin/proposals/${proposalId}/review`, decision);
}
```

---

## Types

```typescript
// features/proposals/types.ts

export interface ProposalInput {
  proposal_text: string;
  category_hint?: MarketCategory;
  user_id?: string;
}

export interface ProposalResponse {
  proposal_id: string;
  status: ProposalStatus;
  existing_market: ExistingMarket | null;
  draft_market: DraftMarket | null;
  validation_status?: ValidationStatus;
  rules_summary?: RulesSummary;
}

export interface DraftMarket {
  id: string;
  title: string;
  description: string;
  category: MarketCategory;
  confidence_score: number;
  resolution: ResolutionRules;
}

export interface RulesSummary {
  must_meet_all: string[];
  must_not_count: string[];
  allowed_sources: string[];
}

export interface AdminProposal extends Proposal {
  draft_market: DraftMarket;
  validation_decision: ValidationDecision;
}

export interface ReviewDecision {
  decision: 'approve' | 'reject';
  modifications?: Partial<DraftMarket>;
  reason: string;
}
```

---

## Integration with Existing Components

### Market Detail Page Enhancement

Update the market detail page to show AI-generated resolution rules:

```typescript
// components/market/MarketResolutionRules.tsx

export function MarketResolutionRules({ marketAddress }: { marketAddress: string }) {
  const { data: aiMarket } = useAIMarket(marketAddress);

  if (!aiMarket?.resolution) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resolution Rules</CardTitle>
        <Badge variant="outline">AI-Generated v{aiMarket.ai_version}</Badge>
      </CardHeader>
      <CardContent>
        <RulesDisplay
          mustMeetAll={aiMarket.resolution.criteria.must_meet_all}
          mustNotCount={aiMarket.resolution.criteria.must_not_count}
          allowedSources={aiMarket.resolution.criteria.allowed_sources}
        />
      </CardContent>
    </Card>
  );
}
```

### Header Navigation Update

Add link to proposal page:

```typescript
// In Header.tsx
<nav>
  <Link href="/markets">Markets</Link>
  <Link href="/propose">Propose</Link>  {/* New */}
  <Link href="/portfolio">Portfolio</Link>
</nav>
```
