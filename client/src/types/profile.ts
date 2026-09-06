export type WorkMode = 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN';

export type ExperienceLevel =
  | 'INTERNSHIP'
  | 'ENTRY'
  | 'JUNIOR'
  | 'MID_LEVEL'
  | 'SENIOR'
  | 'LEAD'
  | 'UNKNOWN';

export interface UserProfileData {
  headline: string | null;
  summary: string | null;
  location: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  yearsOfExperience: number | null;
  currentTitle: string | null;
}

export interface PreferencesData {
  desiredTitles: string[];
  preferredLocations: string[];
  preferredTechnologies: string[];
  workMode: WorkMode;
  experienceLevel: ExperienceLevel;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  remoteOnly: boolean;
  emailNotifications: boolean;
}

export interface CompletionResult {
  percent: number;
  missing: string[];
}

export interface ProfileBundle {
  profile: UserProfileData | null;
  preferences: PreferencesData | null;
  completion: CompletionResult;
}

export const DEFAULT_PREFERENCES: PreferencesData = {
  desiredTitles: [],
  preferredLocations: [],
  preferredTechnologies: [],
  workMode: 'UNKNOWN',
  experienceLevel: 'UNKNOWN',
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  remoteOnly: false,
  emailNotifications: true,
};
