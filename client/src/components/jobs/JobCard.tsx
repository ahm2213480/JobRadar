import { Link } from 'react-router-dom';
import type { JobListItem } from '../../types/job';
import { SaveJobButton } from './SaveJobButton';

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
  const formatter = (value: number) =>
    currency ? `${currency} ${value.toLocaleString()}` : value.toLocaleString();
  if (min != null && max != null && min !== max) {
    return `${formatter(min)} – ${formatter(max)}`;
  }
  return formatter(min ?? max ?? 0);
}

export function JobCard({
  job,
  saved,
  initialSaved,
  onSavedChange,
}: {
  job: JobListItem;
  /** Hint that this card is rendered inside the /saved list (affects empty-list UX only). */
  saved?: boolean;
  /** Known saved state — passed from parents that already fetched it (avoids a request). */
  initialSaved?: boolean;
  onSavedChange?: (saved: boolean) => void;
}) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const posted = job.postedAt
    ? new Date(job.postedAt).toLocaleDateString()
    : null;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">
            <Link
              to={`/jobs/${job.id}`}
              className="hover:underline"
            >
              {job.title}
            </Link>
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {job.company?.name ?? 'Unknown company'}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${WORK_MODE_COLORS[job.workMode] ?? WORK_MODE_COLORS.UNKNOWN}`}
        >
          {WORK_MODE_LABELS[job.workMode] ?? job.workMode}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {job.location && <span>📍 {job.location}</span>}
        {salary && <span>💰 {salary}</span>}
        {posted && <span>🗓 {posted}</span>}
        <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
          {job.source.name}
        </span>
      </div>

      {job.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.skills.slice(0, 8).map((skill) => (
            <span
              key={skill.id}
              className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-200"
            >
              {skill.name}
            </span>
          ))}
          {job.skills.length > 8 && (
            <span className="text-xs text-slate-400">+{job.skills.length - 8}</span>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          to={`/jobs/${job.id}`}
          className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-200"
        >
          View details →
        </Link>
        <SaveJobButton
          job={job}
          initialSaved={initialSaved ?? saved}
          onChanged={(next) => {
            // On the /saved page an unsave means the card should disappear.
            onSavedChange?.(next);
          }}
        />
        {job.url ? (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Opens the original posting in a new tab"
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            View original posting ↗
          </a>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Added manually — no external link provided.
          </span>
        )}
      </div>
    </article>
  );
}