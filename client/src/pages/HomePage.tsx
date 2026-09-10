import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/client';
import type { MatchResult } from '../types/matching';
import type { ProfileBundle } from '../types/profile';

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (score >= 60) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  if (score >= 40) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300';
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
      <div className="py-20 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading your JobRadar dashboard…
      </div>
    );
  }

  const completion = bundle?.completion?.percent ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Welcome back! Here is your AI-powered job discovery overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/jobs"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            Browse all jobs ({stats?.totalJobs ?? 0})
          </Link>
          <Link
            to="/cv"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition"
          >
            Manage CV
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Profile Completion
          </h2>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {completion}%
          </span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${completion}%` }}
          />
        </div>
        {completion < 100 && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Complete your profile and upload a CV to get higher match accuracy. {" " }
            <Link to="/profile" className="text-blue-600 hover:underline dark:text-blue-400">
              Complete profile →
            </Link>
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Top Recommended Jobs</h2>
          <Link
            to="/jobs"
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            View all →
          </Link>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No matches found yet. Upload your CV and set your preferences to see tailored matches!
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                to="/cv"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Upload CV
              </Link>
              <Link
                to="/settings"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
              >
                Set preferences
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {matches.map((match) => (
              <div
                key={match.jobId}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {match.title}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {match.company ?? 'Unknown company'}
                        {match.location ? ` · ${match.location}` : ''}
                      </p>
                    </div>
                    <span
                      className={"rounded-full px-2.5 py-1 text-xs font-bold " + scoreBg(match.score)}
                    >
                      {match.score}% Match
                    </span>
                  </div>

                  {match.aiExplanation && (
                    <p className="text-xs text-slate-600 line-clamp-2 dark:text-slate-400">
                      {match.aiExplanation}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="text-xs font-medium text-slate-400 uppercase">
                    {match.recommendation.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-3">
                    <Link
                      to={"/jobs/" + match.jobId}
                      className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View job →
                    </Link>
                    <Link
                      to={"/jobs/" + match.jobId + "/match"}
                      className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      Why you match →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
