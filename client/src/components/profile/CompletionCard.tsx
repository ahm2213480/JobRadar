import type { CompletionResult } from '../../types/profile';

export function CompletionCard({ completion }: { completion: CompletionResult }) {
  const { percent, missing } = completion;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Profile completion
        </h2>
        <span className="text-lg font-bold">{percent}%</span>
      </div>

      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Profile completion"
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {percent === 100 ? (
        <p className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Your profile is complete 🎉 You will get the best match results.
        </p>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Still missing: {missing.join(' · ')}
        </p>
      )}
    </div>
  );
}
