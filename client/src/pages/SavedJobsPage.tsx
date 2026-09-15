import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/client';
import { JobCard } from '../components/jobs/JobCard';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import type { SavedJobListItem } from '../types/saved';

export function SavedJobsPage() {
  const [jobs, setJobs] = useState<SavedJobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listSavedJobs();
      setJobs(result.savedJobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSaved();
  }, [fetchSaved]);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Saved jobs</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {jobs.length === 1 ? '1 job' : `${jobs.length} jobs`} saved for later.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}{' '}
          <button type="button" onClick={() => void fetchSaved()} className="font-medium underline">
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading saved jobs…
        </p>
      ) : jobs.length === 0 && !error ? (
        <EmptyState
          icon="bookmark"
          title="No saved jobs yet"
          message="Save jobs from the jobs list or a job detail page to track them here."
        >
          <Link to="/jobs">
            <Button>Browse jobs</Button>
          </Link>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {jobs.map((job) => (
            <div key={job.id} className="flex flex-col gap-2">
              <JobCard
                job={job}
                initialSaved
                onSavedChange={(next) => {
                  // On the /saved page an unsave removes the card from the list.
                  if (!next) {
                    setJobs((prev) => prev.filter((entry) => entry.id !== job.id));
                  }
                }}
              />
              <Link
                to={`/applications?new=1&jobId=${job.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Track application
                <Icon name="arrow-right" className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
