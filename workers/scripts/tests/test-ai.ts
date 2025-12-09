/**
 * AI/LLM Tests
 *
 * Tests AI/LLM functionality:
 * - OpenAI API connectivity
 * - Prompt templates
 * - Response parsing
 * - Content safety
 */

import OpenAI from 'openai';
import path from 'path';
import { config } from 'dotenv';

// Load env from workers directory
config({ path: path.resolve(import.meta.dirname, '../../.env') });

interface TestResult {
  passed: boolean;
  error?: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

export async function testAI(): Promise<TestResult> {
  if (!OPENAI_API_KEY) {
    console.log('  ⚠️  OPENAI_API_KEY not set, skipping AI tests');
    return { passed: true };
  }

  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Test 1: API Connection
  console.log('  Testing OpenAI API connection...');
  try {
    const models = await openai.models.list();
    if (models.data.length > 0) {
      console.log(`    ✅ OpenAI API connected (${models.data.length} models available)`);
      passed++;
    } else {
      throw new Error('No models returned');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ❌ OpenAI API connection failed: ${msg}`);
    errors.push(`API Connection: ${msg}`);
    failed++;
    // Continue with other tests even if this fails
  }

  // Test 2: Simple completion
  console.log('\n  Testing simple completion...');
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: 'Reply with just the word "hello"' }],
      max_tokens: 10,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content?.toLowerCase();
    if (content?.includes('hello')) {
      console.log('    ✅ Simple completion works');
      passed++;
    } else {
      throw new Error(`Unexpected response: ${content}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ❌ Simple completion failed: ${msg}`);
    errors.push(`Simple completion: ${msg}`);
    failed++;
  }

  // Test 3: JSON response format
  console.log('\n  Testing JSON response format...');
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You must respond with valid JSON only. No other text.',
        },
        {
          role: 'user',
          content: 'Return a JSON object with a field "status" set to "ok"',
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 50,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (parsed.status === 'ok') {
        console.log('    ✅ JSON response format works');
        passed++;
      } else {
        throw new Error(`Unexpected status: ${parsed.status}`);
      }
    } else {
      throw new Error('Empty response');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ❌ JSON response format failed: ${msg}`);
    errors.push(`JSON format: ${msg}`);
    failed++;
  }

  // Test 4: Market generation prompt simulation
  console.log('\n  Testing market generation capability...');
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an AI that generates prediction market questions. Respond with JSON only.`,
        },
        {
          role: 'user',
          content: `Generate a prediction market question about AI progress. Return JSON with fields: title (string), category (string), expiry_date (ISO string).`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (parsed.title && parsed.category) {
        console.log('    ✅ Market generation works');
        console.log(`       Sample: "${parsed.title.substring(0, 50)}..."`);
        passed++;
      } else {
        throw new Error('Missing required fields');
      }
    } else {
      throw new Error('Empty response');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ❌ Market generation failed: ${msg}`);
    errors.push(`Market generation: ${msg}`);
    failed++;
  }

  // Test 5: Content safety check simulation
  console.log('\n  Testing content safety check...');
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a content safety checker. Analyze if the given text is appropriate for a prediction market.
Respond with JSON: { "safe": boolean, "reason": string }`,
        },
        {
          role: 'user',
          content: `Check this proposal: "Will renewable energy exceed 50% of global electricity production by 2030?"`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 100,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (typeof parsed.safe === 'boolean') {
        console.log(`    ✅ Content safety check works (safe: ${parsed.safe})`);
        passed++;
      } else {
        throw new Error('Missing safe field');
      }
    } else {
      throw new Error('Empty response');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ❌ Content safety check failed: ${msg}`);
    errors.push(`Content safety: ${msg}`);
    failed++;
  }

  // Test 6: Validation prompt simulation
  console.log('\n  Testing validation capability...');
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You validate prediction market questions for clarity and measurability.
Respond with JSON: { "valid": boolean, "issues": string[], "suggestions": string[] }`,
        },
        {
          role: 'user',
          content: `Validate: "Will Bitcoin price exceed $100,000 by December 31, 2025?"`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (typeof parsed.valid === 'boolean' && Array.isArray(parsed.issues)) {
        console.log(`    ✅ Validation works (valid: ${parsed.valid})`);
        passed++;
      } else {
        throw new Error('Missing required fields');
      }
    } else {
      throw new Error('Empty response');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ❌ Validation failed: ${msg}`);
    errors.push(`Validation: ${msg}`);
    failed++;
  }

  // Test 7: Duplicate detection simulation
  console.log('\n  Testing duplicate detection capability...');
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You detect if a new prediction market question is similar to existing ones.
Respond with JSON: { "is_duplicate": boolean, "similarity_score": number (0-100), "matched_id": string | null }`,
        },
        {
          role: 'user',
          content: `New question: "Will SpaceX land humans on Mars by 2030?"
Existing questions:
1. "Will humans land on Mars before 2030?"
2. "Will Apple release new iPhone in 2025?"`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 100,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (typeof parsed.is_duplicate === 'boolean' && typeof parsed.similarity_score === 'number') {
        console.log(`    ✅ Duplicate detection works (duplicate: ${parsed.is_duplicate}, score: ${parsed.similarity_score})`);
        passed++;
      } else {
        throw new Error('Missing required fields');
      }
    } else {
      throw new Error('Empty response');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    ❌ Duplicate detection failed: ${msg}`);
    errors.push(`Duplicate detection: ${msg}`);
    failed++;
  }

  // Test 8: Model availability
  console.log('\n  Testing model availability...');
  const modelsToCheck = [AI_MODEL, 'gpt-4o-mini'];
  for (const model of modelsToCheck) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });
      if (response.choices[0]?.message) {
        console.log(`    ✅ Model '${model}' is available`);
        passed++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ⚠️  Model '${model}' not available: ${msg}`);
      // Don't count as failure, just warning
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed`);

  return {
    passed: failed === 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}
