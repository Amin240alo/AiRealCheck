'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  LogOut,
  AlertTriangle,
  Pencil,
  Lock,
  ChevronDown,
  ChevronUp,
  Loader2,
  User2,
  ShieldCheck,
  Sparkles,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import { getInitials, formatDateShort, formatDate } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';

// ─── shared ──────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden ${className ?? ''}`}>
      {children}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-6 py-4 border-b border-[var(--color-border)]">
      <div className="text-[14px] font-semibold text-[var(--color-text)]">{title}</div>
      {sub && <div className="text-[12px] text-[var(--color-muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
}

function InfoRow({ label, value, icon: Icon }: FieldProps) {
  return (
    <div className="flex items-center gap-4 px-6 py-3.5">
      {Icon && <Icon size={15} className="text-[var(--color-muted)] flex-shrink-0" />}
      <span className="text-[12px] text-[var(--color-muted)] w-28 flex-shrink-0">{label}</span>
      <span className="text-[13px] text-[var(--color-text)] truncate">{value}</span>
    </div>
  );
}

// ─── Inline name edit ─────────────────────────────────────────────────────────

function DisplayNameForm({ current, onSaved }: { current: string; onSaved: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const { fetchMe } = useAuth();
  const { t } = useT();

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === current) { setEditing(false); return; }
    if (trimmed.length > 120) { toast.error(t('profile.nameTooLong')); return; }
    setSaving(true);
    try {
      await apiFetch('/auth/profile', { method: 'PATCH', body: { display_name: trimmed } });
      await fetchMe();
      onSaved(trimmed);
      setEditing(false);
      toast.success(t('profile.nameSaved'));
    } catch {
      toast.error(t('profile.nameSaveError'));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setValue(current);
    setEditing(false);
  }

  return (
    <div className="px-6 py-4 flex items-center gap-4">
      <User2 size={15} className="text-[var(--color-muted)] flex-shrink-0" />
      <span className="text-[12px] text-[var(--color-muted)] w-28 flex-shrink-0">{t('profile.nameLabel')}</span>
      {editing ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
            maxLength={120}
            className="flex-1 min-w-0 h-8 px-3 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-8 px-3 text-[12px] font-semibold rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            {t('profile.save')}
          </button>
          <button onClick={handleCancel} className="h-8 px-3 text-[12px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
            {t('profile.cancel')}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[13px] text-[var(--color-text)] truncate flex-1">{current || '—'}</span>
          <button
            onClick={() => { setValue(current); setEditing(true); }}
            className="p-1 rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors flex-shrink-0"
          >
            <Pencil size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inline password change ───────────────────────────────────────────────────

function PasswordChangeForm() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const { t } = useT();

  async function handleSave() {
    if (!current || !next) { toast.error(t('profile.pwMissingFields')); return; }
    if (next.length < 8) { toast.error(t('profile.pwMinLength')); return; }
    if (next !== confirm) { toast.error(t('profile.pwMismatch')); return; }
    setSaving(true);
    try {
      await apiFetch('/auth/change-password', { method: 'PATCH', body: { current_password: current, new_password: next } });
      toast.success(t('profile.pwSaved'));
      setCurrent(''); setNext(''); setConfirm('');
      setOpen(false);
    } catch (err: unknown) {
      const e = err as { response?: { error?: string } };
      if (e?.response?.error === 'invalid_credentials') toast.error(t('profile.pwWrongCurrent'));
      else if (e?.response?.error === 'rate_limited') toast.error(t('profile.pwRateLimited'));
      else toast.error(t('profile.pwError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[var(--color-surface-2)] transition-colors"
      >
        <div className="flex items-center gap-4">
          <Lock size={15} className="text-[var(--color-muted)] flex-shrink-0" />
          <span className="text-[13px] text-[var(--color-text)]">{t('profile.changePassword')}</span>
        </div>
        {open ? <ChevronUp size={15} className="text-[var(--color-muted)]" /> : <ChevronDown size={15} className="text-[var(--color-muted)]" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 space-y-3 border-t border-[var(--color-border)]">
              <div className="pt-4 space-y-3">
                {[
                  { label: t('profile.currentPassword'), val: current, set: setCurrent },
                  { label: t('profile.newPassword'), val: next, set: setNext },
                  { label: t('profile.confirmPassword'), val: confirm, set: setConfirm },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label className="block text-[11px] text-[var(--color-muted)] mb-1">{label}</label>
                    <input
                      type="password"
                      value={val}
                      onChange={e => set(e.target.value)}
                      className="w-full h-9 px-3 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-9 px-4 text-[13px] font-semibold rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
                  >
                    {saving && <Loader2 size={13} className="animate-spin" />}
                    {t('profile.savePassword')}
                  </button>
                  <button
                    onClick={() => { setOpen(false); setCurrent(''); setNext(''); setConfirm(''); }}
                    className="h-9 px-4 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
                  >
                    {t('profile.cancel')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { user, balance, isLoggedIn, isEmailVerified, logout, resendVerify, fetchMe } = useAuth();
  const { t } = useT();
  const [resendStatus, setResendStatus] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [localName, setLocalName] = useState<string | null>(null);

  const displayName = localName ?? user?.display_name ?? '';

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    router.push('/login');
  }

  async function handleResend() {
    setResendStatus(t('profile.sending'));
    try { await resendVerify(); setResendStatus(t('profile.sent')); }
    catch { setResendStatus(t('profile.resendError')); }
  }

  if (!isLoggedIn) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-10">
        <SectionCard className="p-10 text-center">
          <h2 className="text-[18px] font-bold text-[var(--color-text)] mb-2">{t('profile.guestTitle')}</h2>
          <p className="text-[13px] text-[var(--color-muted)] mb-6">{t('profile.guestText')}</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => router.push('/login')} className="h-9 px-5 bg-[var(--color-primary)] text-white rounded-[var(--radius-md)] text-[13px] font-semibold hover:opacity-90 transition-opacity">{t('profile.signIn')}</button>
            <button onClick={() => router.push('/register')} className="h-9 px-5 bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] rounded-[var(--radius-md)] text-[13px] font-medium hover:bg-[var(--color-surface-3)] transition-colors">{t('profile.createAccount')}</button>
          </div>
        </SectionCard>
      </div>
    );
  }

  const creditsTotal = balance?.credits_total || 100;
  const creditsAvail = balance?.credits_available ?? 0;
  const creditsPct = Math.max(0, Math.min(100, (creditsAvail / creditsTotal) * 100));
  const planType = balance?.plan_type ?? user?.plan_type ?? 'free';
  const isPaid = planType !== 'free';

  return (
    <div className="max-w-2xl mx-auto px-5 py-10 space-y-5">

      {/* Email verification warning */}
      <AnimatePresence>
        {!isEmailVerified && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 px-5 py-4 rounded-[var(--radius-xl)] bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/30"
          >
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-[var(--color-warning)]" />
            <div className="flex-1">
              <div className="text-[13px] font-medium text-[var(--color-warning)]">{t('profile.verifyWarningTitle')}</div>
              <div className="text-[12px] text-[var(--color-muted)] mt-0.5">{t('profile.verifyWarningSub')}</div>
              <button onClick={handleResend} className="text-[12px] text-[var(--color-primary)] hover:underline mt-1">
                {resendStatus || t('profile.resendVerify')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <SectionCard>
          <div className="p-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #22d3ee, #7c3aed)' }}>
              {getInitials(displayName || user?.email)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[18px] font-bold text-[var(--color-text)] truncate">{displayName || t('profile.noName')}</div>
              <div className="text-[13px] text-[var(--color-muted)] mt-0.5 truncate">{user?.email}</div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                  style={{
                    background: isPaid ? '#a78bfa20' : 'var(--color-surface-2)',
                    borderColor: isPaid ? '#a78bfa50' : 'var(--color-border)',
                    color: isPaid ? '#a78bfa' : 'var(--color-muted)',
                  }}
                >
                  {isPaid && <Sparkles size={9} className="mr-1" />}
                  {PLAN_LABELS[planType] ?? planType}
                </span>
                {isEmailVerified ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-success)]">
                    <CheckCircle size={11} /> {t('profile.verified')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-warning)]">
                    <XCircle size={11} /> {t('profile.notVerified')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* Credits */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.3 }}>
        <SectionCard>
          <SectionHeader title={t('profile.creditsSection')} sub={t('profile.creditsSub')} />
          <div className="p-6">
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="text-[30px] font-bold text-[var(--color-text)] leading-none tabular-nums">{creditsAvail}</div>
                <div className="text-[12px] text-[var(--color-muted)] mt-0.5">{t('profile.creditsOf')} {creditsTotal} {t('profile.creditsAvailable')}</div>
              </div>
              <CreditCard size={20} className="text-[var(--color-muted)]" />
            </div>
            <div className="h-2 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #22d3ee, #7c3aed)' }}
                initial={{ width: 0 }}
                animate={{ width: `${creditsPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              />
            </div>
            {balance?.last_credit_reset && (
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted-2)] mt-2">
                <Clock size={10} />
                {t('profile.creditsReset')}: {formatDateShort(balance.last_credit_reset)}
              </div>
            )}
          </div>
        </SectionCard>
      </motion.div>

      {/* Account info + edit */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
        <SectionCard>
          <SectionHeader title={t('profile.accountSection')} sub={t('profile.accountSub')} />
          <div className="divide-y divide-[var(--color-border)]">
            <DisplayNameForm
              current={displayName}
              onSaved={name => setLocalName(name)}
            />
            <InfoRow icon={Mail} label={t('profile.emailLabel')} value={
              <span className="flex items-center gap-2">
                {user?.email}
                <span className="text-[11px] text-[var(--color-muted-2)]">{t('profile.emailNotChangeable')}</span>
              </span>
            } />
            <InfoRow icon={ShieldCheck} label={t('profile.subscriptionLabel')} value={
              balance?.subscription_active
                ? <span className="text-[var(--color-success)]">{t('profile.subscriptionActive')}</span>
                : <span className="text-[var(--color-muted)]">{t('profile.subscriptionNone')}</span>
            } />
            <InfoRow icon={Calendar} label={t('profile.registeredLabel')} value={formatDateShort(user?.created_at)} />
            {user?.last_login_at && (
              <InfoRow icon={Clock} label={t('profile.lastLoginLabel')} value={formatDate(user.last_login_at)} />
            )}
            <PasswordChangeForm />
          </div>
        </SectionCard>
      </motion.div>

      {/* Verknüpfte Konten */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}>
        <SectionCard>
          <SectionHeader title={t('profile.linkedSection')} sub={t('profile.linkedSub')} />
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div>
                <div className="text-[13px] font-medium text-[var(--color-text)]">Google</div>
                <div className="text-[11px] text-[var(--color-muted-2)]">OAuth 2.0</div>
              </div>
            </div>
            <span className="text-[11px] text-[var(--color-muted-2)] italic">{t('profile.notLinked')}</span>
          </div>
        </SectionCard>
      </motion.div>

      {/* Logout */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-[var(--radius-xl)] border border-[var(--color-border)] text-[13px] font-medium text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/50 hover:bg-[var(--color-danger-muted)] transition-colors disabled:opacity-50"
        >
          {loggingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          {loggingOut ? t('profile.signingOut') : t('profile.signOut')}
        </button>
      </motion.div>
    </div>
  );
}
