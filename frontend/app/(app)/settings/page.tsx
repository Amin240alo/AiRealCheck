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
  const [step, setStep] = useState<'idle' | 'confirm' | 'typing'>('idle');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!password) { toast.error('Bitte Passwort eingeben.'); return; }
    setDeleting(true);
    try {
      await apiFetch('/auth/account', { method: 'DELETE', body: { password } });
      toast.success('Konto wurde gelöscht.');
      await logout();
      router.replace('/login');
    } catch (err: unknown) {
      const e = err as { response?: { error?: string } };
      if (e?.response?.error === 'invalid_credentials') toast.error('Passwort falsch.');
      else if (e?.response?.error === 'rate_limited') toast.error('Zu viele Versuche. Kurz warten.');
      else toast.error('Löschen fehlgeschlagen.');
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
          <div className="text-[14px] font-semibold" style={{ color: 'var(--color-danger)' }}>Konto löschen</div>
          <div className="text-[12px] text-[var(--color-muted)] mt-0.5">Unwiderrufliche Aktion — alle Daten werden anonymisiert</div>
        </div>
      </div>

      <div className="px-6 py-4">
        {step === 'idle' && (
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--color-muted)]">
              Dein Konto wird soft-gelöscht: Persönliche Daten (Name, E-Mail) werden anonymisiert, Analysedaten bleiben für interne Auswertung erhalten.
            </p>
            <button
              onClick={() => setStep('confirm')}
              className="h-9 px-4 text-[13px] font-medium rounded-[var(--radius-md)] border transition-colors"
              style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-danger)', e.currentTarget.style.color = 'white')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent', e.currentTarget.style.color = 'var(--color-danger)')}
            >
              Konto löschen
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="flex items-start gap-2.5 p-3 rounded-[var(--radius-md)] border" style={{ borderColor: 'var(--color-danger)' + '40', background: 'var(--color-danger-muted)' }}>
              <AlertTriangle size={14} style={{ color: 'var(--color-danger)' }} className="flex-shrink-0 mt-0.5" />
              <p className="text-[12px]" style={{ color: 'var(--color-danger)' }}>
                <strong>Bist du sicher?</strong> Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('typing')}
                className="h-9 px-4 text-[13px] font-semibold rounded-[var(--radius-md)] text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--color-danger)' }}
              >
                Ja, weiter
              </button>
              <button
                onClick={() => setStep('idle')}
                className="h-9 px-4 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </motion.div>
        )}

        {step === 'typing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div>
              <label className="block text-[12px] text-[var(--color-muted)] mb-1.5">Passwort bestätigen</label>
              <input
                autoFocus
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDelete()}
                placeholder="Dein aktuelles Passwort"
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
                Endgültig löschen
              </button>
              <button
                onClick={() => { setStep('idle'); setPassword(''); }}
                className="h-9 px-4 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                Abbrechen
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
        <h1 className="text-[22px] font-bold text-[var(--color-text)]">Einstellungen</h1>
        <AnimatePresence>
          {savedPref && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-[12px] text-[var(--color-success)]"
            >
              <Check size={13} /> Gespeichert
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Darstellung ─────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <SectionCard>
          <SectionHeader icon={Sun} title="Darstellung" />
          <div className="divide-y divide-[var(--color-border)]">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <div className="text-[13px] text-[var(--color-text)]">Erscheinungsbild</div>
                <div className="text-[11px] text-[var(--color-muted-2)] mt-0.5">Helles oder dunkles Theme</div>
              </div>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-3)] transition-colors"
              >
                {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                {theme === 'dark' ? 'Dunkel' : 'Hell'}
              </button>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Präferenzen ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.3 }}>
        <SectionCard>
          <SectionHeader icon={SlidersHorizontal} title="Präferenzen" sub="Werden lokal gespeichert" />
          <div className="divide-y divide-[var(--color-border)]">
            <SelectRow
              label="Standard-Sortierung Verlauf"
              sub="Voreinstellung für die Verlaufsseite"
              value={prefs.historySort}
              options={[
                { value: 'newest', label: 'Neueste zuerst' },
                { value: 'oldest', label: 'Älteste zuerst' },
              ]}
              onChange={v => updatePref('historySort', v)}
            />
            <SelectRow
              label="Dashboard-Zeitraum"
              sub="Standard-Bereich für KPI-Karten"
              value={prefs.dashboardRange}
              options={[
                { value: '7d', label: 'Letzte 7 Tage' },
                { value: '30d', label: 'Letzte 30 Tage' },
                { value: '90d', label: 'Letzte 90 Tage' },
              ]}
              onChange={v => updatePref('dashboardRange', v)}
            />
            <SelectRow
              label="Ergebnis-Detailansicht"
              sub="Kompakt oder vollständig"
              value={prefs.resultDetailMode}
              options={[
                { value: 'full', label: 'Vollständig' },
                { value: 'compact', label: 'Kompakt' },
              ]}
              onChange={v => updatePref('resultDetailMode', v)}
            />
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Sprache ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
        <SectionCard>
          <SectionHeader icon={Globe} title="Sprache / Locale" />
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] text-[var(--color-text)]">Sprache</div>
                <div className="text-[11px] text-[var(--color-muted-2)] mt-0.5">Weitere Sprachen folgen in Kürze</div>
              </div>
              <span className="text-[12px] font-medium text-[var(--color-text)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3 py-1.5 rounded-[var(--radius-md)]">
                🇩🇪 Deutsch
              </span>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Abo & Plan ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}>
        <SectionCard>
          <SectionHeader icon={CreditCard} title="Abo & Plan" />
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
                    {isPaid ? 'Aktiv' : 'Kostenlos'}
                  </span>
                </div>
                <div className="text-[12px] text-[var(--color-muted)] mt-0.5">{creditsAvail} Credits verfügbar</div>
              </div>
              {!isPaid && (
                <button
                  onClick={() => router.push('/premium')}
                  className="flex items-center gap-1.5 h-9 px-4 text-[12px] font-semibold rounded-[var(--radius-md)] text-white transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #22d3ee, #7c3aed)' }}
                >
                  <Sparkles size={12} /> Upgrade
                </button>
              )}
            </div>
            <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
              <div className="text-[12px] font-medium text-[var(--color-text)] mb-1">
                {isPaid ? 'Abo verwalten' : 'Zur Pro-Version'}
              </div>
              <div className="text-[11px] text-[var(--color-muted)]">
                {isPaid
                  ? 'Kündigung und Rechnungen werden über das Kundenportal verwaltet. Integration in Kürze verfügbar.'
                  : 'Pro: Unbegrenzte Analysen, priorisierte Engines, erweiterte Berichte. In Kürze verfügbar.'}
              </div>
              <button
                onClick={() => router.push('/premium')}
                className="flex items-center gap-1 mt-2.5 text-[12px] text-[var(--color-primary)] hover:underline"
              >
                {isPaid ? 'Zum Kundenportal' : 'Mehr erfahren'} <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Benachrichtigungen ───────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
        <SectionCard>
          <SectionHeader icon={Bell} title="Benachrichtigungen" sub="Einstellungen werden lokal gespeichert" />
          <div className="divide-y divide-[var(--color-border)]">
            <ToggleRow
              label="E-Mail-Benachrichtigungen"
              sub="Analysen und Systemhinweise per E-Mail"
              checked={prefs.notifyEmail}
              onChange={v => updatePref('notifyEmail', v)}
            />
            <ToggleRow
              label="Browser-Benachrichtigungen"
              sub="Push-Nachrichten im Browser"
              checked={prefs.notifyBrowser}
              onChange={v => updatePref('notifyBrowser', v)}
            />
          </div>
          <div className="px-6 py-3 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted-2)]">
              <BellOff size={11} />
              Backend-Anbindung für Benachrichtigungen noch nicht aktiv.
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Datenschutz & Export ─────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.3 }}>
        <SectionCard>
          <SectionHeader icon={Shield} title="Datenschutz & Daten-Export" />
          <div className="px-6 py-4 space-y-3">
            <p className="text-[12px] text-[var(--color-muted)]">
              Du kannst jederzeit eine Kopie deiner Daten anfordern. Analysen, Verlauf und Kontoinfos werden als JSON-Archiv bereitgestellt.
            </p>
            <button
              onClick={() => toast.info('Daten-Export wird bald verfügbar sein.')}
              className="flex items-center gap-2 h-9 px-4 text-[13px] font-medium rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-3)] transition-colors"
            >
              <Download size={14} /> Daten exportieren
            </button>
            <div className="text-[11px] text-[var(--color-muted-2)] flex items-center gap-1.5">
              <Shield size={11} />
              Export-Funktion in Entwicklung.
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
