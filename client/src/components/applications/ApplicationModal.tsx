import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import * as api from '../../api/client';
import type {
  ApplicationListItem,
  ApplicationStatus,
  CreateApplicationInput,
} from '../../types/application';
import { APPLICATION_STATUSES } from '../../types/application';
import type { CvRecord } from '../../types/cv';
import { Button } from '../ui/Button';
import { SelectField } from '../ui/SelectField';
import { TextField } from '../ui/TextField';

/** What an existing surface (job detail / saved jobs) pre-fills for the form. */
export interface ApplicationPreselect {
  jobId?: string;
  title?: string;
  companyName?: string;
}

const STATUS_OPTIONS = APPLICATION_STATUSES.map((value) => ({
  value,
  label: value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' '),
}));

export function ApplicationModal({
  open,
  preselect,
  onClose,
  onCreated,
}: {
  open: boolean;
  preselect: ApplicationPreselect | null;
  onClose: () => void;
  onCreated: (application: ApplicationListItem) => void;
}) {
  // Snapshot the preselect when the dialog opens so an identity change of the
  // `preselect` object (e.g. an inline literal) never re-triggers the reset.
  const [config, setConfig] = useState<ApplicationPreselect | null>(null);
  const [cvs, setCvs] = useState<CvRecord[]>([]);
  const [status, setStatus] = useState<ApplicationStatus>('SAVED');
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [url, setUrl] = useState('');
  const [appliedAt, setAppliedAt] = useState('');
  const [salaryText, setSalaryText] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [cvId, setCvId] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfig(preselect);
    setCvs([]);
    setStatus('SAVED');
    setTitle(preselect?.title ?? '');
    setCompanyName(preselect?.companyName ?? '');
    setUrl('');
    setAppliedAt('');
    setSalaryText('');
    setContactName('');
    setContactEmail('');
    setCvId('');
    setServerError(null);
    setSubmitting(false);
    let cancelled = false;
    api
      .listCvs()
      .then((list) => {
        if (!cancelled) setCvs(list);
      })
      .catch(() => {
        // CV selection is optional — non-critical.
      });
    return () => {
      cancelled = true;
    };
  }, [open, preselect]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: WindowEventMap['keydown']) {
      if (event.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const jobMode = Boolean(config?.jobId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    if (!jobMode && !title.trim()) {
      setServerError('Job title is required for manual applications.');
      return;
    }

    const input: CreateApplicationInput = {
      status,
      ...(jobMode && config?.jobId ? { jobId: config.jobId } : {}),
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(companyName.trim() ? { companyName: companyName.trim() } : {}),
      ...(url.trim() ? { url: url.trim() } : {}),
      ...(appliedAt ? { appliedAt: new Date(appliedAt).toISOString() } : {}),
      ...(salaryText.trim() ? { salaryText: salaryText.trim() } : {}),
      ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
      ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
      ...(cvId ? { cvId } : {}),
    };

    setSubmitting(true);
    try {
      const created = await api.createApplication(input);
      onCreated(created);
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create application');
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
        aria-labelledby="newApplicationTitle"
        className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="newApplicationTitle" className="text-lg font-bold tracking-tight">
              Track an application
            </h2>
            {jobMode ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Linked to an existing JobRadar job — title and URL are filled from the job when
                left empty.
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Add an application that did not come from JobRadar (e.g. LinkedIn or another
                site).
              </p>
            )}
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
              id="applicationTitle"
              label={jobMode ? 'Job title (optional)' : 'Job title *'}
              placeholder={jobMode ? 'Taken from the job if left empty' : 'e.g. Senior React Developer'}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <SelectField
              id="applicationStatus"
              label="Status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(event) => setStatus(event.target.value as ApplicationStatus)}
            />
          </div>

          {!jobMode && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                id="applicationCompany"
                label="Company"
                placeholder="e.g. Acme GmbH"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
              <TextField
                id="applicationUrl"
                label="Application URL"
                type="url"
                placeholder="https://…"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="applicationDate"
              label="Applied date"
              type="date"
              value={appliedAt}
              onChange={(event) => setAppliedAt(event.target.value)}
            />
            <TextField
              id="applicationSalary"
              label="Salary"
              placeholder="e.g. 60k – 70k"
              value={salaryText}
              onChange={(event) => setSalaryText(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="applicationContact"
              label="Contact name"
              placeholder="Recruiter / hiring manager"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
            />
            <TextField
              id="applicationContactEmail"
              label="Contact email"
              type="email"
              placeholder="name@company.com"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
            />
          </div>

          <SelectField
            id="applicationCv"
            label="CV used"
            options={[
              { value: '', label: cvs.length === 0 ? 'No CVs uploaded' : '— none —' },
              ...cvs.map((cv) => ({ value: cv.id, label: cv.fileName })),
            ]}
            value={cvId}
            onChange={(event) => setCvId(event.target.value)}
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
              {submitting ? 'Saving…' : 'Save application'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}