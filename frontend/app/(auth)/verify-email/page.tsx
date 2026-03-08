'use client';

import React, { Suspense, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { resolveAuthError } from '@/lib/utils';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { verifyEmail } = useAuth();
  const token = searchParams.get('token') || '';
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    if (!token) { setState('error'); setMessage('Token fehlt. Bitte nutze den Link aus der E-Mail.'); return; }
    verifyEmail(token)
      .then(() => setState('success'))
      .catch(err => { setState('error'); setMessage(resolveAuthError(err, 'verify')); });
  }, [token, verifyEmail]);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm">
      <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] p-8 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-primary)] mb-6">E-Mail bestätigen</div>
        {state === 'loading' && (
          <>
            <Loader2 className="mx-auto mb-4 animate-spin text-[var(--color-primary)]" size={40} />
            <h3 className="text-[18px] font-bold text-[var(--color-text)] mb-2">Bestätigung prüfen…</h3>
            <p className="text-[13px] text-[var(--color-muted)]">Wir prüfen deinen Link.</p>
          </>
        )}
        {state === 'success' && (
          <>
            <CheckCircle className="mx-auto mb-4 text-[var(--color-success)]" size={40} />
            <h3 className="text-[18px] font-bold text-[var(--color-text)] mb-2">E-Mail bestätigt</h3>
            <p className="text-[13px] text-[var(--color-muted)] mb-6">Du kannst dich jetzt anmelden.</p>
            <Link href="/login" className="inline-flex items-center justify-center h-10 px-6 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:bg-[var(--color-primary-hover)] transition-colors">
              Zum Login
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="mx-auto mb-4 text-[var(--color-danger)]" size={40} />
            <h3 className="text-[18px] font-bold text-[var(--color-text)] mb-2">Bestätigung fehlgeschlagen</h3>
            <p className="text-[13px] text-[var(--color-muted)] mb-6">{message || 'Der Link ist ungültig oder abgelaufen.'}</p>
            <Link href="/login" className="inline-flex items-center justify-center h-10 px-6 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[13px] font-semibold hover:bg-[var(--color-surface-3)] transition-colors">
              Zum Login
            </Link>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
