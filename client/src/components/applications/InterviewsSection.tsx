import { useCallback, useEffect, useState } from 'react';
import * as api from '../../api/client';
import type { Interview, InterviewOutcome } from '../../types/application';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { InterviewModal } from './InterviewModal';
import {
  INTERVIEW_OUTCOME_COLORS,
  INTERVIEW_OUTCOME_LABELS,
  INTERVIEW_TYPE_LABELS,
} from './interviewMeta';

function isUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function InterviewsSection({ applicationId }: { applicationId: string }) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Interview | null>(null);
  const [outcomeBusy, setOutcomeBusy] = useState(false);

  const fetchInterviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInterviews(await api.listApplicationInterviews(applicationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load interviews');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void fetchInterviews();
  }, [fetchInterviews]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(interview: Interview) {
    setEditing(interview);
    setModalOpen(true);
  }

  async function handleChangeOutcome(interview: Interview, next: string) {
    if (next === interview.outcome || outcomeBusy) return;
    setOutcomeBusy(true);
    setError(null);
    try {
      const updated = await api.updateApplicationInterview(applicationId, interview.id, {
        outcome: next as InterviewOutcome,
      });
      setInterviews((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update outcome');
    } finally {
      setOutcomeBusy(false);
    }
  }

  async function handleDelete(interview: Interview) {
    if (
      !window.confirm(
        `Delete this ${INTERVIEW_TYPE_LABELS[interview.type].toLowerCase()} interview?`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await api.deleteApplicationInterview(applicationId, interview.id);
      setInterviews((prev) => prev.filter((entry) => entry.id !== interview.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete interview');
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Interviews
        </h2>
        <Button variant="ghost" onClick={openCreate}>
          + Add interview
        </Button>
      </div>

      {error && interviews.length === 0 && (
        <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {error}{' '}
          <button
            type="button"
            onClick={() => void fetchInterviews()}
            className="font-medium underline"
          >
            Try again
          </button>
        </p>
      )}
      {error && interviews.length > 0 && (
        <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading interviews…
          </p>
        ) : interviews.length === 0 && !error ? (
          <EmptyState
            icon="mic"
            title="No interviews scheduled"
            message="Add interviews to keep track of every round of the process."
          >
            <Button variant="ghost" onClick={openCreate}>
              + Add interview
            </Button>
          </EmptyState>
        ) : (
          interviews.map((interview) => (
            <div
              key={interview.id}
              className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">
                    {INTERVIEW_TYPE_LABELS[interview.type]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${INTERVIEW_OUTCOME_COLORS[interview.outcome]}`}
                  >
                    {INTERVIEW_OUTCOME_LABELS[interview.outcome]}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Icon name="calendar" className="h-3 w-3" />
                    {new Date(interview.scheduledAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Interview outcome"
                    value={interview.outcome}
                    disabled={outcomeBusy}
                    onChange={(event) => void handleChangeOutcome(interview, event.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none dark:border-slate-700 dark:bg-slate-900"
                  >
                    {(['PENDING', 'PASSED', 'FAILED'] as InterviewOutcome[]).map((value) => (
                      <option key={value} value={value}>
                        {INTERVIEW_OUTCOME_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => openEdit(interview)}
                    className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(interview)}
                    className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {interview.locationOrLink && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  {isUrl(interview.locationOrLink) ? (
                    <a
                      href={interview.locationOrLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {interview.locationOrLink}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="map-pin" className="h-3 w-3" />
                      {interview.locationOrLink}
                    </span>
                  )}
                </p>
              )}
              {interview.notes && (
                <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">
                  {interview.notes}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <InterviewModal
        open={modalOpen}
        applicationId={applicationId}
        interview={editing}
        onClose={() => setModalOpen(false)}
        onSaved={(updated) => {
          setInterviews((prev) => {
            const found = prev.some((entry) => entry.id === updated.id);
            if (found) {
              return prev.map((entry) => (entry.id === updated.id ? updated : entry));
            }
            return [...prev, updated].sort(
              (a, b) =>
                new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
            );
          });
        }}
      />
    </section>
  );
}