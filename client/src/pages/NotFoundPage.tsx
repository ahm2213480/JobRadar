import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';

export function NotFoundPage() {
  return (
    <section className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon name="search" className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">404</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        The page you are looking for does not exist.
      </p>
      <Link
        to="/"
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        <Icon name="arrow-left" className="h-4 w-4" />
        Back to home
      </Link>
    </section>
  );
}

