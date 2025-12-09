/**
 * Resolution Prompt Template
 *
 * Used by the Resolver Worker to interpret fetched data and determine market outcomes.
 */

export const RESOLUTION_SYSTEM_PROMPT = `You are a deterministic resolver for prediction markets. Your job is to apply the resolution rules to the fetched evidence and determine the outcome.

## Important
- Be STRICTLY literal in interpreting the conditions
- Do not use external knowledge - only the provided evidence
- If evidence is ambiguous or insufficient, err on the side of NO
- Document exactly what in the evidence supports each determination
- Return ONLY valid JSON, no additional text`;

export function buildResolutionPrompt(input: {
  marketTitle: string;
  exactQuestion: string;
  mustMeetAll: string[];
  mustNotCount: string[];
  machineResolutionLogic: {
    if: string;
    then: string;
    else: string;
  };
  allowedSources: { name: string; url: string; condition: string }[];
  sourceUrl: string;
  fetchTime: string;
  content: string;
}): string {
  return `## Market Rules
Title: ${input.marketTitle}
Exact Question: ${input.exactQuestion}

### Must Meet All (ALL must be TRUE for YES)
${input.mustMeetAll.map((c, i) => `${i + 1}. ${c}`).join('\n')}

### Must Not Count (if ANY triggered, resolves to NO)
${input.mustNotCount.length > 0 ? input.mustNotCount.map((c, i) => `${i + 1}. ${c}`).join('\n') : 'None'}

### Machine Resolution Logic
IF: ${input.machineResolutionLogic.if}
THEN: ${input.machineResolutionLogic.then}
ELSE: ${input.machineResolutionLogic.else}

### Allowed Sources
${input.allowedSources.map((s) => `- ${s.name}: ${s.url} (Condition: ${s.condition})`).join('\n')}

## Fetched Evidence
Source: ${input.sourceUrl}
Fetch Time: ${input.fetchTime}

### Content
${input.content.slice(0, 10000)}${input.content.length > 10000 ? '\n... (truncated)' : ''}

## Your Task
For each condition in must_meet_all, determine if it is satisfied by the evidence.
For each condition in must_not_count, determine if it is triggered.
Apply the machine_resolution_logic to determine YES or NO.

## Output Format
Return a JSON object with this exact structure:
{
  "must_meet_all_results": [
    {
      "condition": "Condition text",
      "met": true | false,
      "evidence": "Exact text or element from the content that proves this"
    }
  ],
  "must_not_count_results": [
    {
      "condition": "Condition text",
      "triggered": true | false,
      "evidence": "Evidence if triggered, null if not"
    }
  ],
  "all_conditions_met": true | false,
  "any_exclusions_triggered": true | false,
  "final_result": "YES" | "NO",
  "reasoning": "Step by step reasoning for the final result"
}`;
}

/**
 * Resolution response structure
 */
export interface ResolutionResponse {
  must_meet_all_results: {
    condition: string;
    met: boolean;
    evidence: string;
  }[];
  must_not_count_results: {
    condition: string;
    triggered: boolean;
    evidence: string | null;
  }[];
  all_conditions_met: boolean;
  any_exclusions_triggered: boolean;
  final_result: 'YES' | 'NO';
  reasoning: string;
}
