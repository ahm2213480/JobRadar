import type { InterviewOutcome, InterviewType } from '../../types/application';

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  PHONE_SCREENING: 'Phone screening',
  TECHNICAL: 'Technical',
  HR: 'HR',
  FINAL: 'Final',
  ONSITE: 'On-site',
  OTHER: 'Other',
};

export const INTERVIEW_OUTCOME_LABELS: Record<InterviewOutcome, string> = {
  PENDING: 'Pending',
  PASSED: 'Passed',
  FAILED: 'Failed',
};

export const INTERVIEW_OUTCOME_COLORS: Record<InterviewOutcome, string> = {
  PENDING: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  PASSED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200',
  FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200',
};