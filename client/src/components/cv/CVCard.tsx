import type { CvRecord } from '../../types/cv';
import { Button } from '../ui/Button';

interface CVCardProps {
  cv: CvRecord;
  busy: boolean;
  onAnalyze: (id: string) => void;
  onSetPrimary: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CVCard({ cv, busy, onAnalyze, onSetPrimary, onDelete }: CVCardProps) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
          {cv.mimeType.includes('pdf') ? '📄' : '📃'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{cv.fileName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {(cv.sizeBytes / 1024).toFixed(0)} KB ·{' '}
            {new Date(cv.uploadedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {cv.isPrimary && (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
            Primary
          </span>
        )}
        {cv.analyzedAt ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
            ✓ {cv.skillCount} skills
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Not analyzed
          </span>
        )}

        <Button
          variant="ghost"
          className="px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={() => onAnalyze(cv.id)}
        >
          {cv.analyzedAt ? 'Re-analyze' : 'Analyze'}
        </Button>
        {!cv.isPrimary && (
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={() => onSetPrimary(cv.id)}
          >
            Make primary
          </Button>
        )}
        <Button
          variant="ghost"
          className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          disabled={busy}
          onClick={() => onDelete(cv.id)}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}