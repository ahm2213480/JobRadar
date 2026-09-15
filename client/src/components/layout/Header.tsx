import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import * as api from '../../api/client';
import { useAuth } from '../../context/auth-context';
import { Icon, type IconName } from '../ui/Icon';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const PRIMARY_NAV: NavItem[] = [
  { to: '/jobs', label: 'Jobs', icon: 'briefcase' },
  { to: '/applications', label: 'Applications', icon: 'clipboard-list' },
  { to: '/saved', label: 'Saved', icon: 'bookmark' },
  { to: '/cv', label: 'CV', icon: 'file-text' },
];

const SECONDARY_NAV: NavItem[] = [
  { to: '/skills', label: 'Skills', icon: 'target' },
  { to: '/profile', label: 'Profile', icon: 'user' },
  { to: '/settings', label: 'Preferences', icon: 'sliders' },
];

function desktopLinkClass({ isActive }: { isActive: boolean }): string {
  const base = 'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors';
  return isActive
    ? `${base} bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300`
    : `${base} text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100`;
}

function mobileLinkClass({ isActive }: { isActive: boolean }): string {
  const base = 'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium';
  return isActive
    ? `${base} bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300`
    : `${base} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`;
}

const ICON_BUTTON =
  'grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

export function Header() {
  const { user, initializing, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    async function fetchCount() {
      try {
        const result = await api.getUnreadNotificationCount();
        if (!cancelled) setUnreadCount(result.unread);
      } catch {
        // Non-critical — don't break the header.
      }
    }
    void fetchCount();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    navigate('/');
  }

  const allNav = [...PRIMARY_NAV, ...SECONDARY_NAV];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2 md:gap-6">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5"
            onClick={() => setMenuOpen(false)}
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white shadow-sm">
              <Icon name="radar" className="h-[18px] w-[18px]" />
            </span>
            <span className="text-base font-bold tracking-tight">JobRadar</span>
          </Link>

          {user && !initializing && (
            <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
              {PRIMARY_NAV.map((item) => (
                <NavLink key={item.to} to={item.to} className={desktopLinkClass}>
                  {item.label}
                </NavLink>
              ))}
              <span
                className="mx-1.5 h-5 w-px bg-slate-200 dark:bg-slate-700"
                aria-hidden="true"
              />
              {SECONDARY_NAV.map((item) => (
                <NavLink key={item.to} to={item.to} className={desktopLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {initializing ? null : user ? (
            <>
              <Link
                to="/notifications"
                aria-label={
                  unreadCount > 0
                    ? `Notifications, ${unreadCount} unread`
                    : 'Notifications'
                }
                className={`relative ${ICON_BUTTON}`}
              >
                <Icon name="bell" className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 grid min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                to="/account"
                className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 md:flex"
              >
                <Icon name="user" className="h-4 w-4" />
                {user.fullName.split(' ')[0]}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className={ICON_BUTTON}
                aria-label="Log out"
              >
                <Icon name="log-out" className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className={`${ICON_BUTTON} md:hidden`}
                aria-expanded={menuOpen}
                aria-label="Toggle navigation menu"
              >
                <Icon name={menuOpen ? 'x' : 'menu'} className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {user && !initializing && menuOpen && (
        <nav
          className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 dark:border-slate-800 dark:bg-slate-900 md:hidden"
          aria-label="Mobile navigation"
        >
          <div className="grid gap-1">
            {allNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={mobileLinkClass}
              >
                <Icon name={item.icon} className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
            <NavLink
              to="/account"
              onClick={() => setMenuOpen(false)}
              className={mobileLinkClass}
            >
              <Icon name="user" className="h-4 w-4" />
              Account
            </NavLink>
          </div>
        </nav>
      )}
    </header>
  );
}
