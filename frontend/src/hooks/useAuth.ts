'use client';

import { useCallback, useEffect } from 'react';
import { api, setAccessToken } from '@/lib/api';
import { useAuthStore, type AuthUser } from '@/stores/auth';

interface SessionResponse {
  data: { user: AuthUser; accessToken: string };
}

/**
 * Auth surface for the customer app. `bootstrap` runs once on mount: it tries a
 * silent refresh (HttpOnly cookie) and, if that yields a token, loads the user.
 */
export function useAuth() {
  const { user, status, setUser, setStatus } = useAuthStore();

  const bootstrap = useCallback(async () => {
    // Only attempt to refresh if we have a session indicator to avoid console errors
    const hasSession = typeof window !== 'undefined' && localStorage.getItem('has_session') === 'true';
    if (!hasSession) {
      setAccessToken(null);
      setUser(null);
      return;
    }

    try {
      const refresh = await api.post<{ data: { accessToken: string } }>('/auth/refresh');
      setAccessToken(refresh.data.data.accessToken);
      const me = await api.get<{ data: { user: AuthUser } }>('/auth/me');
      setUser(me.data.data.user);
    } catch {
      setAccessToken(null);
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('has_session');
      }
    }
  }, [setUser]);

  const login = useCallback(
    async (email: string, password: string, secretCode?: string) => {
      const res = await api.post<SessionResponse>('/auth/login', { email, password, secretCode });
      setAccessToken(res.data.data.accessToken);
      setUser(res.data.data.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('has_session', 'true');
      }
      return res.data.data.user;
    },
    [setUser],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const res = await api.post<SessionResponse>('/auth/google', { idToken });
      setAccessToken(res.data.data.accessToken);
      setUser(res.data.data.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('has_session', 'true');
      }
      return res.data.data.user;
    },
    [setUser],
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string; phone?: string }) => {
      await api.post('/auth/register', input);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('has_session');
      }
    }
  }, [setUser]);

  return { user, status, setStatus, bootstrap, login, loginWithGoogle, register, logout };
}

/** Mount-once bootstrap, used by the top-level AuthProvider. */
export function useAuthBootstrap() {
  const { bootstrap } = useAuth();
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
}
