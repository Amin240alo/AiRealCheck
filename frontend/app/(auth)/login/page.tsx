'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { resolveAuthErrorKey } from '@/lib/utils';
import { API_BASE } from '@/lib/api';
import { useT } from '@/contexts/LanguageContext';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoggedIn, notice, clearNotice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useT();

  const oauthError = searchParams.get('oauth_error');

  React.useEffect(() => {
    if (isLoggedIn) router.replace('/analyze');
  }, [isLoggedIn, router]);

  React.useEffect(() => {
    if (notice?.message) {
      setError(notice.message);
      clearNotice();
    }
  }, [notice, clearNotice]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError(t('auth.login.missingFields')); return; }
    setError('');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.push('/analyze');
    } catch (err: unknown) {
      setError(t(resolveAuthErrorKey(err as Parameters<typeof resolveAuthErrorKey>[0], 'login')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md"
    >
      <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] p-10">
        <div className="mb-7">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-primary)] mb-2">AIRealCheck</div>
          <h2 className="text-[24px] font-bold text-[var(--color-text)]">{t('auth.login.title')}</h2>
          <p className="text-[14px] text-[var(--color-muted)] mt-1.5">{t('auth.login.subtitle')}</p>
        </div>

        {(error || oauthError) && (
          <div className="mb-5 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)] border-opacity-30 text-[var(--color-danger)] text-[13px]">
            {oauthError ? t('auth.login.oauthError') : error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{t('auth.login.emailLabel')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              required
              className="h-11 px-3.5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[14px] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{t('auth.login.passwordLabel')}</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('auth.login.passwordPh')}
                autoComplete="current-password"
                required
                className="w-full h-11 px-3.5 pr-11 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[14px] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[14px] font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
              </svg>
            )}
            {loading ? t('auth.login.submitting') : t('auth.login.submit')}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--color-border)]" />
          <span className="text-[12px] text-[var(--color-muted-2)]">{t('auth.login.or')}</span>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>

        <a
          href={`${API_BASE}/auth/google`}
          className="flex items-center justify-center gap-3 h-11 w-full rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[14px] font-medium hover:bg-[var(--color-surface-3)] transition-colors"
        >
          <svg viewBox="0 0 48 48" className="w-4 h-4 flex-shrink-0">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.74 1.23 9.26 3.65l6.94-6.94C36.28 2.59 30.5 0 24 0 14.7 0 6.71 5.38 2.83 13.22l8.06 6.26C12.62 12.1 17.85 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.61-.14-3.16-.4-4.66H24v9.02h12.66c-.55 2.94-2.17 5.43-4.63 7.12l7.43 5.77C43.93 37.5 46.5 31.5 46.5 24.5z"/>
            <path fill="#FBBC05" d="M10.89 28.52c-.48-1.44-.76-2.97-.76-4.52s.27-3.08.76-4.52l-8.06-6.26C.99 16.06 0 19.89 0 24s.99 7.94 2.83 11.78l8.06-6.26z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.14 15.9-5.81l-7.43-5.77c-2.07 1.39-4.72 2.22-8.47 2.22-6.15 0-11.38-2.6-14.87-6.98l-8.06 6.26C6.71 42.62 14.7 48 24 48z"/>
          </svg>
          {t('auth.login.withGoogle')}
        </a>

        <div className="mt-6 flex items-center justify-center gap-3 text-[13px] text-[var(--color-muted)]">
          <Link href="/forgot-password" className="hover:text-[var(--color-text)] transition-colors">{t('auth.login.forgotPassword')}</Link>
          <span>·</span>
          <Link href="/register" className="hover:text-[var(--color-text)] transition-colors">{t('auth.login.createAccount')}</Link>
        </div>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
