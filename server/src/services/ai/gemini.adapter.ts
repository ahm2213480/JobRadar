import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import { cvAnalysisSchema, type CvAnalysis } from './cv-analysis.schema';
import type { IAIService } from './IAIService';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

/** The system prompt that turns a raw CV dump into the exact JSON we need. */
function buildCvAnalysisPrompt(rawText: string): string {
  const categoryList = Object.values(
    ['PROGRAMMING_LANGUAGE', 'FRAMEWORK', 'TOOL', 'SOFT_SKILL', 'OTHER'] as const,
  ).join(', ');

  return [
    'You are a senior CV parser for an AI job-matching platform.',
    'Extract information from the resume text below.',
    '',
    'Return ONLY valid JSON (no markdown, no commentary) matching EXACTLY this shape:',
    '{',
    '  "profile": {',
    '    "headline": string|null,       // one professional line, max 120 chars',
    '    "currentTitle": string|null,   // most recent job title, max 120 chars',
    '    "summary": string|null,        // rewritten 2-3 sentence professional summary, max 2000 chars',
    '    "location": string|null,       // "City, Country" if present',
    '    "phone": string|null,          // phone number if present',
    '    "linkedinUrl": string|null,    // full LinkedIn URL if present',
    '    "githubUrl": string|null,      // full GitHub URL if present',
    '    "portfolioUrl": string|null,   // any other personal/portfolio URL if present',
    '    "yearsOfExperience": number|null // total years of professional experience if stated',
    '  },',
    '  "skills": [',
    '    { "name": string, "category": "' + categoryList + '", "proficiency": number|null (1-5), "years": number|null }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- Skill names MUST be canonical and spelled out: "JavaScript" not "js", "C#" not "C sharp", "Node.js" not "node".',
    '- Include hard skills (languages, frameworks, tools, databases, platforms) AND the most prominent soft skills only.',
    '- A skill not explicitly mentioned must NOT be guessed. If the profile has no data for a field, use null.',
    '- proficiency: purpose of use — 5 = expert/primary, 3 = proficient, 1 = familiar.',
    '- years: only if the resume states how long the skill was used (otherwise null).',
    '',
    'RESUME TEXT:',
    '====================',
    rawText.slice(0, 30_000),
    '====================',
  ].join('\n');
}

export class GeminiService implements IAIService {
  readonly name = `gemini:${env.AI_MODEL}`;

  async analyzeCV(rawText: string): Promise<CvAnalysis> {
    const apiKey = env.AI_API_KEY;
    if (!apiKey) {
      throw new AppError(503, 'Gemini API key is not configured (AI_API_KEY)');
    }

    let response: Response;
    try {
      response = await fetch(
        `${GEMINI_API_URL}/models/${env.AI_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: buildCvAnalysisPrompt(rawText) }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
        },
      );
    } catch (error) {
      logger.error('Gemini request failed', error);
      throw new AppError(502, 'AI provider is unreachable');
    }

    if (!response.ok) {
      let message = `Gemini API error (${response.status})`;
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        if (body.error?.message) {
          // 401/403 mean a bad key — surface it clearly.
          message = response.status === 401 || response.status === 403
            ? 'Gemini rejected the API key. Double-check AI_API_KEY in server/.env'
            : body.error.message;
        }
      } catch {
        // Non-JSON error body — keep the generic message.
      }
      throw new AppError(502, message);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!text) {
      throw new AppError(502, 'AI provider returned an empty response');
    }

    // Gemini with responseMimeType=application/json may wrap the JSON in
    // ```json fences on rare occasions — strip them defensively.
    const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    let parsedUnknown: unknown;
    try {
      parsedUnknown = JSON.parse(cleaned);
    } catch (parseErr) {
      logger.error('Gemini returned non-JSON output', {
        snippet: cleaned.slice(0, 500),
        parseError: parseErr instanceof Error ? parseErr.message : 'unknown',
      });
      throw new AppError(502, 'AI provider returned malformed JSON');
    }

    const parsed = cvAnalysisSchema.safeParse(parsedUnknown);
    if (!parsed.success) {
      logger.error('Gemini output failed schema validation', parsed.error.issues);
      throw new AppError(502, 'AI provider returned an invalid CV analysis');
    }
    return parsed.data;
  }
  async explainMatch(prompt: string): Promise<string> {
    const apiKey = env.AI_API_KEY;
    if (!apiKey) {
      throw new AppError(503, 'Gemini API key is not configured (AI_API_KEY)');
    }

    let response: Response;
    try {
      response = await fetch(
        `${GEMINI_API_URL}/models/${env.AI_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 200,
            },
          }),
        },
      );
    } catch (error) {
      logger.error('Gemini explainMatch request failed', error);
      throw new AppError(502, 'AI provider is unreachable');
    }

    if (!response.ok) {
      throw new AppError(502, `Gemini API error (${response.status})`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!text) {
      throw new AppError(502, 'AI provider returned an empty response');
    }
        return text;
  }
}