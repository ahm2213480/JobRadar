import type { SkillCategory } from '@prisma/client';

/**
 * Normalized, provider-agnostic job shape returned by every IJobProvider.
 * Adapters are responsible for mapping their API's quirks onto this shape —
 * ingestion/matching logic never sees provider-specific payloads.
 */
export interface NormalizedJob {
  /** Provider's own id for that job (null when the source has none). */
  externalId: string | null;
  title: string;
  companyName: string | null;
  description: string;
  location: string | null;
  /** Public URL to apply for the job. */
  url: string;
  workMode: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'TEMPORARY' | 'OTHER' | 'UNKNOWN';
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: Date | null;
  /** Free-form tags/technologies mentioned by the source, if any. */
  tags: string[];
  /** Raw text used for skill extraction when the description is thin. */
  extraText: string | null;
}

/** Employment-type labels we can recognize in provider descriptions. */
export const EMPLOYMENT_TYPE_KEYWORDS: Array<{
  type: NormalizedJob['employmentType'];
  keywords: string[];
}> = [
  { type: 'FULL_TIME', keywords: ['full-time', 'full time'] },
  { type: 'PART_TIME', keywords: ['part-time', 'part time', 'parttime'] },
  { type: 'CONTRACT', keywords: ['contract'] },
  { type: 'INTERNSHIP', keywords: ['internship', 'intern'] },
  { type: 'TEMPORARY', keywords: ['temporary', 'temp'] },
];

/** Maps plain-language skill words to their canonical SkillCategory. */
export const COMMON_SKILL_WORDS: Array<{
  pattern: RegExp;
  category: SkillCategory;
}> = [
  { pattern: /\b(js|javascript|typescript|ts|python|java|c\+\+|c#|php|ruby|golang|go|rust|sql|html|css|graphql|bash|shell|kotlin|swift|scala|r\b|matlab|perl|elixir)\b/i, category: 'PROGRAMMING_LANGUAGE' },
  { pattern: /\b(react|nextjs|next\.js|angular|vue|svelte|nodejs|node\.js|express|nestjs|django|flask|spring|laravel|rails|\.net|dotnet|tailwind|redux|flutter|astro|redux|graphql)\b/i, category: 'FRAMEWORK' },
  { pattern: /\b(docker|kubernetes|k8s|aws|azure|gcp|terraform|jenkins|gitlab|github|postgres|postgresql|mysql|mongodb|redis|elasticsearch|kafka|rabbitmq|snowflake|databricks|airflow|spark|hadoop|tableau|power bi|jira|confluence|figma|linux|windows|nginx|vscode|git|jenkins)\b/i, category: 'TOOL' },
  { pattern: /\b(communication|leadership|teamwork|team player|problem[- ]solving|time management|agile|scrum|mentoring|collaboration|adaptability|critical thinking|creativity|negotiation)\b/i, category: 'SOFT_SKILL' },
];

/** Suggests a SkillCategory for a free-form tag that is not a known skill. */
export function guessSkillCategory(tag: string): SkillCategory {
  for (const entry of COMMON_SKILL_WORDS) {
    if (entry.pattern.test(tag)) {
      return entry.category;
    }
  }
  return 'OTHER';
}

export interface IJobProvider {
  /** Slug of the JobSource row this provider feeds (e.g. "remotive"). */
  readonly sourceSlug: string;
  /** Human-readable label for logs/UI. */
  readonly label: string;
  /** Fetches the latest openings from the provider's public API. */
  fetchJobs(): Promise<NormalizedJob[]>;
}