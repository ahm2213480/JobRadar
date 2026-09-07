/**
 * Matching domain types. The score is always deterministic — computed entirely
 * by the weighted algorithm. AI never decides the numeric score; it only
 * generates the human-readable explanation.
 */

export type MatchFactorId =
  | 'requiredSkills'
  | 'preferredSkills'
  | 'experience'
  | 'title'
  | 'education'
  | 'locationWorkMode'
  | 'salary';

export interface MatchFactorResult {
  /** Factor identifier. */
  id: MatchFactorId;
  /** Human-readable label. */
  label: string;
  /** Weight used (0–1). */
  weight: number;
  /** Raw score for this factor (0–1). */
  score: number;
  /** Weight × score = contribution to the total (0–weight). */
  weightedScore: number;
  /** Human-readable explanation of how this factor was evaluated. */
  explanation: string;
  /** Debug/details: how many matched vs total (for skills), etc. */
  details?: Record<string, number | string | boolean>;
}

export interface MatchResult {
  /** id of the job that was scored */
  jobId: string;
  /** Final deterministic score 0–100 (rounded). */
  score: number;
  /** Per-factor breakdown. */
  factors: MatchFactorResult[];
  /** Skills the user has that the job requires. */
  matchedRequiredSkills: string[];
  /** Skills the job requires but the user lacks. */
  missingRequiredSkills: string[];
  /** Skills the user has that are preferred. */
  matchedPreferredSkills: string[];
  /** AI-generated "Why you match" explanation (null if AI unavailable). */
  aiExplanation: string | null;
  /** AI-generated recommendation (falls back to score-based if AI unavailable). */
  recommendation: 'HIGHLY_RECOMMENDED' | 'RECOMMENDED' | 'CONSIDER' | 'NOT_RECOMMENDED';
  /** Whether AI was used for the explanation. */
  aiUsed: boolean;
  /** When the match was computed. */
  computedAt: string;
}

export interface UserSkillInput {
  name: string;
  aliases: string[];
}

export interface JobSkillInput {
  name: string;
  isRequired: boolean;
}

export interface MatchJobInput {
  id: string;
  title: string;
  location: string | null;
  workMode: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN';
  experienceLevel: 'INTERNSHIP' | 'ENTRY' | 'JUNIOR' | 'MID_LEVEL' | 'SENIOR' | 'LEAD' | 'UNKNOWN';
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  skills: JobSkillInput[];
}

export interface MatchUserProfile {
  currentTitle: string | null;
  yearsOfExperience: number | null;
  location: string | null;
  desiredTitles: string[];
  preferredLocations: string[];
  preferredTechnologies: string[];
  workMode: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN';
  experienceLevel: 'INTERNSHIP' | 'ENTRY' | 'JUNIOR' | 'MID_LEVEL' | 'SENIOR' | 'LEAD' | 'UNKNOWN';
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  remoteOnly: boolean;
  skills: UserSkillInput[];
}

/**
 * Matching is behind an interface so the algorithm can be unit-tested in
 * isolation and, if ever needed, swapped without touching callers.
 */
export interface IMatchingService {
  /**
   * Computes a deterministic 0–100 match score for one job against the user's
   * profile. Pure function of its inputs — no AI, no randomness.
   */
  calculateScore(job: MatchJobInput, user: MatchUserProfile): MatchResult;
  score(job: MatchJobInput, user: MatchUserProfile): MatchResult;

  /**
   * Scores all jobs, returning them sorted by score descending.
   */
  scoreAll(jobs: MatchJobInput[], user: MatchUserProfile): MatchResult[];

  /**
   * Persists the match for a single job against the authenticated user.
   * Uses AI only for the explanation — the score is always deterministic.
   */
  matchJobForUser(userId: string, jobId: string): Promise<MatchResult>;

  /**
   * Computes matches for all available jobs up to `limit`. AI explanations are
   * NOT generated in batch mode (score + breakdown are deterministic & immediate).
   */
  matchAllJobsForUser(userId: string, limit?: number): Promise<MatchResult[]>;
}

/** Exact weights from the product spec — the single source of truth. */
export const MATCH_WEIGHTS: Record<MatchFactorId, number> = {
  requiredSkills: 0.35,
  preferredSkills: 0.10,
  experience: 0.15,
  title: 0.15,
  education: 0.10,
  locationWorkMode: 0.10,
  salary: 0.05,
};

/** Experience levels in ascending seniority order for distance calculation. */
export const EXPERIENCE_ORDER: Array<MatchJobInput['experienceLevel']> = [
  'INTERNSHIP',
  'ENTRY',
  'JUNIOR',
  'MID_LEVEL',
  'SENIOR',
  'LEAD',
];

/** Maps a numeric score to a recommendation bucket. */
export function scoreToRecommendation(score: number): MatchResult['recommendation'] {
  if (score >= 80) return 'HIGHLY_RECOMMENDED';
  if (score >= 60) return 'RECOMMENDED';
  if (score >= 40) return 'CONSIDER';
  return 'NOT_RECOMMENDED';
}