/**
 * Content Safety Middleware
 *
 * Pre-filters requests for prompt injection and harmful content
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Dangerous patterns that may indicate prompt injection
 */
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(everything|all|previous)/i,
  /you\s+are\s+now\s+a?/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /act\s+as\s+if/i,
  /new\s+instructions?:/i,
  /system\s*prompt/i,
  /\[\[system\]\]/i,
  /<<system>>/i,
  /override\s*:/i,
  /admin\s+mode/i,
  /developer\s+mode/i,
  /jailbreak/i,
  /DAN\s*:/i,
  /do\s+anything\s+now/i,
];

/**
 * Forbidden topics that should be rejected
 */
const FORBIDDEN_PATTERNS = [
  /\b(assassination|assassinate)\b/i,
  /\b(murder|homicide)\s+(of|someone|person)/i,
  /\bkill\s+(someone|a\s+person|him|her|them)\b/i,
  /\bdeath\s+of\s+[a-z]+\s+(before|by|in)/i,
  /\bsuicide\b/i,
  /\bself[- ]?harm\b/i,
  /\billegal\s+drugs?\b/i,
  /\bchild\s+(abuse|porn|exploitation)/i,
  /\bhuman\s+trafficking\b/i,
  /\bterrorist?\s+(attack|act)/i,
];

export interface ContentSafetyResult {
  safe: boolean;
  reason?: string;
  pattern?: string;
}

/**
 * Check text content for safety issues
 */
export function checkContentSafety(text: string): ContentSafetyResult {
  // Check for prompt injection
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: 'Detected potential prompt injection attempt',
        pattern: pattern.source,
      };
    }
  }

  // Check for forbidden content
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: 'Content contains forbidden topics',
        pattern: pattern.source,
      };
    }
  }

  return { safe: true };
}

/**
 * Content safety middleware factory
 */
export function createContentSafetyMiddleware(fieldsToCheck: string[]) {
  return async function contentSafetyMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const body = request.body as Record<string, unknown>;

    if (!body) return;

    for (const field of fieldsToCheck) {
      const value = body[field];
      if (typeof value === 'string') {
        const result = checkContentSafety(value);

        if (!result.safe) {
          reply.status(400).send({
            success: false,
            error: {
              code: 'unsafe_content',
              message: result.reason || 'Content failed safety check',
              details: {
                field,
              },
            },
          });
          return;
        }
      }
    }
  };
}

/**
 * Middleware for proposal submissions
 */
export const proposalSafetyMiddleware = createContentSafetyMiddleware(['proposal_text']);

/**
 * Middleware for dispute submissions
 */
export const disputeSafetyMiddleware = createContentSafetyMiddleware(['reason']);
