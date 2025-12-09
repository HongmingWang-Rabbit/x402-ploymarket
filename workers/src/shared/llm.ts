import OpenAI from 'openai';
import { env } from './env.js';
import { logger } from './logger.js';

let client: OpenAI | null = null;

/**
 * Get OpenAI client
 */
export function getOpenAI(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  if (!client) {
    client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    logger.info('OpenAI client created');
  }

  return client;
}

/**
 * LLM request options
 */
export interface LLMRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

/**
 * LLM response
 */
export interface LLMResponse<T = unknown> {
  content: T;
  requestId: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Make LLM request with JSON response
 */
export async function llmRequest<T>(options: LLMRequestOptions): Promise<LLMResponse<T>> {
  const openai = getOpenAI();
  const requestId = `llm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  logger.info({ requestId, model: env.OPENAI_MODEL }, 'Making LLM request');

  const response = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.userPrompt },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 2000,
    response_format:
      options.responseFormat === 'json' ? { type: 'json_object' } : undefined,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content in LLM response');
  }

  let parsed: T;
  if (options.responseFormat === 'json') {
    try {
      parsed = JSON.parse(content) as T;
    } catch (e) {
      logger.error({ requestId, content }, 'Failed to parse JSON response');
      throw new Error('Invalid JSON response from LLM');
    }
  } else {
    parsed = content as T;
  }

  logger.info(
    {
      requestId,
      usage: response.usage,
    },
    'LLM request completed'
  );

  return {
    content: parsed,
    requestId,
    model: response.model,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
  };
}

/**
 * Make LLM request with text response
 */
export async function llmTextRequest(options: Omit<LLMRequestOptions, 'responseFormat'>): Promise<LLMResponse<string>> {
  return llmRequest<string>({ ...options, responseFormat: 'text' });
}

/**
 * Make LLM request with JSON response
 */
export async function llmJsonRequest<T>(options: Omit<LLMRequestOptions, 'responseFormat'>): Promise<LLMResponse<T>> {
  return llmRequest<T>({ ...options, responseFormat: 'json' });
}
