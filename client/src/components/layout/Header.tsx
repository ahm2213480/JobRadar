import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { Button } from '../ui/Button';

export function Header() {
  const { user, initializing, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">
            📡
          </span>
          <span className="text-lg font-semibold tracking-tight">JobRadar</span>
        </Link>
        <div className="flex items-center gap-2">
          {initializing ? null : user ? (
            <>
              <nav className="flex items-center gap-4">
                <Link
                  to="/jobs"
                  className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-200"
                >
                  Jobs
                </Link>
                <Link
                  to="/cv"
                  className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-200"
                >
                  CV
                </Link>
                <Link
                  to="/profile"
                  className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-200"
                >
                  Profile
                </Link>
                <Link
                  to="/settings"
                  className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-200"
                >
                  Preferences
                </Link>
                <Link
                  to="/account"
                  className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-200"
                >
                  Hi, {user.fullName.split(' ')[0]}
                </Link>
              </nav>
              <Button variant="ghost" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-200"
              >
                Log in
              </Link>
              <Button onClick={() => navigate('/register')}>Sign up</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
