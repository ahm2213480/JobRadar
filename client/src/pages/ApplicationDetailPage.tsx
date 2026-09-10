import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '../api/client';
import { InterviewsSection } from '../components/applications/InterviewsSection';
import { NotesSection } from '../components/applications/NotesSection';
import { STATUS_LABELS, STATUS_OPTIONS } from '../components/applications/statusMeta';
import { Button } from '../components/ui/Button';
import { SelectField } from '../components/ui/SelectField';
import { TextField } from '../components/ui/TextField';
import type {
  ApplicationListItem,
  ApplicationStatus,
  UpdateApplicationInput,
} from '../types/application';

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [application, setApplication] = useState<ApplicationListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const fetchApplication = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setApplication(await api.getApplication(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchApplication();
  }, [fetchApplication]);

  async function handleStatusChange(next: string) {
    if (!application || next === application.status || statusBusy) return;
    setStatusBusy(true);
    setError(null);
    try {
      const updated = await api.updateApplicationStatus(application.id, next as ApplicationStatus);
      setApplication(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleDelete() {
    if (!application) return;
    if (!window.confirm(`Delete “${application.title}” permanently?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteApplication(application.id);
      navigate('/applications', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete application');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading application details…
      </p>
    );
  }

  if (error && !application) {
    return (
      <div className="space-y-4">
        <Link
          to="/applications"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to applications
        </Link>
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="space-y-4">
        <Link
          to="/applications"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to applications
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Application not found.</p>
        </div>
      </div>
    );
  }
// PLACEHOLDER_RETURN
  return (
    <div className="space-y-6">
      <Link
        to="/applications"
        className="inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Back to applications
      </Link>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{application.title}</h1>
            <p className="mt-1 text-lg text-slate-600 dark:text-slate-400">
              {application.company?.name ?? application.job?.company?.name ?? 'Unknown company'}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {STATUS_LABELS[application.status]}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-2">
          {application.matchScoreSnapshot !== null && (
            <span>Match score at creation: {application.matchScoreSnapshot}%</span>
          )}
          {application.appliedAt && (
            <span>Applied: {new Date(application.appliedAt).toLocaleDateString()}</span>
          )}
          {application.salaryText && <span>Salary: {application.salaryText}</span>}
          {application.contactName && <span>Contact: {application.contactName}</span>}
          {application.contactEmail && <span>Email: {application.contactEmail}</span>}
          {application.url && (
            <span>
              Posting:{' '}
              <a
                href={application.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {application.url}
              </a>
            </span>
          )}
          {application.jobId && (
            <Link
              to={`/jobs/${application.jobId}`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              View related job →
            </Link>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <SelectField
            id="applicationDetailStatus"
            label="Status"
            options={STATUS_OPTIONS}
            value={application.status}
            disabled={statusBusy}
            onChange={(event) => void handleStatusChange(event.target.value)}
          />
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="ghost" disabled={deleting} onClick={() => void handleDelete()}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>

      {editing && (
        <EditApplicationCard
          application={application}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            setApplication(updated);
            setEditing(false);
          }}
        />
      )}

      <NotesSection applicationId={application.id} />
      <InterviewsSection applicationId={application.id} />
    </div>
  );
}

// ------------------------- Edit helper -------------------------

function EditApplicationCard({
  application,
  onCancel,
  onSaved,
}: {
  application: ApplicationListItem;
  onCancel: () => void;
  onSaved: (updated: ApplicationListItem) => void;
}) {
  const [title, setTitle] = useState(application.title);
  const [url, setUrl] = useState(application.url ?? '');
  const [appliedAt, setAppliedAt] = useState(
    application.appliedAt ? application.appliedAt.slice(0, 10) : '',
  );
  const [salaryText, setSalaryText] = useState(application.salaryText ?? '');
  const [contactName, setContactName] = useState(application.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(application.contactEmail ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const input: UpdateApplicationInput = {
        title: title.trim() || application.title,
        url: url.trim() === '' ? null : url.trim(),
        appliedAt: appliedAt ? new Date(appliedAt).toISOString() : null,
        salaryText: salaryText.trim() === '' ? null : salaryText.trim(),
        contactName: contactName.trim() === '' ? null : contactName.trim(),
        contactEmail: contactEmail.trim() === '' ? null : contactEmail.trim(),
      };
      const updated = await api.updateApplication(application.id, input);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save application');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Edit application
      </h2>

      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id="editApplicationTitle"
          label="Job title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextField
          id="editApplicationUrl"
          label="Application URL"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <TextField
          id="editApplicationDate"
          label="Applied date"
          type="date"
          value={appliedAt}
          onChange={(event) => setAppliedAt(event.target.value)}
        />
        <TextField
          id="editApplicationSalary"
          label="Salary"
          value={salaryText}
          onChange={(event) => setSalaryText(event.target.value)}
        />
        <TextField
          id="editApplicationContact"
          label="Contact name"
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
        />
        <TextField
          id="editApplicationContactEmail"
          label="Contact email"
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}