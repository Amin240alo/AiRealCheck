'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { resolveAuthError } from '@/lib/utils';

export default function ForgotPasswordPage() {
  const { forgot } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError('Bitte E-Mail eingeben.'); return; }
    setError(''); setLoading(true);
    try {
      await forgot(email.trim().toLowerCase());
      setSent(true);
    } catch (err: unknown) {
      setError(resolveAuthError(err as Parameters<typeof resolveAuthError>[0], 'forgot'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm">
      <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] p-8">
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-primary)] mb-1">Passwort zurücksetzen</div>
          <h2 className="text-[22px] font-bold text-[var(--color-text)]">Link anfordern</h2>
          <p className="text-[13px] text-[var(--color-muted)] mt-1">Wir senden dir einen Reset-Link, falls ein Konto existiert.</p>
        </div>
        {sent ? (
          <div className="text-center">
            <CheckCircle className="mx-auto mb-3 text-[var(--color-success)]" size={36} />
            <p className="text-[14px] text-[var(--color-text)] mb-2">E-Mail wurde gesendet</p>
            <p className="text-[12px] text-[var(--color-muted)] mb-6">Schau auch in deinen Spam-Ordner, falls sie nicht innerhalb von 1–2 Minuten ankommt.</p>
          </div>
        ) : (
          <>
            {error && <div className="mb-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)] border-opacity-30 text-[var(--color-danger)] text-[13px]">{error}</div>}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">E-Mail</label>
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" required
                  className="h-10 px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[13px] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors" />
              </div>
              <button type="submit" disabled={loading}
                className="h-10 w-full rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {loading && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>}
                {loading ? 'Senden…' : 'Reset-Link senden'}
              </button>
            </form>
          </>
        )}
        <div className="mt-5 text-center">
          <Link href="/login" className="text-[12px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">← Zurück zum Login</Link>
        </div>
      </div>
    </motion.div>
  );
}
