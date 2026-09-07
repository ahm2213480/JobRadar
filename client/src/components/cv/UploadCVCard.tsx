import { useRef, useState } from 'react';
import * as api from '../../api/client';
import type { CvRecord } from '../../types/cv';
import { Button } from '../ui/Button';

const MAX_SIZE_MB = 5;

export function UploadCVCard({ onUploaded }: { onUploaded: (cv: CvRecord) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(f: File): string | null {
    if (!/\.(pdf|docx)$/i.test(f.name)) {
      return 'Only PDF and DOCX files are supported.';
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File is too large — maximum size is ${MAX_SIZE_MB} MB.`;
    }
    return null;
  }

  async function handleUpload() {
    if (!file) return;
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const cv = await api.uploadCv(file);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded(cv);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Upload a CV
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        PDF or DOCX, up to {MAX_SIZE_MB} MB. The text is extracted automatically,
        then analyzed to discover your skills and enrich your profile.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id="cvFile"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full max-w-sm cursor-pointer text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-400 dark:file:bg-slate-800 dark:file:text-slate-200 dark:hover:file:bg-slate-700"
        />
        <Button onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? 'Uploading…' : 'Upload CV'}
        </Button>
      </div>

      {file && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Selected: {file.name} ({(file.size / 1024).toFixed(0)} KB)
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}