'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { resolveAuthErrorKey } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { resetPassword } = useAuth();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const { t } = useT();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { setError(t('auth.reset.missingToken')); return; }
    if (!password || password.length < 8) { setError(t('auth.reset.minLength')); return; }
    if (password !== confirm) { setError(t('auth.reset.passwordMismatch')); return; }
    setError(''); setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      setError(t(resolveAuthErrorKey(err as Parameters<typeof resolveAuthErrorKey>[0], 'reset')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm">
      <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] p-8">
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-primary)] mb-1">{t('auth.reset.badge')}</div>
          <h2 className="text-[22px] font-bold text-[var(--color-text)]">{t('auth.reset.title')}</h2>
          <p className="text-[13px] text-[var(--color-muted)] mt-1">{t('auth.reset.subtitle')}</p>
        </div>
        {done ? (
          <div className="text-center">
            <CheckCircle className="mx-auto mb-3 text-[var(--color-success)]" size={36} />
            <p className="text-[14px] text-[var(--color-text)] mb-4">{t('auth.reset.doneText')}</p>
            <button onClick={() => router.push('/login')}
              className="inline-flex items-center justify-center h-10 px-6 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:bg-[var(--color-primary-hover)] transition-colors">
              {t('auth.reset.toLoginBtn')}
            </button>
          </div>
        ) : (
          <>
            {error && <div className="mb-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)] border-opacity-30 text-[var(--color-danger)] text-[13px]">{error}</div>}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {[
                { id: 'password', value: password, onChange: setPassword, show: showPw, onToggle: () => setShowPw(!showPw), label: t('auth.reset.passwordLabel'), ac: 'new-password' },
                { id: 'confirm', value: confirm, onChange: setConfirm, show: showPw, onToggle: () => setShowPw(!showPw), label: t('auth.reset.confirmLabel'), ac: 'new-password' },
              ].map(f => (
                <div key={f.id} className="flex flex-col gap-1.5">
                  <label htmlFor={f.id} className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{f.label}</label>
                  <div className="relative">
                    <input id={f.id} type={f.show ? 'text' : 'password'} value={f.value} onChange={e => f.onChange(e.target.value)}
                      placeholder={t('auth.reset.placeholder')} autoComplete={f.ac} required
                      className="w-full h-10 px-3 pr-10 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[13px] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors" />
                    <button type="button" onClick={f.onToggle} tabIndex={-1}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-text)]">
                      {f.show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ))}
              <button type="submit" disabled={loading}
                className="h-10 w-full rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {loading && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>}
                {loading ? t('auth.reset.submitting') : t('auth.reset.submit')}
              </button>
            </form>
          </>
        )}
        <div className="mt-5 text-center">
          <Link href="/login" className="text-[12px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">{t('auth.reset.backToLogin')}</Link>
        </div>
      </div>
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
