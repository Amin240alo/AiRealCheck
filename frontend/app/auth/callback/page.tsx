'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useAuth, consumeReturnPath } from '@/contexts/AuthContext';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { setAuthToken, fetchMe, fetchBalance } = useAuth();
  const [state, setState] = React.useState<'loading' | 'success' | 'error'>('loading');
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const hash = window.location.hash || '';
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const token = (params.get('token') || '').trim();

    // Clear hash from URL
    try { history.replaceState({}, '', window.location.pathname + window.location.search); } catch { /* ignore */ }

    if (!token) {
      setState('error');
      setTimeout(() => router.push('/login?oauth_error=1'), 2000);
      return;
    }

    setAuthToken(token);
    (async () => {
      try {
        const me = await fetchMe();
        if (!me) throw new Error('fetch_me_failed');
        await fetchBalance();
        setState('success');
        const target = consumeReturnPath();
        setTimeout(() => router.push(target), 800);
      } catch {
        setState('error');
        setTimeout(() => router.push('/login?oauth_error=1'), 2000);
      }
    })();
  }, [setAuthToken, fetchMe, fetchBalance, router]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] p-10 text-center max-w-sm w-full">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-primary)] mb-6">Google Login</div>
        {state === 'loading' && (
          <>
            <Loader2 className="mx-auto mb-4 animate-spin text-[var(--color-primary)]" size={40} />
            <h3 className="text-[18px] font-bold text-[var(--color-text)] mb-2">Anmeldung abschliessen…</h3>
            <p className="text-[13px] text-[var(--color-muted)]">Wir melden dich an und laden dein Profil.</p>
          </>
        )}
        {state === 'success' && (
          <>
            <CheckCircle className="mx-auto mb-4 text-[var(--color-success)]" size={40} />
            <h3 className="text-[18px] font-bold text-[var(--color-text)] mb-2">Angemeldet</h3>
            <p className="text-[13px] text-[var(--color-muted)]">Weiterleitung…</p>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="mx-auto mb-4 text-[var(--color-danger)]" size={40} />
            <h3 className="text-[18px] font-bold text-[var(--color-text)] mb-2">Anmeldung fehlgeschlagen</h3>
            <p className="text-[13px] text-[var(--color-muted)]">Weiterleitung zum Login…</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
