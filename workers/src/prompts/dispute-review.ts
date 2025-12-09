/**
 * Dispute Review Prompt Template
 *
 * Used by the Dispute Agent Worker to evaluate disputes.
 */

export const DISPUTE_REVIEW_SYSTEM_PROMPT = `You are an AI that reviews disputes for prediction market resolutions.

Your job is to:
1. Evaluate if the disputant's claim has merit
2. Consider if the original resolution followed the rules correctly
3. Check if new evidence changes the outcome
4. Determine if this is a clear case or needs human review

## Decision Criteria

- **upheld**: Original resolution was correct according to the rules
- **overturned**: Original resolution was incorrect; evidence clearly shows the opposite
- **escalate**: Case is ambiguous, timing-related, or has conflicting evidence

Be conservative - only overturn if there is clear evidence the original resolution was wrong.
Return ONLY valid JSON, no additional text.`;

export function buildDisputeReviewPrompt(input: {
  marketTitle: string;
  exactQuestion: string;
  mustMeetAll: string[];
  mustNotCount: string[];
  originalResult: 'YES' | 'NO';
  originalEvidenceHash: string;
  originalSource: string;
  originalMustMeetAllResults: { condition: string; met: boolean; evidence: string }[];
  originalMustNotCountResults: { condition: string; triggered: boolean; evidence: string | null }[];
  disputeReason: string;
  disputeEvidenceUrls: string[];
  userAddress: string;
  newEvidenceContent: string;
}): string {
  return `## Original Market
Title: ${input.marketTitle}
Exact Question: ${input.exactQuestion}

### Resolution Rules
Must Meet All (ALL must be TRUE for YES):
${input.mustMeetAll.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Must Not Count (if ANY triggered, resolves to NO):
${input.mustNotCount.length > 0 ? input.mustNotCount.map((c, i) => `${i + 1}. ${c}`).join('\n') : 'None'}

## Original Resolution
Result: ${input.originalResult}
Evidence Hash: ${input.originalEvidenceHash}
Fetched From: ${input.originalSource}

### Must Meet All Results (Original)
${input.originalMustMeetAllResults.map((r) => `- "${r.condition}": ${r.met ? 'MET' : 'NOT MET'} - Evidence: "${r.evidence}"`).join('\n')}

### Must Not Count Results (Original)
${input.originalMustNotCountResults.map((r) => `- "${r.condition}": ${r.triggered ? 'TRIGGERED' : 'NOT TRIGGERED'} - Evidence: "${r.evidence || 'N/A'}"`).join('\n')}

## Dispute
Submitted by: ${input.userAddress}
Reason: ${input.disputeReason}
Evidence URLs Provided: ${input.disputeEvidenceUrls.join(', ')}

### New Evidence Content
${input.newEvidenceContent.slice(0, 8000)}${input.newEvidenceContent.length > 8000 ? '\n... (truncated)' : ''}

## Your Task

1. Was the original resolution correct based on the rules?
2. Does the disputant's claim have merit?
3. Does the new evidence support overturning the original resolution?
4. Is there any ambiguity that requires human review?

## Output Format
Return a JSON object with this exact structure:
{
  "decision": "upheld" | "overturned" | "escalate",
  "reasoning": "Detailed explanation of the decision",
  "original_resolution_correct": true | false,
  "new_evidence_relevant": true | false,
  "new_evidence_analysis": "Analysis of any new evidence provided",
  "new_result": "YES" | "NO" | null,
  "confidence": 0.0 - 1.0,
  "escalation_reason": "Only if escalating, why human review is needed"
}`;
}

/**
 * Dispute review response structure
 */
export interface DisputeReviewResponse {
  decision: 'upheld' | 'overturned' | 'escalate';
  reasoning: string;
  original_resolution_correct: boolean;
  new_evidence_relevant: boolean;
  new_evidence_analysis: string;
  new_result: 'YES' | 'NO' | null;
  confidence: number;
  escalation_reason?: string;
}
