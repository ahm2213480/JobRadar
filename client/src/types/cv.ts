export type SkillCategory =
  | 'PROGRAMMING_LANGUAGE'
  | 'FRAMEWORK'
  | 'TOOL'
  | 'SOFT_SKILL'
  | 'OTHER';

export interface CvProfileExtract {
  headline: string | null;
  currentTitle: string | null;
  summary: string | null;
  location: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  yearsOfExperience: number | null;
}

export interface ExtractedSkill {
  name: string;
  category: SkillCategory;
  proficiency: number | null;
  years: number | null;
}

export interface CvAnalysis {
  profile: CvProfileExtract;
  skills: ExtractedSkill[];
}

export interface CvRecord {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isPrimary: boolean;
  uploadedAt: string;
  analyzedAt: string | null;
  skillCount: number;
}

export interface CvAnalysisResult {
  cv: CvRecord;
  analysis: CvAnalysis;
  skills: Array<{ id: string; name: string }>;
  provider: string;
}

export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  PROGRAMMING_LANGUAGE: 'Programming languages',
  FRAMEWORK: 'Frameworks & libraries',
  TOOL: 'Tools & platforms',
  SOFT_SKILL: 'Soft skills',
  OTHER: 'Other',
};