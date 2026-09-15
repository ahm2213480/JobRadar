import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../api/client';
import { ApplicationCard } from '../components/applications/ApplicationCard';
import { ApplicationModal } from '../components/applications/ApplicationModal';
import type { ApplicationPreselect } from '../components/applications/ApplicationModal';
import { STATUS_LABELS } from '../components/applications/statusMeta';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import type { ApplicationListItem, ApplicationStatus } from '../types/application';
import { APPLICATION_STATUSES } from '../types/application';

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [applications, setApplications] = useState<ApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [preselect, setPreselect] = useState<ApplicationPreselect | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listApplications();
      setApplications(result.applications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  // Deep links from JobDetailPage / SavedJobsPage: /applications?new=1&jobId=..&title=..
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setPreselect({
      jobId: searchParams.get('jobId') ?? undefined,
      title: searchParams.get('title') ?? undefined,
    });
    setModalOpen(true);
    // Drop the query params so re-navigating to /applications doesn't reopen.
    navigate('/applications', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openManualModal() {
    setPreselect(null);
    setModalOpen(true);
  }

  function handleCreated() {
    void fetchApplications();
  }

  function handleStatusChange(updated: ApplicationListItem) {
    setApplications((prev) => prev.map((app) => (app.id === updated.id ? updated : app)));
  }

  async function handleDelete(application: ApplicationListItem) {
    if (!window.confirm(`Delete “${application.title}” from your applications?`)) return;
    setBusyIds((prev) => new Set(prev).add(application.id));
    setError(null);
    try {
      await api.deleteApplication(application.id);
      setApplications((prev) => prev.filter((app) => app.id !== application.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete application');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(application.id);
        return next;
      });
    }
  }

  const byStatus = new Map<ApplicationStatus, ApplicationListItem[]>();
  for (const status of APPLICATION_STATUSES) byStatus.set(status, []);
  for (const app of applications) {
    byStatus.get(app.status)?.push(app);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Track every application from first contact to offer.
          </p>
        </div>
        <Button onClick={openManualModal}>Add application</Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}{' '}
          <button
            type="button"
            onClick={() => void fetchApplications()}
            className="font-medium underline"
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading applications…
        </p>
      ) : applications.length === 0 && !error ? (
        <EmptyState
          icon="folder"
          title="No applications tracked yet"
          message="Add your first application from a job or manually — JobRadar keeps the status, notes and interviews organised for you."
        >
          <Button onClick={openManualModal}>Add your first application</Button>
        </EmptyState>
      ) : (
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          {APPLICATION_STATUSES.map((status) => {
            const items = byStatus.get(status) ?? [];
            return (
              <div
                key={status}
                className="flex w-64 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    {STATUS_LABELS[status]}
                  </h2>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-3 px-2 py-3">
                  {items.map((app) => (
                    <ApplicationCard
                      key={app.id}
                      application={app}
                      busyIds={busyIds}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                      Nothing here yet.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ApplicationModal
        open={modalOpen}
        preselect={preselect}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </section>
  );
}