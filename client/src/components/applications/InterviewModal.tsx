import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import * as api from '../../api/client';
import type {
  CreateInterviewInput,
  Interview,
  InterviewOutcome,
  InterviewType,
  UpdateInterviewInput,
} from '../../types/application';
import { INTERVIEW_OUTCOMES, INTERVIEW_TYPES } from '../../types/application';
import { Button } from '../ui/Button';
import { SelectField } from '../ui/SelectField';
import { TextField } from '../ui/TextField';
import { TextareaField } from '../ui/TextareaField';
import {
  INTERVIEW_OUTCOME_LABELS,
  INTERVIEW_TYPE_LABELS,
} from './interviewMeta';

const TYPE_OPTIONS = INTERVIEW_TYPES.map((value) => ({
  value,
  label: INTERVIEW_TYPE_LABELS[value],
}));

const OUTCOME_OPTIONS = INTERVIEW_OUTCOMES.map((value) => ({
  value,
  label: INTERVIEW_OUTCOME_LABELS[value],
}));

/** datetime-local value → ISO-8601 string for the API. */
function toIso(localValue: string): string | null {
  if (!localValue) return null;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO-8601 string from the API → datetime-local input value. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function InterviewModal({
  open,
  applicationId,
  interview,
  onClose,
  onSaved,
}: {
  open: boolean;
  applicationId: string;
  /** Null when creating a new interview; set when editing an existing one. */
  interview: Interview | null;
  onClose: () => void;
  onSaved: (interview: Interview) => void;
}) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [type, setType] = useState<InterviewType>('TECHNICAL');
  const [locationOrLink, setLocationOrLink] = useState('');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<InterviewOutcome>('PENDING');
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScheduledAt(interview ? toLocalInput(interview.scheduledAt) : '');
    setType(interview?.type ?? 'TECHNICAL');
    setLocationOrLink(interview?.locationOrLink ?? '');
    setNotes(interview?.notes ?? '');
    setOutcome(interview?.outcome ?? 'PENDING');
    setServerError(null);
    setSubmitting(false);
  }, [open, interview]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: WindowEventMap['keydown']) {
      if (event.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    const iso = toIso(scheduledAt);
    if (!iso) {
      setServerError('Please choose a valid date and time.');
      return;
    }

    const common: CreateInterviewInput = {
      scheduledAt: iso,
      type,
      locationOrLink: locationOrLink.trim() || undefined,
      notes: notes.trim() || undefined,
      outcome,
    };

    setSubmitting(true);
    try {
      if (interview) {
        const input = {
          scheduledAt: common.scheduledAt,
          type: common.type,
          locationOrLink: common.locationOrLink ?? null,
          notes: common.notes ?? null,
          outcome: common.outcome,
        } satisfies UpdateInterviewInput;
        const updated = await api.updateApplicationInterview(applicationId, interview.id, input);
        onSaved(updated);
      } else {
        const created = await api.createApplicationInterview(applicationId, common);
        onSaved(created);
      }
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to save interview');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4"
      onClick={() => !submitting && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="interviewModalTitle"
        className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="interviewModalTitle" className="text-lg font-bold tracking-tight">
            {interview ? 'Edit interview' : 'Add interview'}
          </h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label="Close dialog"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="interviewScheduledAt"
              label="Scheduled at *"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
            <SelectField
              id="interviewType"
              label="Type"
              options={TYPE_OPTIONS}
              value={type}
              onChange={(event) => setType(event.target.value as InterviewType)}
            />
          </div>

          <TextField
            id="interviewLocation"
            label="Location / link"
            placeholder="Office address or video meeting URL"
            value={locationOrLink}
            onChange={(event) => setLocationOrLink(event.target.value)}
          />

          <TextareaField
            id="interviewNotes"
            label="Notes"
            rows={4}
            maxLength={5000}
            placeholder="Anything useful to remember before or after…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          <SelectField
            id="interviewOutcome"
            label="Outcome"
            options={OUTCOME_OPTIONS}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as InterviewOutcome)}
          />

          {serverError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {serverError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : interview ? 'Save changes' : 'Add interview'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}