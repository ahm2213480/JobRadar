import { useEffect, useState, type FormEvent } from 'react';
import { fetchProfileBundle, updateProfile } from '../api/client';
import { CompletionCard } from '../components/profile/CompletionCard';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { TextareaField } from '../components/ui/TextareaField';
import { useAuth } from '../context/auth-context';
import type { ProfileBundle, UserProfileData } from '../types/profile';

const EMPTY_FORM: UserProfileData = {
  headline: '',
  summary: '',
  location: '',
  phone: '',
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  yearsOfExperience: null,
  currentTitle: '',
};

export function ProfilePage() {
  const { user } = useAuth();
  const [bundle, setBundle] = useState<ProfileBundle | null>(null);
  const [form, setForm] = useState<UserProfileData>(EMPTY_FORM);
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
        setForm({ ...EMPTY_FORM, ...(data.profile ?? {}) });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load profile');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField<K extends keyof UserProfileData>(
    key: K,
    value: UserProfileData[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const data = await updateProfile({
        headline: form.headline,
        summary: form.summary,
        location: form.location,
        phone: form.phone,
        linkedinUrl: form.linkedinUrl,
        githubUrl: form.githubUrl,
        portfolioUrl: form.portfolioUrl,
        yearsOfExperience: form.yearsOfExperience ?? null,
        currentTitle: form.currentTitle,
      });
      setBundle(data);
      setForm({ ...EMPTY_FORM, ...(data.profile ?? {}) });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="py-16 text-center text-slate-500 dark:text-slate-400">
        Loading profile…
      </p>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My profile</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          The richer your profile, the smarter your job matches will be.
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
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          Profile saved ✓
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="currentTitle"
            label="Current job title"
            type="text"
            maxLength={120}
            placeholder="e.g. Junior Full Stack Developer"
            value={form.currentTitle ?? ''}
            onChange={(event) => updateField('currentTitle', event.target.value)}
          />
          <TextField
            id="yearsOfExperience"
            label="Years of experience"
            type="number"
            min={0}
            max={50}
            placeholder="e.g. 2"
            value={form.yearsOfExperience ?? ''}
            onChange={(event) =>
              updateField(
                'yearsOfExperience',
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
          />
        </div>

        <TextField
          id="headline"
          label="Professional headline"
          type="text"
          maxLength={120}
          placeholder="One line that describes you professionally"
          value={form.headline ?? ''}
          onChange={(event) => updateField('headline', event.target.value)}
        />

        <TextareaField
          id="summary"
          label="Professional summary"
          rows={4}
          maxLength={2000}
          placeholder="A short paragraph about your experience, specialties and what you are looking for."
          value={form.summary ?? ''}
          onChange={(event) => updateField('summary', event.target.value)}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="location"
            label="Location"
            type="text"
            maxLength={120}
            placeholder="e.g. Amman, Jordan"
            value={form.location ?? ''}
            onChange={(event) => updateField('location', event.target.value)}
          />
          <TextField
            id="phone"
            label="Phone number"
            type="tel"
            maxLength={30}
            placeholder="+962 ..."
            value={form.phone ?? ''}
            onChange={(event) => updateField('phone', event.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="linkedinUrl"
            label="LinkedIn URL"
            type="url"
            placeholder="https://linkedin.com/in/you"
            value={form.linkedinUrl ?? ''}
            onChange={(event) => updateField('linkedinUrl', event.target.value)}
          />
          <TextField
            id="githubUrl"
            label="GitHub URL"
            type="url"
            placeholder="https://github.com/you"
            value={form.githubUrl ?? ''}
            onChange={(event) => updateField('githubUrl', event.target.value)}
          />
        </div>

        <TextField
          id="portfolioUrl"
          label="Portfolio / website URL"
          type="url"
          placeholder="https://your-portfolio.com"
          value={form.portfolioUrl ?? ''}
          onChange={(event) => updateField('portfolioUrl', event.target.value)}
        />

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Signed in as {user?.email}
          </p>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </form>
    </section>
  );
}
