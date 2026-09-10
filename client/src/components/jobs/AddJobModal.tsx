import { useEffect, useState, type FormEvent } from 'react';
import * as api from '../../api/client';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { TextareaField } from '../ui/TextareaField';
import { SelectField } from '../ui/SelectField';
import type { EmploymentType, ManualJobInput, WorkMode } from '../../types/job';

const WORK_MODE_OPTIONS = [
  { value: 'UNKNOWN', label: 'Unknown / any' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ONSITE', label: 'On-site' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'UNKNOWN', label: 'Unknown' },
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'TEMPORARY', label: 'Temporary' },
  { value: 'OTHER', label: 'Other' },
];

const LIMITS = {
  title: 200,
  companyName: 200,
  description: 15_000,
  descriptionMin: 50,
  location: 200,
};

interface FormState {
  title: string;
  companyName: string;
  description: string;
  location: string;
  url: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
}

const INITIAL_FORM: FormState = {
  title: '',
  companyName: '',
  description: '',
  location: '',
  url: '',
  workMode: 'UNKNOWN',
  employmentType: 'UNKNOWN',
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const title = form.title.trim();
  const description = form.description.trim();
  const companyName = form.companyName.trim();
  const location = form.location.trim();
  const url = form.url.trim();

  if (!title) errors.title = 'Job title is required';
  else if (title.length > LIMITS.title) {
    errors.title = 'Job title must be at most ' + LIMITS.title + ' characters';
  }

  if (!description) errors.description = 'Description is required';
  else if (description.length < LIMITS.descriptionMin) {
    errors.description = 'Description must be at least ' + LIMITS.descriptionMin + ' characters';
  } else if (description.length > LIMITS.description) {
    errors.description = 'Description must be at most ' + LIMITS.description + ' characters';
  }

  if (companyName.length > LIMITS.companyName) {
    errors.companyName = 'Company name must be at most ' + LIMITS.companyName + ' characters';
  }

  if (location.length > LIMITS.location) {
    errors.location = 'Location must be at most ' + LIMITS.location + ' characters';
  }

  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.url = 'URL must start with http:// or https://';
      }
    } catch {
      errors.url = 'Enter a valid URL (e.g. https://company.com/jobs/123)';
    }
  }

  return errors;
}

export function AddJobModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(INITIAL_FORM);
      setFieldErrors({});
      setServerError(null);
      setSubmitting(false);
    }
  }, [open]);

  // Close on Escape (but never while a save is in flight).
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear the field-level error as soon as the user edits that field.
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    setServerError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const input: ManualJobInput = {
        title: form.title.trim(),
        description: form.description.trim(),
        workMode: form.workMode,
        employmentType: form.employmentType,
        ...(form.companyName.trim() ? { companyName: form.companyName.trim() } : {}),
        ...(form.location.trim() ? { location: form.location.trim() } : {}),
        ...(form.url.trim() ? { url: form.url.trim() } : {}),
      };
      const created = await api.addManualJob(input);
      onCreated(created.id);
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create job');
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
        aria-labelledby="add-job-title"
        className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="add-job-title" className="text-lg font-bold tracking-tight">
              Add a job manually
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Paste a posting you found elsewhere — JobRadar will extract skills and include it in
              your matches.
            </p>
          </div>
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
              id="manualTitle"
              label="Job title *"
              placeholder="e.g. Senior React Developer"
              maxLength={LIMITS.title}
              value={form.title}
              onChange={(event) => setField('title', event.target.value)}
            />
            <TextField
              id="manualCompany"
              label="Company"
              placeholder="e.g. Acme GmbH"
              maxLength={LIMITS.companyName}
              value={form.companyName}
              onChange={(event) => setField('companyName', event.target.value)}
            />
          </div>
          {(fieldErrors.title || fieldErrors.companyName) && (
            <p role="alert" className="-mt-2 text-xs text-rose-600 dark:text-rose-400">
              {fieldErrors.title ?? fieldErrors.companyName}
            </p>
          )}

          <div>
            <TextareaField
              id="manualDescription"
              label="Job description *"
              rows={7}
              maxLength={LIMITS.description}
              placeholder="Paste the full job description here (at least 50 characters)…"
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
            />
            <div className="mt-1 flex items-center justify-between">
              {fieldErrors.description ? (
                <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                  {fieldErrors.description}
                </p>
              ) : (
                <span />
              )}
              <span
                className={'text-xs ' + (
                  form.description.trim().length < LIMITS.descriptionMin
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-400 dark:text-slate-500'
                )}
              >
                {form.description.trim().length}/{LIMITS.descriptionMin} characters minimum
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="manualLocation"
              label="Location"
              placeholder="e.g. Berlin, Remote"
              maxLength={LIMITS.location}
              value={form.location}
              onChange={(event) => setField('location', event.target.value)}
            />
            <TextField
              id="manualUrl"
              label="Application URL"
              type="url"
              placeholder="https://…"
              value={form.url}
              onChange={(event) => setField('url', event.target.value)}
            />
          </div>
          {(fieldErrors.location || fieldErrors.url) && (
            <p role="alert" className="-mt-2 text-xs text-rose-600 dark:text-rose-400">
              {fieldErrors.location ?? fieldErrors.url}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="manualWorkMode"
              label="Work mode"
              options={WORK_MODE_OPTIONS}
              value={form.workMode}
              onChange={(event) => setField('workMode', event.target.value as WorkMode)}
            />
            <SelectField
              id="manualEmploymentType"
              label="Employment type"
              options={EMPLOYMENT_TYPE_OPTIONS}
              value={form.employmentType}
              onChange={(event) =>
                setField('employmentType', event.target.value as EmploymentType)
              }
            />
          </div>

          {serverError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {serverError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save job'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}