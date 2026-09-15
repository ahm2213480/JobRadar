import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/client';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon, type IconName } from '../components/ui/Icon';
import { Spinner } from '../components/ui/Spinner';
import type { MatchResult } from '../types/matching';
import type { ProfileBundle } from '../types/profile';

const RECOMMENDATION_COLORS: Record<string, string> = {
  HIGHLY_RECOMMENDED:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  RECOMMENDED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  CONSIDER: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  NOT_RECOMMENDED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
};

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (score >= 60) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  if (score >= 40) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300';
}

function StatCard({
  icon,
  label,
  value,
  accent = 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
}: {
  icon: IconName;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${accent}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tabular-nums tracking-tight">{value}</p>
          <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const [bundle, setBundle] = useState<ProfileBundle | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [stats, setStats] = useState<{ totalJobs: number; totalCompanies: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [profileRes, matchesRes, statsRes] = await Promise.all([
          api.fetchProfileBundle().catch(() => null),
          api.getMatches(5).catch(() => ({ matches: [], total: 0 })),
          api.getJobStats().catch(() => null),
        ]);
        if (cancelled) return;
        setBundle(profileRes);
        setMatches(matchesRes.matches);
        setStats(statsRes);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-20 text-sm text-slate-500 dark:text-slate-400">
        <Spinner />
        Loading your dashboard…
      </div>
    );
  }

  const completion = bundle?.completion?.percent ?? 0;
  const topScore = matches[0]?.score;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-8 shadow-lg">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
              Dashboard
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Find your next role, faster.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100">
              Jobs synced from multiple sources, matched transparently against your
              skills and preferences — every score is explainable.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/jobs"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
            >
              Browse jobs
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
            <Link
              to="/cv"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Manage CV
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon="briefcase"
          label="Open jobs"
          value={(stats?.totalJobs ?? 0).toLocaleString()}
        />
        <StatCard
          icon="building"
          label="Companies"
          value={(stats?.totalCompanies ?? 0).toLocaleString()}
          accent="bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400"
        />
        <StatCard
          icon="target"
          label="Top match"
          value={topScore !== undefined ? `${topScore}%` : '—'}
          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
        />
        <StatCard
          icon="user"
          label="Profile complete"
          value={`${completion}%`}
          accent={
            completion >= 100
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
          }
        />
      </section>

      {/* Profile completion */}
      {completion < 100 && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Profile completion
            </h2>
            <span className="text-sm font-bold tabular-nums">{completion}%</span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Complete your profile and upload a CV to get higher match accuracy.{' '}
            <Link
              to="/profile"
              className="inline-flex items-center gap-0.5 font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Complete profile
              <Icon name="arrow-right" className="h-3.5 w-3.5" />
            </Link>
          </p>
        </section>
      )}

      {/* Top matches */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Top matches</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Ranked by the transparent seven-factor score.
            </p>
          </div>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            View all
            <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        </div>

        {matches.length === 0 ? (
          <EmptyState
            icon="target"
            title="No matches yet"
            message="Upload your CV and set your preferences to see tailored matches here."
          >
            <Link
              to="/cv"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              Upload CV
            </Link>
            <Link
              to="/settings"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Set preferences
            </Link>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {matches.map((match) => (
              <article
                key={match.jobId}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">
                        {match.title}
                      </h3>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                        {match.company ?? 'Unknown company'}
                        {match.location ? ` · ${match.location}` : ''}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${scoreBg(match.score)}`}
                    >
                      {match.score}%
                    </span>
                  </div>

                  {match.aiExplanation && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {match.aiExplanation}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                      RECOMMENDATION_COLORS[match.recommendation] ??
                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {match.recommendation.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  <div className="flex items-center gap-4">
                    <Link
                      to={'/jobs/' + match.jobId}
                      className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View job
                      <Icon name="arrow-right" className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      to={'/jobs/' + match.jobId + '/match'}
                      className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      Why you match
                      <Icon name="arrow-right" className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
