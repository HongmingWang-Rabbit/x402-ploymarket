/**
 * Duplicate Detection Prompt Template
 *
 * Detects if a proposed market is a duplicate of existing markets
 */

export const duplicateDetectionPrompt = `You are an AI assistant that detects duplicate or highly similar prediction markets.

Compare the proposed market with the list of existing markets and determine if there's a duplicate or near-duplicate.

PROPOSED MARKET:
Title: {{proposed_title}}
Description: {{proposed_description}}
Category: {{proposed_category}}
Resolution Question: {{proposed_question}}

EXISTING MARKETS:
{{existing_markets}}

Respond in JSON format:
{
  "is_duplicate": true/false,
  "duplicate_market_id": "uuid or null",
  "similarity_score": 0.0-1.0,
  "reasoning": "explanation of why this is or isn't a duplicate",
  "key_differences": ["difference1", "difference2", ...] or null
}

Guidelines:
- Markets asking essentially the same question with same timeframe are duplicates
- Minor wording differences don't make markets unique
- Different timeframes for same event are NOT duplicates
- Different aspects of same topic (e.g., "Will X launch?" vs "Will X succeed?") are NOT duplicates
- similarity_score > 0.8 should be considered duplicates
- If no existing markets provided, is_duplicate should be false`;

export interface DuplicateDetectionInput {
  proposed_title: string;
  proposed_description: string;
  proposed_category: string;
  proposed_question: string;
  existing_markets: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    resolution_question: string;
  }>;
}

export interface DuplicateDetectionOutput {
  is_duplicate: boolean;
  duplicate_market_id: string | null;
  similarity_score: number;
  reasoning: string;
  key_differences: string[] | null;
}

export function buildDuplicateDetectionPrompt(input: DuplicateDetectionInput): string {
  const existingMarketsText = input.existing_markets.length > 0
    ? input.existing_markets.map((m, i) => `
${i + 1}. ID: ${m.id}
   Title: ${m.title}
   Description: ${m.description}
   Category: ${m.category}
   Resolution Question: ${m.resolution_question}
`).join('\n')
    : 'No existing markets to compare.';

  return duplicateDetectionPrompt
    .replace('{{proposed_title}}', input.proposed_title)
    .replace('{{proposed_description}}', input.proposed_description)
    .replace('{{proposed_category}}', input.proposed_category)
    .replace('{{proposed_question}}', input.proposed_question)
    .replace('{{existing_markets}}', existingMarketsText);
}
