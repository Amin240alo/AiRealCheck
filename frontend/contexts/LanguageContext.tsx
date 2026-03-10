'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { type Locale, DEFAULT_LANG, SUPPORTED_LANGS, translations, resolveTKey } from '@/lib/i18n';
import { apiFetch, getToken } from '@/lib/api';

const LANG_KEY = 'airealcheck_lang';

interface LanguageContextValue {
  lang: Locale;
  setLang: (lang: Locale) => void;
  t: (key: string) => string;
  /** For translation values that are functions: tf('layout.creditsAvailable', 42) */
  tf: <T extends unknown[]>(key: string, ...args: T) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLang(): Locale {
  try {
    const stored = localStorage.getItem(LANG_KEY) as Locale | null;
    if (stored && SUPPORTED_LANGS.some((l) => l.value === stored)) return stored;
  } catch { /* SSR */ }
  return DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Locale>(DEFAULT_LANG);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setLangState(readStoredLang());
  }, []);

  // Keep <html lang="…"> in sync
  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch { /* SSR */ }
  }, [lang]);

  const setLang = useCallback((next: Locale) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch { /* private browsing */ }
    // Persist to backend if logged in (fire-and-forget)
    const token = getToken();
    if (token) {
      apiFetch('/auth/language', {
        method: 'PATCH',
        token,
        body: { language: next },
      }).catch(() => { /* ignore network errors */ });
    }
  }, []);

  const t = useCallback((key: string): string => resolveTKey(lang, key), [lang]);

  const tf = useCallback(<T extends unknown[]>(key: string, ...args: T): string => {
    const dict = translations[lang] ?? translations[DEFAULT_LANG];
    const fallback = translations[DEFAULT_LANG];
    const parts = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let val: any = dict;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fb: any = fallback;
    for (const p of parts) {
      val = val?.[p];
      fb = fb?.[p];
    }
    const fn = typeof val === 'function' ? val : typeof fb === 'function' ? fb : null;
    if (fn) return fn(...args);
    if (typeof val === 'string') return val;
    if (typeof fb === 'string') return fb;
    return key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tf }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): Locale {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx.lang;
}

export function useSetLang(): (lang: Locale) => void {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useSetLang must be used within LanguageProvider');
  return ctx.setLang;
}

/** Returns { lang, setLang, t, tf } */
export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useT must be used within LanguageProvider');
  return ctx;
}

/** Restore language from a user object returned by /auth/me */
export function restoreLangFromUser(language: string | null | undefined): void {
  if (!language) return;
  const valid = SUPPORTED_LANGS.some((l) => l.value === language);
  if (!valid) return;
  try {
    localStorage.setItem(LANG_KEY, language);
  } catch { /* ignore */ }
}
