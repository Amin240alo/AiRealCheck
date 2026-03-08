'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Calendar, CreditCard, ShieldCheck, CheckCircle, XCircle, LogOut, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getInitials, formatDateShort } from '@/lib/utils';

export default function ProfilePage() {
  const router = useRouter();
  const { user, balance, isLoggedIn, isEmailVerified, logout, resendVerify } = useAuth();
  const [resendStatus, setResendStatus] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    router.push('/login');
  }

  async function handleResend() {
    setResendStatus('Senden…');
    try { await resendVerify(); setResendStatus('Gesendet!'); }
    catch { setResendStatus('Fehler'); }
  }

  if (!isLoggedIn) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-10 text-center">
          <h2 className="text-[20px] font-bold text-[var(--color-text)] mb-2">Du bist als Gast unterwegs</h2>
          <p className="text-[14px] text-[var(--color-muted)] mb-7">Melde dich an, um dein Profil zu sehen.</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => router.push('/login')} className="h-10 px-6 bg-[var(--color-primary)] text-white rounded-[var(--radius-md)] text-[14px] font-semibold hover:bg-[var(--color-primary-hover)] transition-colors">Einloggen</button>
            <button onClick={() => router.push('/register')} className="h-10 px-6 bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] rounded-[var(--radius-md)] text-[14px] font-medium hover:bg-[var(--color-surface-3)] transition-colors">Konto erstellen</button>
          </div>
        </div>
      </div>
    );
  }

  const creditsTotal = balance?.credits_total || 100;
  const creditsAvail = balance?.credits_available ?? 0;
  const creditsPct = Math.max(0, Math.min(100, (creditsAvail / creditsTotal) * 100));

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {!isEmailVerified && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mb-5 flex items-start gap-3 px-4 py-3.5 rounded-[var(--radius-md)] bg-[var(--color-warning-muted)] border border-[var(--color-warning)] border-opacity-30">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-warning)]" />
          <div>
            <div className="text-[13px] font-medium text-[var(--color-warning)]">Bitte E-Mail bestätigen</div>
            <div className="text-[12px] text-[var(--color-muted)] mt-0.5">Ohne Verifikation sind Analysen gesperrt.</div>
            <button onClick={handleResend} className="text-[12px] text-[var(--color-primary)] hover:underline mt-1">{resendStatus || 'Bestätigungs-E-Mail senden'}</button>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-md)] overflow-hidden">
        {/* Header */}
        <div className="p-7 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[22px] font-bold text-white flex-shrink-0">
              {getInitials(user?.display_name || user?.email)}
            </div>
            <div>
              <div className="text-[19px] font-bold text-[var(--color-text)]">{user?.display_name || 'Kein Name'}</div>
              <div className="text-[14px] text-[var(--color-muted)] mt-0.5">{user?.email}</div>
              <div className="text-[11px] mt-1.5">
                <span className={`px-2.5 py-1 rounded-full ${balance?.plan_type === 'premium' ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]' : 'bg-[var(--color-surface-3)] text-[var(--color-muted-2)]'}`}>
                  {balance?.plan_type || 'Free'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-px bg-[var(--color-border)] border-b border-[var(--color-border)]">
          {[
            { label: 'Credits verfügbar', value: creditsAvail, icon: CreditCard },
            { label: 'Credits gesamt', value: creditsTotal, icon: CreditCard },
            { label: 'Abo aktiv', value: balance?.subscription_active ? 'Ja' : 'Nein', icon: ShieldCheck },
            { label: 'E-Mail bestätigt', value: isEmailVerified ? 'Ja' : 'Nein', icon: isEmailVerified ? CheckCircle : XCircle },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-[var(--color-surface)] p-5">
              <div className="text-[11px] text-[var(--color-muted-2)] mb-1.5">{label}</div>
              <div className="text-[18px] font-semibold text-[var(--color-text)]">{value}</div>
            </div>
          ))}
        </div>

        {/* Credits bar */}
        <div className="p-5 border-b border-[var(--color-border)]">
          <div className="flex justify-between text-[13px] text-[var(--color-muted)] mb-2.5">
            <span>Credits-Nutzung</span>
            <span>{creditsAvail} / {creditsTotal}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500" style={{ width: `${creditsPct}%` }} />
          </div>
          {balance?.last_credit_reset && (
            <div className="text-[11px] text-[var(--color-muted-2)] mt-2">Letzter Reset: {formatDateShort(balance.last_credit_reset)}</div>
          )}
        </div>

        {/* Info rows */}
        <div className="divide-y divide-[var(--color-border)]">
          {[
            { icon: Mail, label: 'E-Mail', value: user?.email },
            { icon: Calendar, label: 'Registriert', value: formatDateShort(user?.created_at) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-4 px-6 py-4">
              <Icon size={16} className="text-[var(--color-muted)] flex-shrink-0" />
              <span className="text-[13px] text-[var(--color-muted)] w-32 flex-shrink-0">{label}</span>
              <span className="text-[14px] text-[var(--color-text)] truncate">{value || '—'}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6">
          <button onClick={() => router.push('/history')}
            className="flex-1 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[14px] font-medium hover:bg-[var(--color-surface-3)] transition-colors">
            Verlauf öffnen
          </button>
          <button onClick={handleLogout} disabled={loggingOut}
            className="flex items-center gap-2 h-10 px-5 rounded-[var(--radius-md)] bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-[14px] font-medium hover:bg-[var(--color-danger)] hover:text-white transition-colors disabled:opacity-50">
            <LogOut size={15} /> {loggingOut ? 'Abmelden…' : 'Ausloggen'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
