import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load server/.env regardless of the process working directory
// (works both when running from the repo root and from server/).
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Optional until the developer configures Neon — /api/health reports the
  // real database status instead of the app silently pretending to work.
  DATABASE_URL: z.string().trim().min(1).optional(),
  // Required from Phase 1 (authentication). Generate with:
  //   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  JWT_ACCESS_SECRET: z
    .string()
    .trim()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .trim()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().trim().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().trim().default('7d'),
  // --- AI (Phase 3: CV analysis) ---
  // Optional: without a key the built-in heuristic extractor is used so the
  // flow is testable end-to-end; set AI_API_KEY to enable the real provider.
  AI_PROVIDER: z.enum(['gemini', 'mock']).default('gemini'),
  AI_API_KEY: z.string().trim().optional(),
  AI_MODEL: z.string().trim().default('gemini-3.6-flash'),
  // --- Job providers (Phase: broad discovery) ---
  // Optional: without keys the providers return [] so existing sources sync.
  // JSearch (RapidAPI): aggregates LinkedIn + boards. Free tier available.
  // Get a key at https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
  JSEARCH_API_KEY: z.string().trim().optional(),
  // Adzuna: official job-search API (gb/us/de + more, no Jordan endpoint).
  // Register at https://developer.adzuna.com/ for app_id + app_key.
  ADZUNA_APP_ID: z.string().trim().optional(),
  ADZUNA_APP_KEY: z.string().trim().optional(),
  // WebSearch (Serper.dev Google SERP): "look it up on the web" discovery —
  // returns real job-listing URLs (LinkedIn, careers pages, boards) for
  // free-tier queries. 2500 free queries/month, no card. https://serper.dev
  SERPER_API_KEY: z.string().trim().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
