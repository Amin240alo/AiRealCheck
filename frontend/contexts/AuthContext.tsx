'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch, getToken, setToken, API_BASE } from '@/lib/api';
import type { User, Balance } from '@/lib/types';

interface AuthContextValue {
  token: string | null;
  user: User | null;
  balance: Balance | null;
  loading: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isEmailVerified: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, consent: boolean) => Promise<void>;
  logout: (reason?: string) => Promise<void>;
  fetchMe: () => Promise<User | null>;
  fetchBalance: () => Promise<Balance | null>;
  refreshBalance: () => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerify: () => Promise<void>;
  forgot: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  setAuthToken: (token: string) => void;
  notice: { message: string; tone: string } | null;
  clearNotice: () => void;
  setNotice: (message: string, tone?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const RETURN_KEY = 'airealcheck_return_to';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNoticeState] = useState<{ message: string; tone: string } | null>(null);
  const bootstrappedRef = useRef(false);

  const updateToken = useCallback((t: string | null) => {
    setToken(t);
    setTokenState(t);
  }, []);

  const setNotice = useCallback((message: string, tone = 'info') => {
    setNoticeState({ message, tone });
  }, []);

  const clearNotice = useCallback(() => {
    setNoticeState(null);
  }, []);

  const fetchBalance = useCallback(async (): Promise<Balance | null> => {
    const t = getToken();
    if (!t) return null;
    try {
      const data = await apiFetch<Balance & { credits_available: number }>('/api/credits', { token: t });
      const bal: Balance = {
        plan_type: data.plan_type,
        subscription_active: data.subscription_active,
        credits_total: data.credits_total,
        credits_used: data.credits_used,
        credits_available: data.credits_available,
        last_credit_reset: data.last_credit_reset,
      };
      setBalance(bal);
      return bal;
    } catch {
      return null;
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  const fetchMe = useCallback(async (): Promise<User | null> => {
    const t = getToken();
    if (!t) return null;
    try {
      const data = await apiFetch<{ user: User }>('/auth/me', { token: t });
      setUser(data.user || null);
      return data.user || null;
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e?.status === 401 || e?.status === 403) {
        updateToken(null);
        setUser(null);
        setBalance(null);
      }
      return null;
    }
  }, [updateToken]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (!data?.token) throw new Error('login_failed');
    updateToken(data.token);
    setUser(data.user || null);
    await fetchBalance();
  }, [updateToken, fetchBalance]);

  const register = useCallback(async (email: string, password: string, displayName: string, consent: boolean) => {
    await apiFetch('/auth/register', {
      method: 'POST',
      body: { email, password, display_name: displayName, consent_terms: consent },
    });
  }, []);

  const logout = useCallback(async (reason?: string) => {
    try {
      await apiFetch('/auth/logout', { method: 'POST', token: getToken() });
    } catch { /* ignore */ }
    updateToken(null);
    setUser(null);
    setBalance(null);
    if (reason) setNotice(reason, 'info');
  }, [updateToken, setNotice]);

  const verifyEmail = useCallback(async (t: string) => {
    await apiFetch('/auth/verify', { method: 'POST', body: { token: t } });
  }, []);

  const resendVerify = useCallback(async () => {
    await apiFetch('/auth/resend-verify', { method: 'POST', token: getToken() });
  }, []);

  const forgot = useCallback(async (email: string) => {
    await apiFetch('/auth/forgot', { method: 'POST', body: { email } });
  }, []);

  const resetPassword = useCallback(async (t: string, password: string) => {
    await apiFetch('/auth/reset', { method: 'POST', body: { token: t, password } });
  }, []);

  const setAuthToken = useCallback((t: string) => {
    updateToken(t);
  }, [updateToken]);

  // Bootstrap on mount
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const stored = getToken();
    if (!stored) {
      setLoading(false);
      return;
    }

    setTokenState(stored);

    (async () => {
      try {
        // Try refresh first
        const refreshData = await apiFetch<{ token: string; user: User }>('/auth/refresh', {
          method: 'POST',
          token: stored,
        });
        if (refreshData?.token) {
          updateToken(refreshData.token);
          setUser(refreshData.user || null);
          await fetchBalance();
          setLoading(false);
          return;
        }
      } catch { /* fall through to fetchMe */ }

      try {
        const me = await fetchMe();
        if (me) await fetchBalance();
      } catch { /* session expired */ }

      setLoading(false);
    })();
  }, [updateToken, fetchMe, fetchBalance]);

  const value: AuthContextValue = {
    token,
    user,
    balance,
    loading,
    isLoggedIn: !!token,
    isAdmin: !!user?.is_admin,
    isEmailVerified: !!user?.email_verified,
    login,
    register,
    logout,
    fetchMe,
    fetchBalance,
    refreshBalance,
    verifyEmail,
    resendVerify,
    forgot,
    resetPassword,
    setAuthToken,
    notice,
    clearNotice,
    setNotice,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function saveReturnPath(path: string): void {
  try {
    sessionStorage.setItem(RETURN_KEY, path);
  } catch { /* ignore */ }
}

export function consumeReturnPath(): string {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY) || '/analyze';
    sessionStorage.removeItem(RETURN_KEY);
    const pathOnly = raw.split('?')[0];
    if (!pathOnly.startsWith('/')) return '/analyze';
    if (['/login', '/auth/callback'].includes(pathOnly)) return '/analyze';
    return raw;
  } catch {
    return '/analyze';
  }
}

export { API_BASE };
