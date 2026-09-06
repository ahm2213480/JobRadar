import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(fullName, email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the account');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        Start matching with jobs that fit your skills.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <TextField
          id="fullName"
          label="Full name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={100}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          At least 8 characters, with one letter and one number.
        </p>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Log in
        </Link>
      </p>
    </section>
  );
}
