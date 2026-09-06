import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-bold tracking-tight">404</h1>
      <p className="text-slate-600 dark:text-slate-400">
        The page you are looking for does not exist.
      </p>
      <Link
        to="/"
        className="inline-block font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        Back to home
      </Link>
    </section>
  );
}
