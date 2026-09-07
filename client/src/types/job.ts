export type WorkMode = 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN';
export type EmploymentType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'CONTRACT'
  | 'INTERNSHIP'
  | 'TEMPORARY'
  | 'OTHER'
  | 'UNKNOWN';

export interface JobSkill {
  id: string;
  name: string;
  isRequired: boolean;
}

export interface JobListItem {
  id: string;
  title: string;
  description: string;
  location: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  url: string;
  postedAt: string | null;
  company: { id: string; name: string } | null;
  source: { slug: string; name: string };
  skills: JobSkill[];
}

export interface JobsListResponse {
  jobs: JobListItem[];
  total: number;
}

export interface JobSourceInfo {
  slug: string;
  name: string;
  isActive: boolean;
  lastSyncedAt: string | null;
}

export interface IngestResult {
  source: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  durationMs: number;
}

export interface SyncSummary {
  ranAt: string;
  results: IngestResult[];
}

export interface JobStats {
  totalJobs: number;
  totalCompanies: number;
  sources: Array<{
    slug: string;
    name: string;
    jobCount: number;
    lastSyncedAt: string | null;
  }>;
}

export interface ManualJobInput {
  title: string;
  companyName?: string;
  description: string;
  location?: string;
  url?: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
}