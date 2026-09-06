import { useEffect, useState } from 'react';
import { fetchHealth, type HealthResponse } from '../api/client';

type ConnectionState = 'checking' | 'online' | 'offline';

const databaseLabels: Record<
  HealthResponse['database'],
  { label: string; className: string }
> = {
  connected: {
    label: 'Connected',
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  not_configured: {
    label: 'Not configured',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  unreachable: {
    label: 'Unreachable',
    className:
      'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
};

export function HomePage() {
  const [state, setState] = useState<ConnectionState>('checking');
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((data) => {
        if (cancelled) return;
        setHealth(data);
        setState('online');
      })
      .catch(() => {
        if (cancelled) return;
        setState('offline');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">JobRadar is booting up</h1>
      <p className="max-w-2xl text-slate-600 dark:text-slate-400">
        Phase 0 foundation: monorepo, API server, web client and database schema
        are in place. Authentication, CV analysis, job matching and the
        dashboard arrive in the next phases.
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          API status
        </h2>

        {state === 'checking' && (
          <p className="text-slate-500 dark:text-slate-400">
            Checking connection to the API…
          </p>
        )}

        {state === 'offline' && (
          <p className="text-rose-600 dark:text-rose-400">
            Cannot reach the API. Make sure the server is running (npm run dev).
          </p>
        )}

        {state === 'online' && health && (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Service</dt>
              <dd className="font-medium">{health.service}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Environment</dt>
              <dd className="font-medium">{health.environment}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Version</dt>
              <dd className="font-medium">{health.version}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Database</dt>
              <dd>
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${databaseLabels[health.database].className}`}
                >
                  {databaseLabels[health.database].label}
                </span>
              </dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}
