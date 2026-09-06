import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as api from '../api/client';
import type { AuthUser } from '../types/auth';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  // On load: try to silently restore the session from the refresh cookie.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const refreshed = await api.refreshSession();
      if (!refreshed) {
        if (!cancelled) setInitializing(false);
        return;
      }
      try {
        const me = await api.fetchCurrentUser();
        if (!cancelled) setUser(me);
      } catch {
        api.setAccessToken(null);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login({ email, password });
    api.setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    const data = await api.register({ fullName, email, password });
    api.setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, register, logout }),
    [user, initializing, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
