import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '../api/client';
import { SaveJobButton } from '../components/jobs/SaveJobButton';
import { Button } from '../components/ui/Button';
import type { JobListItem } from '../types/job';

const WORK_MODE_LABELS: Record<string, string> = {
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
  ONSITE: 'On-site',
  UNKNOWN: 'Any',
};

const WORK_MODE_COLORS: Record<string, string> = {
  REMOTE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200',
  HYBRID: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200',
  ONSITE: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  UNKNOWN: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
): string | null {
  if (min == null && max == null) return null;
  const fmt = (v: number) =>
    currency ? currency + ' ' + v.toLocaleString() : v.toLocaleString();
  if (min != null && max != null && min !== max) {
    return fmt(min) + ' - ' + fmt(max);
  }
  return fmt(min ?? max ?? 0);
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialSaved, setInitialSaved] = useState<boolean | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [data, saved] = await Promise.all([
          api.getJob(id),
          api.isJobSaved(id).catch(() => ({ saved: false })),
        ]);
        if (cancelled) return;
        setJob(data);
        setInitialSaved(saved.saved);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load job');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading job details...
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/jobs" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          Back to jobs
        </Link>
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-4">
        <Link to="/jobs" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          Back to jobs
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Job not found.</p>
        </div>
      </div>
    );
  }
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const posted = job.postedAt ? new Date(job.postedAt).toLocaleDateString() : null;
  return (
    <div className="space-y-6">
      <Link to="/jobs" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
        Back to jobs
      </Link>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
            <p className="mt-1 text-lg text-slate-600 dark:text-slate-400">
              {job.company?.name ?? 'Unknown company'}
            </p>
          </div>
          <span
            className={
              'rounded-full px-3 py-1 text-sm font-medium ' +
              (WORK_MODE_COLORS[job.workMode] ?? WORK_MODE_COLORS.UNKNOWN)
            }
          >
            {WORK_MODE_LABELS[job.workMode] ?? job.workMode}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
          {job.location && <span>Location: {job.location}</span>}
          {salary && <span>Salary: {salary}</span>}
          {posted && <span>Posted: {posted}</span>}
          <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
            Source: {job.source.name}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to={'/jobs/' + job.id + '/match'}>
            <Button>View Match Score</Button>
          </Link>
          <Button variant="ghost" onClick={() => void navigate(`/applications?new=1&jobId=${job.id}`)}>
            Track Application
          </Button>
          <SaveJobButton job={job} size="md" initialSaved={initialSaved} />
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost">Apply on {job.source.name}</Button>
            </a>
          )}
        </div>
      </div>
      {job.description && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Job Description
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {job.description}
          </p>
        </div>
      )}
      {job.skills.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Skills and Requirements
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {job.skills.map((skill) => (
              <span
                key={skill.id}
                className={
                  'rounded-full px-3 py-1 text-sm font-medium ' +
                  (skill.isRequired
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200'
                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200')
                }
              >
                {skill.name}
                {skill.isRequired ? ' (required)' : ' (preferred)'}
              </span>
            ))}
          </div>
        </div>
      )}
      {job.url && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Interested?
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Apply directly on {job.source.name}.
          </p>
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block">
            <Button>Apply now</Button>
          </a>
        </div>
      )}
    </div>
  );
}
