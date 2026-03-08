'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { resolveAuthError } from '@/lib/utils';
import { API_BASE } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const { register, login, isLoggedIn } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [consent, setConsent] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  React.useEffect(() => {
    if (isLoggedIn) router.replace('/analyze');
  }, [isLoggedIn, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Bitte deinen Namen eingeben.'); return; }
    if (!email || !password || password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return; }
    if (password !== confirm) { setError('Passwörter stimmen nicht überein.'); return; }
    if (!consent) { setError('Bitte AGB und Datenschutz akzeptieren.'); return; }
    setError(''); setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password, name.trim(), consent);
      try {
        await login(email.trim().toLowerCase(), password);
        router.push('/analyze');
        return;
      } catch {
        setRegisteredEmail(email.trim().toLowerCase());
        setRegistered(true);
      }
    } catch (err: unknown) {
      setError(resolveAuthError(err as Parameters<typeof resolveAuthError>[0], 'register'));
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm">
        <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] p-8 text-center">
          <CheckCircle className="mx-auto mb-3 text-[var(--color-success)]" size={40} />
          <h2 className="text-[20px] font-bold text-[var(--color-text)] mb-2">Bitte E-Mail bestätigen</h2>
          <p className="text-[13px] text-[var(--color-muted)] mb-6">
            Wir haben den Bestätigungslink an <strong>{registeredEmail}</strong> geschickt. Schau auch in deinen Spam-Ordner.
          </p>
          <Link href="/login" className="inline-flex items-center justify-center h-10 px-6 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:bg-[var(--color-primary-hover)] transition-colors">
            Zum Login
          </Link>
        </div>
      </motion.div>
    );
  }

  const PwField = ({ value, onChange, show, onToggle, id, placeholder, label, autoComplete }: {
    value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
    id: string; placeholder: string; label: string; autoComplete: string;
  }) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} autoComplete={autoComplete} required
          className="w-full h-10 px-3 pr-10 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[13px] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors" />
        <button type="button" onClick={onToggle} tabIndex={-1}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-text)]">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm">
      <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] p-8">
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-primary)] mb-1">AIRealCheck</div>
          <h2 className="text-[22px] font-bold text-[var(--color-text)]">Account erstellen</h2>
          <p className="text-[13px] text-[var(--color-muted)] mt-1">Starte kostenlos mit 100 Credits.</p>
        </div>
        {error && (
          <div className="mb-4 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)] border-opacity-30 text-[var(--color-danger)] text-[13px]">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Name</label>
            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Vor- und Nachname" autoComplete="name" required
              className="h-10 px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[13px] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">E-Mail</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" required
              className="h-10 px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[13px] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors" />
          </div>
          <PwField value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw(!showPw)} id="password" placeholder="Mindestens 8 Zeichen" label="Passwort" autoComplete="new-password" />
          <PwField value={confirm} onChange={setConfirm} show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} id="confirm" placeholder="Passwort erneut eingeben" label="Passwort bestätigen" autoComplete="new-password" />
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 rounded accent-[var(--color-primary)]" required />
            <span className="text-[12px] text-[var(--color-muted)]">
              Ich akzeptiere die{' '}
              <Link href="/legal?section=tac" className="text-[var(--color-primary)] hover:underline">AGB</Link>
              {' '}und die{' '}
              <Link href="/legal?section=privacy" className="text-[var(--color-primary)] hover:underline">Datenschutzerklärung</Link>.
            </span>
          </label>
          <button type="submit" disabled={loading}
            className="h-10 w-full rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>}
            {loading ? 'Registrieren…' : 'Registrieren'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--color-border)]" />
          <span className="text-[11px] text-[var(--color-muted-2)]">oder</span>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>
        <a href={`${API_BASE}/auth/google`}
          className="flex items-center justify-center gap-3 h-10 w-full rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[13px] font-medium hover:bg-[var(--color-surface-3)] transition-colors">
          <svg viewBox="0 0 48 48" className="w-4 h-4 flex-shrink-0"><path fill="#EA4335" d="M24 9.5c3.54 0 6.74 1.23 9.26 3.65l6.94-6.94C36.28 2.59 30.5 0 24 0 14.7 0 6.71 5.38 2.83 13.22l8.06 6.26C12.62 12.1 17.85 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.61-.14-3.16-.4-4.66H24v9.02h12.66c-.55 2.94-2.17 5.43-4.63 7.12l7.43 5.77C43.93 37.5 46.5 31.5 46.5 24.5z"/><path fill="#FBBC05" d="M10.89 28.52c-.48-1.44-.76-2.97-.76-4.52s.27-3.08.76-4.52l-8.06-6.26C.99 16.06 0 19.89 0 24s.99 7.94 2.83 11.78l8.06-6.26z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.14 15.9-5.81l-7.43-5.77c-2.07 1.39-4.72 2.22-8.47 2.22-6.15 0-11.38-2.6-14.87-6.98l-8.06 6.26C6.71 42.62 14.7 48 24 48z"/></svg>
          Mit Google anmelden
        </a>
        <div className="mt-5 flex items-center justify-center gap-2 text-[12px] text-[var(--color-muted)]">
          <span>Bereits registriert?</span>
          <Link href="/login" className="text-[var(--color-primary)] hover:underline">Zum Login</Link>
        </div>
      </div>
    </motion.div>
  );
}
