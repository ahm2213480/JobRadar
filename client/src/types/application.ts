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

export type UpdateApplicationInput = Partial<
  Omit<CreateApplicationInput, 'jobId' | 'companyName'>
>;

export interface UpdateApplicationStatusInput {
  status: ApplicationStatus;
}