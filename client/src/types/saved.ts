import type { JobListItem } from './job';

/** A saved job entry — the job card shape plus when it was saved. */
export interface SavedJobListItem extends JobListItem {
  savedAt: string;
}

export interface SavedJobsListResponse {
  savedJobs: SavedJobListItem[];
  total: number;
}

export interface SavedStatusResponse {
  saved: boolean;
}
