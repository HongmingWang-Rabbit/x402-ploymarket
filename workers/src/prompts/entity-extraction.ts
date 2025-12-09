/**
 * Entity Extraction Prompt Template
 *
 * Extracts market-worthy events and entities from news content
 */

export const entityExtractionPrompt = `You are an AI assistant that extracts market-worthy prediction events from news articles.

Analyze the following news article and extract:
1. Key entities (people, companies, products, events)
2. Event type classification
3. Whether this could make a good prediction market
4. Relevant text snippet

NEWS ARTICLE:
Title: {{title}}
Content: {{content}}
Source: {{source}}
Published: {{published_at}}

Respond in JSON format:
{
  "entities": ["entity1", "entity2", ...],
  "event_type": "product_launch|election|financial|sports|entertainment|technology|other",
  "is_market_worthy": true/false,
  "market_worthiness_reason": "explanation",
  "category_hint": "politics|product_launch|finance|sports|entertainment|technology|misc",
  "relevant_text": "the most relevant snippet for market creation",
  "confidence": 0.0-1.0
}

Guidelines:
- Only mark as market_worthy if the event has a clear, verifiable outcome
- Event must have a definable timeframe
- Avoid subjective or opinion-based outcomes
- Entities should be specific and identifiable
- Extract the most relevant text that could form a prediction question`;

export interface EntityExtractionInput {
  title: string;
  content: string;
  source: string;
  published_at: string;
}

export interface EntityExtractionOutput {
  entities: string[];
  event_type: string;
  is_market_worthy: boolean;
  market_worthiness_reason: string;
  category_hint: string;
  relevant_text: string;
  confidence: number;
}

export function buildEntityExtractionPrompt(input: EntityExtractionInput): string {
  return entityExtractionPrompt
    .replace('{{title}}', input.title)
    .replace('{{content}}', input.content)
    .replace('{{source}}', input.source)
    .replace('{{published_at}}', input.published_at);
}
