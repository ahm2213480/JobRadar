import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../../api/client';
import type { JobListItem } from '../../types/job';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

interface SaveJobButtonProps {
  job: JobListItem;
  /** Initial saved state, if already known by the parent (avoids a request). */
  initialSaved?: boolean;
  /** Compact rendering for cards; full-width button on the detail page. */
  size?: 'sm' | 'md';
  /** Called after a successful save/unsave so parents can refresh. */
  onChanged?: (saved: boolean) => void;
}

/**
 * Save/Unsave toggle for a job. Shows the correct state, disables itself
 * while the request is running, and surfaces API errors inline.
 */
export function SaveJobButton({ job, initialSaved, size = 'sm', onChanged }: SaveJobButtonProps) {
  const [saved, setSaved] = useState<boolean | null>(initialSaved ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy-load the saved state on first hover/focus so job lists with many
  // cards don't fire one status request per card on mount.
  async function ensureStatus(): Promise<void> {
    if (saved !== null || busy) return;
    setBusy(true);
    try {
      const result = await api.isJobSaved(job.id);
      setSaved(result.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check saved status');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (saved) {
        await api.unsaveJob(job.id);
        setSaved(false);
        onChanged?.(false);
      } else {
        await api.saveJob(job.id);
        setSaved(true);
        onChanged?.(true);
      }
    } catch (err) {
      // 409 = already saved (e.g. saved from another tab) — sync the state.
      if (err instanceof api.ApiError && err.status === 409) {
        setSaved(true);
        onChanged?.(true);
      } else {
        setError(err instanceof Error ? err.message : 'Could not update saved status');
      }
    } finally {
      setBusy(false);
    }
  }

  const label = busy && saved === null ? '…' : saved ? 'Saved' : 'Save';

  return (
    <span
      className="inline-flex flex-col gap-1"
      onMouseEnter={() => void ensureStatus()}
      onFocus={() => void ensureStatus()}
    >
      <Button
        variant={saved ? 'primary' : 'secondary'}
        onClick={() => void (saved === null ? ensureStatus().then(() => void toggle()) : toggle())}
        disabled={busy}
        aria-pressed={saved ?? undefined}
        aria-label={saved ? `Unsave ${job.title}` : `Save ${job.title}`}
        className={size === 'sm' ? 'px-3 py-1 text-xs' : undefined}
      >
        {saved !== null && (
          <Icon
            name="star"
            className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'}
            {...(saved ? { fill: 'currentColor' } : {})}
          />
        )}
        {label}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}{' '}
          <Link to="/saved" className="underline">
            View saved
          </Link>
        </span>
      )}
    </span>
  );
}
