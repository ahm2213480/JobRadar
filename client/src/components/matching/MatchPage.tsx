import { useEffect, useState } from 'react';
import * as api from '../../api/client';
import type { MatchResult } from '../../types/matching';
import { Icon } from '../ui/Icon';

const RECOMMENDATION_STYLES: Record<string, { color: string; label: string }> = {
  HIGHLY_RECOMMENDED: {
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    label: 'Highly recommended',
  },
  RECOMMENDED: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    label: 'Recommended',
  },
  CONSIDER: {
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    label: 'Consider',
  },
  NOT_RECOMMENDED: {
    color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
    label: 'Not recommended',
  },
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export function MatchPage({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getMatch(jobId);
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to compute match');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (loading) {
    return (
      <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        Computing your match…
      </p>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
      >
        {error}
      </div>
    );
  }

  if (!result) return null;

  const recStyle = RECOMMENDATION_STYLES[result.recommendation];

  return (
    <section className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        <Icon name="arrow-left" className="h-4 w-4" />
        Back to jobs
      </button>

      {/* Score hero */}
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Match Score
        </p>
        <p className={`mt-2 text-6xl font-bold ${scoreColor(result.score)}`}>
          {result.score}
          <span className="text-2xl text-slate-400">/100</span>
        </p>
        <span
          className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium ${recStyle.color}`}
        >
          {recStyle.label}
        </span>
        {result.aiExplanation && (
          <p className="mx-auto mt-4 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            {result.aiExplanation}
          </p>
        )}
        {!result.aiExplanation && !result.aiUsed && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Icon name="alert" className="h-3.5 w-3.5" />
            AI explanation unavailable — score is computed deterministically.
          </p>
        )}
      </div>

      {/* Factor breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Score breakdown
        </h2>
        <div className="mt-4 space-y-4">
          {result.factors.map((factor) => {
            const contribution = Math.round(factor.weightedScore * 100);
            const barWidth = Math.round(factor.score * 100);
            return (
              <div key={factor.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{factor.label}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {contribution} pts
                    <span className="ml-1 text-xs text-slate-400">
                      (weight {Math.round(factor.weight * 100)}%)
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {factor.explanation}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skills comparison */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <Icon name="check-circle" className="h-4 w-4" />
            Matched skills
          </h3>
          {result.matchedRequiredSkills.length === 0 &&
          result.matchedPreferredSkills.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              No matching skills detected.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.matchedRequiredSkills.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                >
                  {s}
                </span>
              ))}
              {result.matchedPreferredSkills.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-200"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
            <Icon name="x" className="h-4 w-4" />
            Missing skills
          </h3>
          {result.missingRequiredSkills.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              You have all required skills — great fit!
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.missingRequiredSkills.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/50 dark:text-rose-200"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
