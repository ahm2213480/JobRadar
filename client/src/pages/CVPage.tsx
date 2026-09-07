import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import { CVCard } from '../components/cv/CVCard';
import { UploadCVCard } from '../components/cv/UploadCVCard';
import type { CvAnalysisResult, CvRecord } from '../types/cv';
import { AnalysisPanel } from '../components/cv/AnalysisPanel';

export function CVPage() {
  const [cvs, setCvs] = useState<CvRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CvAnalysisResult | null>(null);

  const refresh = useCallback(async () => {
    setCvs(await api.listCvs());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listCvs();
        if (!cancelled) setCvs(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load CVs');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runAction<T extends () => Promise<unknown>>(action: T, next: () => void) {
    setError(null);
    try {
      await action();
      next();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  function handleUploaded(uploaded: CvRecord) {
    setAnalysis(null);
    setCvs((current) => [uploaded, ...current.filter((cv) => cv.id !== uploaded.id)]);
  }

  async function handleAnalyze(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const result = await api.analyzeCv(id);
      setAnalysis(result);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSetPrimary(id: string) {
    setBusyId(id);
    await runAction(() => api.setPrimaryCv(id), () => refresh());
    setBusyId(null);
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    await runAction(() => api.deleteCv(id), () => refresh());
    setBusyId(null);
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My CV</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Upload your resume once — JobRadar extracts your skills and keeps
          your profile up to date automatically.
        </p>
      </div>

      <UploadCVCard onUploaded={handleUploaded} />

      {analysis && <AnalysisPanel analysis={analysis} />}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Your uploads
        </h2>
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading CVs…
          </p>
        ) : cvs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No CVs yet — upload your first resume above.
          </p>
        ) : (
          <ul className="space-y-3">
            {cvs.map((cv) => (
              <CVCard
                key={cv.id}
                cv={cv}
                busy={busyId === cv.id}
                onAnalyze={handleAnalyze}
                onSetPrimary={handleSetPrimary}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}