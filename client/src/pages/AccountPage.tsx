import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

/**
 * Minimal protected page: proves the end-to-end auth flow (requireAuth on the
 * server + route guard on the client) with the user's real session data, and
 * links to the profile/preferences pages introduced in Phase 2.
 */
export function AccountPage() {
  const { user } = useAuth();
  if (!user) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">My account</h1>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/profile"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Edit profile
        </Link>
        <Link
          to="/settings"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Job preferences
        </Link>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Name
            </dt>
            <dd className="font-medium">{user.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Email
            </dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Role
            </dt>
            <dd className="font-medium">{user.role}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Member since
            </dt>
            <dd className="font-medium">
              {new Date(user.createdAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
