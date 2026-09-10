import type { JobListItem } from './job';

export type ApplicationStatus =
  | 'SAVED'
  | 'APPLIED'
  | 'HR_SCREENING'
  | 'TECHNICAL_INTERVIEW'
  | 'FINAL_INTERVIEW'
  | 'OFFER'
  | 'REJECTED';

/** Mirrors the Prisma ApplicationStatus enum exactly — never add custom values. */
export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'SAVED',
  'APPLIED',
  'HR_SCREENING',
  'TECHNICAL_INTERVIEW',
  'FINAL_INTERVIEW',
  'OFFER',
  'REJECTED',
];

export interface ApplicationListItem {
  id: string;
  jobId: string | null;
  companyId: string | null;
  title: string;
  url: string | null;
  status: ApplicationStatus;
  appliedAt: string | null;
  interviewDate: string | null;
  salaryText: string | null;
  contactName: string | null;
  contactEmail: string | null;
  cvId: string | null;
  matchScoreSnapshot: number | null;
  createdAt: string;
  updatedAt: string;
  job: JobListItem | null;
  company: { id: string; name: string } | null;
}

export interface ApplicationsListResponse {
  applications: ApplicationListItem[];
  total: number;
}

export interface CreateApplicationInput {
  /** Either link to an existing JobRadar job… */
  jobId?: string;
  /** …or provide a manual title (required when jobId is absent). */
  title?: string;
  /** Manual applications only — resolved to a Company by name on the server. */
  companyName?: string;
  url?: string;
  status?: ApplicationStatus;
  appliedAt?: string;
  salaryText?: string;
  contactName?: string;
  contactEmail?: string;
  cvId?: string;
}

// Clearable fields are declared only on the right so `null` isn't lost by the
// intersection narrowing: (string | undefined) & (string | null) == string.
export type UpdateApplicationInput = Partial<
  Omit<
    CreateApplicationInput,
    | 'jobId'
    | 'companyName'
    | 'url'
    | 'appliedAt'
    | 'salaryText'
    | 'contactName'
    | 'contactEmail'
    | 'cvId'
  >
> & {
  /** Explicit null clears the value (e.g. empty URL). */
  url?: string | null;
  appliedAt?: string | null;
  salaryText?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  cvId?: string | null;
};

export interface UpdateApplicationStatusInput {
  status: ApplicationStatus;
}

// ------------------------------ Phase 9 ------------------------------

export interface SkillGapItem {
  skillId: string;
  name: string;
  category: string;
  demandCount: number;
  demandPct: number;
  owned: boolean;
}

export interface SkillsGapResponse {
  totalJobs: number;
  gaps: SkillGapItem[];
  strengths: SkillGapItem[];
}

export interface LearningGoal {
  id: string;
  skillId: string;
  skillName: string;
  status: 'ACTIVE' | 'COMPLETED';
  dueDate: string | null;
  createdAt: string;
}

export interface CreateLearningGoalInput {
  skillId: string;
  dueDate?: string;
}

export interface UpdateLearningGoalInput {
  status?: 'ACTIVE' | 'COMPLETED';
  dueDate?: string | null;
}

export interface CvOptimizerResult {
  jobId: string;
  jobTitle: string;
  cvId: string;
  cvFileName: string;
  cvMatchPct: number;
  matchedRequired: string[];
  matchedPreferred: string[];
  missingRequired: string[];
  missingPreferred: string[];
  suggestions: string[] | null;
  aiUsed: boolean;
}

export interface OptimizeCvInput {
  jobId: string;
}

// ------------------------------ Notes ------------------------------

export interface ApplicationNote {
  id: string;
  applicationId: string;
  body: string;
  createdAt: string;
}

export interface CreateApplicationNoteInput {
  body: string;
}

// ---------------------------- Interviews ----------------------------

/** Mirrors the Prisma InterviewType enum exactly — never add custom values. */
export type InterviewType =
  | 'PHONE_SCREENING'
  | 'TECHNICAL'
  | 'HR'
  | 'FINAL'
  | 'ONSITE'
  | 'OTHER';

/** Mirrors the Prisma InterviewOutcome enum exactly. */
export type InterviewOutcome = 'PENDING' | 'PASSED' | 'FAILED';

export const INTERVIEW_TYPES: InterviewType[] = [
  'PHONE_SCREENING',
  'TECHNICAL',
  'HR',
  'FINAL',
  'ONSITE',
  'OTHER',
];

export const INTERVIEW_OUTCOMES: InterviewOutcome[] = ['PENDING', 'PASSED', 'FAILED'];

export interface Interview {
  id: string;
  applicationId: string;
  scheduledAt: string;
  type: InterviewType;
  locationOrLink: string | null;
  notes: string | null;
  outcome: InterviewOutcome;
  createdAt: string;
}

export interface CreateInterviewInput {
  scheduledAt: string;
  type?: InterviewType;
  locationOrLink?: string;
  notes?: string;
  outcome?: InterviewOutcome;
}

export type UpdateInterviewInput = Partial<
  Pick<CreateInterviewInput, 'type' | 'outcome'>
> & {
  scheduledAt?: string;
  locationOrLink?: string | null;
  notes?: string | null;
};