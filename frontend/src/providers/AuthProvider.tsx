import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import type { User } from '../types/auth';

/* ────────────────────────────────────────────────────
   Auth Context — token lifecycle, user state, RBAC & persistence
   ──────────────────────────────────────────────────── */

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
const USER_KEY = 'auth_user';

function getInitialUser(): User | null {
  try {
    const cached = localStorage.getItem(USER_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialToken = localStorage.getItem(TOKEN_KEY);
  const initialUser = getInitialUser();

  const [state, setState] = useState<AuthState>({
    user: initialUser,
    isAuthenticated: !!(initialToken && initialUser),
    isLoading: !!initialToken && !initialUser,
  });

  /* ── Bootstrap & Sync: Validate existing session with backend ── */
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      localStorage.removeItem(USER_KEY);
      setState({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const user = await apiClient.get<User>('/auth/me');
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      setState({ user, isAuthenticated: true, isLoading: false });
    } catch {
      // If token expired and refresh failed, clear local session
      const currentToken = localStorage.getItem(TOKEN_KEY);
      if (!currentToken) {
        localStorage.removeItem(USER_KEY);
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  /* ── Login ── */
  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<{ access_token: string; refresh_token: string; token_type: string }>('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, res.access_token);
    if (res.refresh_token) {
      localStorage.setItem(REFRESH_KEY, res.refresh_token);
    }
    const user = await apiClient.get<User>('/auth/me');
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  /* ── Logout ── */
  const logout = useCallback(() => {
    apiClient.post('/auth/logout').catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  /* ── Manual user update (e.g. after profile edit) ── */
  const setUser = useCallback((user: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState((prev) => ({ ...prev, user }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, setUser, refreshUser }),
    [state, login, logout, setUser, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
