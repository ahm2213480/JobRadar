export type MatchFactorId =
  | 'requiredSkills'
  | 'preferredSkills'
  | 'experience'
  | 'title'
  | 'education'
  | 'locationWorkMode'
  | 'salary';

export interface MatchFactorResult {
  id: MatchFactorId;
  label: string;
  weight: number;
  score: number;
  weightedScore: number;
  explanation: string;
  details?: Record<string, number | string | boolean>;
}

export interface MatchResult {
  /** Id of the job that was scored */
  jobId: string;
  /** Job title for display purposes */
  title: string;
  /** Company name for display purposes */
  company: string | null;
  /** Work mode for display purposes */
  workMode: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN';
  /** Location for display purposes */
  location: string | null;
  score: number;
  factors: MatchFactorResult[];
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  matchedPreferredSkills: string[];
  aiExplanation: string | null;
  recommendation: 'HIGHLY_RECOMMENDED' | 'RECOMMENDED' | 'CONSIDER' | 'NOT_RECOMMENDED';
  aiUsed: boolean;
  computedAt: string;
}