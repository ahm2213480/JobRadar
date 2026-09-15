import { useEffect, useState, type FormEvent } from 'react';
import { fetchProfileBundle, updatePreferences } from '../api/client';
import { CompletionCard } from '../components/profile/CompletionCard';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { SelectField } from '../components/ui/SelectField';
import { TagInput } from '../components/ui/TagInput';
import { TextField } from '../components/ui/TextField';
import { DEFAULT_PREFERENCES } from '../types/profile';
import type { ProfileBundle } from '../types/profile';
import type { ExperienceLevel, PreferencesData, WorkMode } from '../types/profile';

const WORK_MODE_OPTIONS: Array<{ value: WorkMode; label: string }> = [
  { value: 'UNKNOWN', label: 'Any (no preference)' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ONSITE', label: 'On-site' },
];

const EXPERIENCE_LEVEL_OPTIONS: Array<{ value: ExperienceLevel; label: string }> = [
  { value: 'UNKNOWN', label: 'Any level' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'ENTRY', label: 'Entry level' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'MID_LEVEL', label: 'Mid-level' },
  { value: 'SENIOR', label: 'Senior' },
  { value: 'LEAD', label: 'Lead / Principal' },
];

export function SettingsPage() {
  const [bundle, setBundle] = useState<ProfileBundle | null>(null);
  const [prefs, setPrefs] = useState<PreferencesData>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchProfileBundle();
        if (cancelled) return;
        setBundle(data);
        setPrefs({ ...DEFAULT_PREFERENCES, ...(data.preferences ?? {}) });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load settings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof PreferencesData>(key: K, value: PreferencesData[K]) {
    setPrefs((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const data = await updatePreferences(prefs);
      setBundle(data);
      setPrefs({ ...DEFAULT_PREFERENCES, ...(data.preferences ?? {}) });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="py-16 text-center text-slate-500 dark:text-slate-400">
        Loading settings…
      </p>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Job preferences</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Tell us what you are looking for. These settings shape your future job
          matches and notifications.
        </p>
      </div>

      {bundle && <CompletionCard completion={bundle.completion} />}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </div>
      )}
      {saved && !error && (
        <div
          role="status"
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <Icon name="check-circle" className="h-4 w-4" />
          Preferences saved
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <TagInput
          id="desiredTitles"
          label="Desired job titles"
          values={prefs.desiredTitles}
          onChange={(values) => update('desiredTitles', values)}
          placeholder="e.g. Backend Developer ⏎"
          max={10}
        />

        <TagInput
          id="preferredLocations"
          label="Preferred locations"
          values={prefs.preferredLocations}
          onChange={(values) => update('preferredLocations', values)}
          placeholder="e.g. Amman, Remote-EU ⏎"
          max={10}
        />

        <TagInput
          id="preferredTechnologies"
          label="Preferred technologies"
          values={prefs.preferredTechnologies}
          onChange={(values) => update('preferredTechnologies', values)}
          placeholder="e.g. React, Node.js, PostgreSQL ⏎"
          max={20}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            id="workMode"
            label="Preferred work mode"
            options={WORK_MODE_OPTIONS}
            value={prefs.workMode}
            onChange={(event) => update('workMode', event.target.value as WorkMode)}
          />
          <SelectField
            id="experienceLevel"
            label="Experience level you are targeting"
            options={EXPERIENCE_LEVEL_OPTIONS}
            value={prefs.experienceLevel}
            onChange={(event) =>
              update('experienceLevel', event.target.value as ExperienceLevel)
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField
            id="salaryMin"
            label="Minimum salary"
            type="number"
            min={0}
            placeholder="e.g. 800"
            value={prefs.salaryMin ?? ''}
            onChange={(event) =>
              update(
                'salaryMin',
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
          />
          <TextField
            id="salaryMax"
            label="Expected salary"
            type="number"
            min={0}
            placeholder="e.g. 1500"
            value={prefs.salaryMax ?? ''}
            onChange={(event) =>
              update(
                'salaryMax',
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
          />
          <TextField
            id="salaryCurrency"
            label="Currency"
            type="text"
            maxLength={3}
            placeholder="USD"
            value={prefs.salaryCurrency ?? ''}
            onChange={(event) => update('salaryCurrency', event.target.value.toUpperCase())}
          />
        </div>

        <div className="space-y-2 pt-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={prefs.remoteOnly}
              onChange={(event) => update('remoteOnly', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-800"
            />
            Remote only — hide everything that is not remote
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={prefs.emailNotifications}
              onChange={(event) => update('emailNotifications', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-800"
            />
            Email me about new high matches (email sending arrives in a later phase)
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save preferences'}
          </Button>
        </div>
      </form>
    </section>
  );
}
