import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/auth-context';

/**
 * Wraps routes that require an authenticated session. While the session is
 * still being restored, renders a neutral loading state instead of bouncing
 * the user to /login.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <p className="py-16 text-center text-slate-500 dark:text-slate-400">
        Loading…
      </p>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
