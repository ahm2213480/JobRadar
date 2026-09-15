import { useCallback, useEffect, useState } from 'react';
import * as api from '../../api/client';
import type { ApplicationNote } from '../../types/application';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { TextareaField } from '../ui/TextareaField';

export function NotesSection({ applicationId }: { applicationId: string }) {
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNotes(await api.listApplicationNotes(applicationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  async function handleAdd() {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      const note = await api.addApplicationNote(applicationId, { body: text });
      // Newest-first, matching the API ordering.
      setNotes((prev) => [note, ...prev]);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(note: ApplicationNote) {
    if (!window.confirm('Delete this note?')) return;
    setError(null);
    try {
      await api.deleteApplicationNote(applicationId, note.id);
      setNotes((prev) => prev.filter((entry) => entry.id !== note.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Notes
      </h2>

      {error && notes.length === 0 && (
        <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {error}{' '}
          <button type="button" onClick={() => void fetchNotes()} className="font-medium underline">
            Try again
          </button>
        </p>
      )}

      <div className="mt-3 space-y-3">
        <TextareaField
          id="newNoteBody"
          label="New note"
          rows={3}
          maxLength={5000}
          placeholder="e.g. Talked to recruiter — they expect a decision by Friday."
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <Button onClick={() => void handleAdd()} disabled={saving || body.trim().length === 0}>
          {saving ? 'Saving…' : 'Add note'}
        </Button>
      </div>

      {error && notes.length > 0 && (
        <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading notes…
          </p>
        ) : notes.length === 0 && !error ? (
          <EmptyState
            icon="note"
            title="No notes yet"
            message="Add notes to remember details about this application."
          />
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                {note.body}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {new Date(note.createdAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDelete(note)}
                  className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}