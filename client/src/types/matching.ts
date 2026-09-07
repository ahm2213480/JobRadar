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