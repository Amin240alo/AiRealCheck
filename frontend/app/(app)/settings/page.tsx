'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun,
  Moon,
  Globe,
  Bell,
  BellOff,
  Shield,
  Download,
  Trash2,
  CreditCard,
  Loader2,
  ChevronRight,
  Sparkles,
  SlidersHorizontal,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiFetch } from '@/lib/api';
import { useT, useSetLang, useLang } from '@/contexts/LanguageContext';
import { SUPPORTED_LANGS } from '@/lib/i18n';

// ─── localStorage prefs ───────────────────────────────────────────────────────

const PREFS_KEY = 'ac_prefs';

interface Prefs {
  historySort: 'newest' | 'oldest';
  dashboardRange: '7d' | '30d' | '90d';
  resultDetailMode: 'compact' | 'full';
  notifyEmail: boolean;
  notifyBrowser: boolean;
}

const PREFS_DEFAULT: Prefs = {
  historySort: 'newest',
  dashboardRange: '30d',
  resultDetailMode: 'full',
  notifyEmail: true,
  notifyBrowser: false,
};

function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return PREFS_DEFAULT;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return PREFS_DEFAULT;
    return { ...PREFS_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return PREFS_DEFAULT;
  }
}

function savePrefs(p: Prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

// ─── shared ───────────────────────────────────────────────────────────────────

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden ${className ?? ''}`}>
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, sub }: { icon?: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
      {Icon && <Icon size={15} className="text-[var(--color-muted)] flex-shrink-0" />}
      <div>
        <div className="text-[14px] font-semibold text-[var(--color-text)]">{title}</div>
        {sub && <div className="text-[12px] text-[var(--color-muted)] mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, sub, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div>
        <div className="text-[13px] text-[var(--color-text)]">{label}</div>
        {sub && <div className="text-[11px] text-[var(--color-muted-2)] mt-0.5">{sub}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5.5 h-[22px] rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-3)]'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

interface SelectRowProps<T extends string> {
  label: string;
  sub?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

function SelectRow<T extends string>({ label, sub, value, options, onChange }: SelectRowProps<T>) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div>
        <div className="text-[13px] text-[var(--color-text)]">{label}</div>
        {sub && <div className="text-[11px] text-[var(--color-muted-2)] mt-0.5">{sub}</div>}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="h-8 pl-3 pr-7 text-[12px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer appearance-none transition-colors"
        style={{ backgroundImage: 'none' }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Delete account flow ──────────────────────────────────────────────────────

function DeleteAccountZone() {
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useT();
  const [step, setStep] = useState<'idle' | 'confirm' | 'typing'>('idle');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!password) { toast.error(t('settings.deleteMissingPw')); return; }
    setDeleting(true);
    try {
      await apiFetch('/auth/account', { method: 'DELETE', body: { password } });
      toast.success(t('settings.deleteSuccess'));
      await logout();
      router.replace('/login');
    } catch (err: unknown) {
      const e = err as { response?: { error?: string } };
      if (e?.response?.error === 'invalid_credentials') toast.error(t('settings.deleteWrongPw'));
      else if (e?.response?.error === 'rate_limited') toast.error(t('settings.deleteRateLimited'));
      else toast.error(t('settings.deleteError'));
      setDeleting(false);
    }
  }

  return (
    <div
      className="rounded-[var(--radius-xl)] border overflow-hidden"
      style={{ borderColor: 'var(--color-danger)' + '40', background: 'var(--color-danger-muted)' }}
    >
      <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--color-danger)' + '30' }}>
        <Trash2 size={15} style={{ color: 'var(--color-danger)' }} className="flex-shrink-0" />
        <div>
          <div className="text-[14px] font-semibold" style={{ color: 'var(--color-danger)' }}>{t('settings.deleteSection')}</div>
          <div className="text-[12px] text-[var(--color-muted)] mt-0.5">{t('settings.deleteSub')}</div>
        </div>
      </div>

      <div className="px-6 py-4">
        {step === 'idle' && (
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--color-muted)]">
              {t('settings.deleteText')}
            </p>
            <button
              onClick={() => setStep('confirm')}
              className="h-9 px-4 text-[13px] font-medium rounded-[var(--radius-md)] border transition-colors"
              style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-danger)', e.currentTarget.style.color = 'white')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent', e.currentTarget.style.color = 'var(--color-danger)')}
            >
              {t('settings.deleteBtn')}
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="flex items-start gap-2.5 p-3 rounded-[var(--radius-md)] border" style={{ borderColor: 'var(--color-danger)' + '40', background: 'var(--color-danger-muted)' }}>
              <AlertTriangle size={14} style={{ color: 'var(--color-danger)' }} className="flex-shrink-0 mt-0.5" />
              <p className="text-[12px]" style={{ color: 'var(--color-danger)' }}>
                <strong>{t('settings.deleteConfirmQ')}</strong> {t('settings.deleteConfirmText')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('typing')}
                className="h-9 px-4 text-[13px] font-semibold rounded-[var(--radius-md)] text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--color-danger)' }}
              >
                {t('settings.deleteContinue')}
              </button>
              <button
                onClick={() => setStep('idle')}
                className="h-9 px-4 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                {t('settings.deleteCancel')}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'typing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div>
              <label className="block text-[12px] text-[var(--color-muted)] mb-1.5">{t('settings.deletePasswordLabel')}</label>
              <input
                autoFocus
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDelete()}
                placeholder={t('settings.deletePasswordPh')}
                className="w-full h-9 px-3 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface)] border text-[var(--color-text)] focus:outline-none transition-colors"
                style={{ borderColor: 'var(--color-danger)' + '60' }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting || !password}
                className="h-9 px-4 text-[13px] font-semibold rounded-[var(--radius-md)] text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-2"
                style={{ background: 'var(--color-danger)' }}
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                {t('settings.deleteFinalBtn')}
              </button>
              <button
                onClick={() => { setStep('idle'); setPassword(''); }}
                className="h-9 px-4 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                {t('settings.deleteCancel')}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, balance } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, tf } = useT();
  const lang = useLang();
  const setLang = useSetLang();
  const [prefs, setPrefs] = useState<Prefs>(PREFS_DEFAULT);
  const [savedPref, setSavedPref] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  function updatePref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(next);
    setSavedPref(true);
    setTimeout(() => setSavedPref(false), 1500);
  }

  const planType = balance?.plan_type ?? user?.plan_type ?? 'free';
  const isPaid = planType !== 'free';
  const creditsAvail = balance?.credits_available ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-5 py-10 space-y-5">

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-[22px] font-bold text-[var(--color-text)]">{t('settings.title')}</h1>
        <AnimatePresence>
          {savedPref && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-[12px] text-[var(--color-success)]"
            >
              <Check size={13} /> {t('settings.saved')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Darstellung ─────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <SectionCard>
          <SectionHeader icon={Sun} title={t('settings.appearanceSection')} />
          <div className="divide-y divide-[var(--color-border)]">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <div className="text-[13px] text-[var(--color-text)]">{t('settings.themeLabel')}</div>
                <div className="text-[11px] text-[var(--color-muted-2)] mt-0.5">{t('settings.themeSub')}</div>
              </div>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-3)] transition-colors"
              >
                {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                {theme === 'dark' ? t('settings.themeDark') : t('settings.themeLight')}
              </button>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Präferenzen ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.3 }}>
        <SectionCard>
          <SectionHeader icon={SlidersHorizontal} title={t('settings.prefSection')} sub={t('settings.prefSub')} />
          <div className="divide-y divide-[var(--color-border)]">
            <SelectRow
              label={t('settings.historySort')}
              sub={t('settings.historySortSub')}
              value={prefs.historySort}
              options={[
                { value: 'newest', label: t('settings.newest') },
                { value: 'oldest', label: t('settings.oldest') },
              ]}
              onChange={v => updatePref('historySort', v)}
            />
            <SelectRow
              label={t('settings.dashboardRange')}
              sub={t('settings.dashboardRangeSub')}
              value={prefs.dashboardRange}
              options={[
                { value: '7d', label: t('settings.last7d') },
                { value: '30d', label: t('settings.last30d') },
                { value: '90d', label: t('settings.last90d') },
              ]}
              onChange={v => updatePref('dashboardRange', v)}
            />
            <SelectRow
              label={t('settings.resultDetail')}
              sub={t('settings.resultDetailSub')}
              value={prefs.resultDetailMode}
              options={[
                { value: 'full', label: t('settings.full') },
                { value: 'compact', label: t('settings.compact') },
              ]}
              onChange={v => updatePref('resultDetailMode', v)}
            />
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Sprache ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
        <SectionCard>
          <SectionHeader icon={Globe} title={t('settings.langSection')} />
          <div className="divide-y divide-[var(--color-border)]">
            <SelectRow
              label={t('settings.langLabel')}
              value={lang}
              options={SUPPORTED_LANGS.map(l => ({ value: l.value, label: `${l.flag} ${l.label}` }))}
              onChange={v => setLang(v)}
            />
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Abo & Plan ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}>
        <SectionCard>
          <SectionHeader icon={CreditCard} title={t('settings.planSection')} />
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-[15px] font-semibold text-[var(--color-text)]">{PLAN_LABELS[planType] ?? planType}</div>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                    style={{
                      background: isPaid ? '#a78bfa20' : 'var(--color-surface-2)',
                      borderColor: isPaid ? '#a78bfa50' : 'var(--color-border)',
                      color: isPaid ? '#a78bfa' : 'var(--color-muted)',
                    }}
                  >
                    {isPaid && <Sparkles size={8} className="mr-1" />}
                    {isPaid ? t('settings.active') : t('settings.free')}
                  </span>
                </div>
                <div className="text-[12px] text-[var(--color-muted)] mt-0.5">{tf('settings.creditsAvailable', creditsAvail)}</div>
              </div>
              {!isPaid && (
                <button
                  onClick={() => router.push('/premium')}
                  className="flex items-center gap-1.5 h-9 px-4 text-[12px] font-semibold rounded-[var(--radius-md)] text-white transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #22d3ee, #7c3aed)' }}
                >
                  <Sparkles size={12} /> {t('settings.upgrade')}
                </button>
              )}
            </div>
            <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
              <div className="text-[12px] font-medium text-[var(--color-text)] mb-1">
                {isPaid ? t('settings.managePlan') : t('settings.toPro')}
              </div>
              <div className="text-[11px] text-[var(--color-muted)]">
                {isPaid ? t('settings.manageText') : t('settings.upgradeText')}
              </div>
              <button
                onClick={() => router.push('/premium')}
                className="flex items-center gap-1 mt-2.5 text-[12px] text-[var(--color-primary)] hover:underline"
              >
                {isPaid ? t('settings.toPortal') : t('settings.learnMore')} <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Benachrichtigungen ───────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
        <SectionCard>
          <SectionHeader icon={Bell} title={t('settings.notifSection')} sub={t('settings.notifSub')} />
          <div className="divide-y divide-[var(--color-border)]">
            <ToggleRow
              label={t('settings.emailNotif')}
              sub={t('settings.emailNotifSub')}
              checked={prefs.notifyEmail}
              onChange={v => updatePref('notifyEmail', v)}
            />
            <ToggleRow
              label={t('settings.browserNotif')}
              sub={t('settings.browserNotifSub')}
              checked={prefs.notifyBrowser}
              onChange={v => updatePref('notifyBrowser', v)}
            />
          </div>
          <div className="px-6 py-3 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted-2)]">
              <BellOff size={11} />
              {t('settings.notifNote')}
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Datenschutz & Export ─────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.3 }}>
        <SectionCard>
          <SectionHeader icon={Shield} title={t('settings.privacySection')} />
          <div className="px-6 py-4 space-y-3">
            <p className="text-[12px] text-[var(--color-muted)]">
              {t('settings.privacyText')}
            </p>
            <button
              onClick={() => toast.info(t('settings.exportSoon'))}
              className="flex items-center gap-2 h-9 px-4 text-[13px] font-medium rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-3)] transition-colors"
            >
              <Download size={14} /> {t('settings.exportBtn')}
            </button>
            <div className="text-[11px] text-[var(--color-muted-2)] flex items-center gap-1.5">
              <Shield size={11} />
              {t('settings.exportNote')}
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Danger zone ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.3 }}>
        <DeleteAccountZone />
      </motion.div>

    </div>
  );
}
