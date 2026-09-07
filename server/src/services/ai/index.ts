import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { IAIService } from './IAIService';
import { GeminiService } from './gemini.adapter';
import { MockAIService } from './mock.adapter';

/**
 * AI provider factory. Selecting a provider is configuration-only:
 *   AI_PROVIDER=gemini + AI_API_KEY=<key>  → real Gemini calls
 *   AI_PROVIDER=mock  (or missing key)     → built-in heuristic extractor
 */
function createAIService(): IAIService {
  if (env.AI_PROVIDER === 'mock') {
    return new MockAIService();
  }
  if (env.AI_PROVIDER === 'gemini' && env.AI_API_KEY) {
    logger.info('AI service initialized', { provider: `gemini:${env.AI_MODEL}` });
    return new GeminiService();
  }
  logger.warn(
    'No AI_API_KEY configured — falling back to the built-in heuristic CV extractor. ' +
      'Add AI_API_KEY to server/.env to enable real AI analysis.',
  );
  return new MockAIService();
}

export const aiService = createAIService();
export type { IAIService } from './IAIService';
export type { CvAnalysis, ExtractedSkill } from './cv-analysis.schema';