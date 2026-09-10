import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import { JobCard } from '../components/jobs/JobCard';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { SelectField } from '../components/ui/SelectField';
import { EmptyState } from '../components/ui/EmptyState';
import type { JobListItem, JobSourceInfo, SyncSummary } from '../types/job';
import { AddJobModal } from '../components/jobs/AddJobModal';

const WORK_MODE_OPTIONS = [
  { value: '', label: 'Any work mode' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ONSITE', label: 'On-site' },
];

const PAGE_SIZE = 30;

export function JobsPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const [q, setQ] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [location, setLocation] = useState('');
  const [source, setSource] = useState('');
  const [sources, setSources] = useState<JobSourceInfo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncSummary | null>(null);
  // Known saved job IDs — fetched once per list load so cards render the
  // correct state without one status request per card.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, saved] = await Promise.all([
        api.listJobs({
          q: q || undefined,
          workMode: workMode || undefined,
          location: location || undefined,
          source: source || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }),
        api.listSavedJobs().catch(() => ({ savedJobs: [], total: 0 })),
      ]);
      setJobs(result.jobs);
      setTotal(result.total);
      setSavedIds(new Set(saved.savedJobs.map((entry) => entry.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [q, workMode, location, source, page]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    setPage(0);
  }, [q, workMode, location, source]);

  useEffect(() => {
    (async () => {
      try {
        setSources(await api.listJobSources());
      } catch {
        // Non-critical — filters still work without the source list.
      }
    })();
  }, []);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const summary = await api.syncJobs();
      setLastSync(summary);
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  function handleJobCreated() {
    // Close, jump back to page 1 (the newest manual job sorts there),
    // and refresh the list.
    setModalOpen(false);
    if (page !== 0) {
      setPage(0);
    } else {
      void fetchJobs();
    }
  }

  const sourceOptions = [
    { value: '', label: 'All sources' },
    ...sources.map((s) => ({ value: s.slug, label: s.name })),
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {total.toLocaleString()} open positions from {sources.length} sources.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
          <Button onClick={() => setModalOpen(true)}>Add job</Button>
        </div>
      </div>

      {lastSync && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Sync complete: {lastSync.results.reduce((sum, r) => sum + r.created, 0)} new
          jobs across {lastSync.results.length} sources.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          id="jobSearch"
          label="Search"
          placeholder="e.g. React developer"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && fetchJobs()}
        />
        <SelectField
          id="workMode"
          label="Work mode"
          options={WORK_MODE_OPTIONS}
          value={workMode}
          onChange={(event) => setWorkMode(event.target.value)}
        />
        <TextField
          id="location"
          label="Location"
          placeholder="e.g. Berlin, Remote"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
        <SelectField
          id="source"
          label="Source"
          options={sourceOptions}
          value={source}
          onChange={(event) => setSource(event.target.value)}
        />
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading jobs…
        </p>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon="📭"
          title="No jobs found"
          message="Try adjusting your search or filters, or click 'Sync now' to pull the latest openings."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                initialSaved={savedIds.has(job.id)}
                onSavedChange={(next) => {
                  setSavedIds((prev) => {
                    const copy = new Set(prev);
                    if (next) {
                      copy.add(job.id);
                    } else {
                      copy.delete(job.id);
                    }
                    return copy;
                  });
                }}
              />
            ))}
          </div>
          <PaginationBar
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            loading={loading}
            onPage={setPage}
          />
        </>
      )}
      {modalOpen && (
        <AddJobModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={handleJobCreated}
        />
      )}
    </section>
  );
}

function PaginationBar({
  page,
  total,
  pageSize,
  loading,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  loading: boolean;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const hasPrev = page > 0;
  const hasNext = (page + 1) * pageSize < total;
  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        onClick={() => onPage(page - 1)}
        disabled={!hasPrev || loading}
      >
        Previous
      </Button>
      <span className="px-3 text-sm text-slate-600 dark:text-slate-400">
        Page {page + 1} of {totalPages}
      </span>
      <Button
        variant="ghost"
        onClick={() => onPage(page + 1)}
        disabled={!hasNext || loading}
      >
        Next
      </Button>
    </div>
  );
}