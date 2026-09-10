import type { ApplicationStatus } from '../../types/application';
import { APPLICATION_STATUSES } from '../../types/application';

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  HR_SCREENING: 'HR Screening',
  TECHNICAL_INTERVIEW: 'Technical Interview',
  FINAL_INTERVIEW: 'Final Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
};

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  SAVED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  APPLIED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200',
  HR_SCREENING: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
  TECHNICAL_INTERVIEW: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-200',
  FINAL_INTERVIEW: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200',
  OFFER: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200',
};

export const STATUS_OPTIONS = APPLICATION_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));