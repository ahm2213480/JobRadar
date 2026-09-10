import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../../api/client';
import type { ApplicationListItem, ApplicationStatus } from '../../types/application';
import { Button } from '../ui/Button';
import { SelectField } from '../ui/SelectField';
import { STATUS_OPTIONS } from './statusMeta';

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200';
  if (score >= 60) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200';
  return 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200';
}

export function ApplicationCard({
  application,
  busyIds,
  onStatusChange,
  onDelete,
}: {
  application: ApplicationListItem;
  /** Set of application ids with an in-flight status update. */
  busyIds: ReadonlySet<string>;
  onStatusChange: (application: ApplicationListItem) => void;
  onDelete: (application: ApplicationListItem) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const busy = busyIds.has(application.id);

  const companyName =
    application.company?.name ?? application.job?.company?.name ?? 'Unknown company';
  const appliedAt = application.appliedAt
    ? new Date(application.appliedAt).toLocaleDateString()
    : null;

  async function handleStatusChange(next: string) {
    if (next === application.status) return;
    setError(null);
    try {
      const updated = await api.updateApplicationStatus(application.id, next as ApplicationStatus);
      onStatusChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="truncate text-sm font-semibold">
        {application.jobId ? (
          <Link
            to={`/jobs/${application.jobId}`}
            className="hover:underline"
            title="Open job details"
          >
            {application.title}
          </Link>
        ) : (
          <>{application.title}</>
        )}
      </p>
      <p className="truncate text-xs text-slate-600 dark:text-slate-400">{companyName}</p>

      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
        {application.matchScoreSnapshot !== null && (
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${scoreColor(application.matchScoreSnapshot)}`}
          >
            {application.matchScoreSnapshot}% match
          </span>
        )}
        {appliedAt && <span>🗓 {appliedAt}</span>}
        {application.salaryText && <span>💰 {application.salaryText}</span>}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SelectField
          id={`applicationStatus-${application.id}`}
          label="Status"
          options={STATUS_OPTIONS}
          value={application.status}
          disabled={busy || error !== null}
          onChange={(event) => void handleStatusChange(event.target.value)}
        />
        <Link
          to={`/applications/${application.id}`}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View details →
        </Link>
        <Button
          variant="ghost"
          disabled={busy || error !== null}
          onClick={() => onDelete(application)}
        >
          Delete
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </article>
  );
}