'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  Bug,
  MessageSquare,
  CheckCircle2,
  Loader2,
  ChevronDown,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// ─── types ────────────────────────────────────────────────────────────────────

type FeedbackMode = 'feature' | 'bug' | 'general';

const MODES: { id: FeedbackMode; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: 'feature', label: 'Feature-Wunsch', icon: Lightbulb, color: '#a78bfa', desc: 'Neue Funktionen vorschlagen' },
  { id: 'bug',     label: 'Bug melden',     icon: Bug,        color: 'var(--color-danger)', desc: 'Fehler und Probleme berichten' },
  { id: 'general', label: 'Allgemeines',    icon: MessageSquare, color: '#22d3ee', desc: 'Sonstiges Feedback' },
];

const FEATURE_CATEGORIES = [
  'Analyse', 'Ergebnisdarstellung', 'Verlauf', 'Dashboard',
  'Exportfunktionen', 'API-Zugang', 'Konto & Profil', 'Performance', 'Sonstiges',
];

const BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera', 'Sonstiger'];

// ─── NPS ──────────────────────────────────────────────────────────────────────

function NpsRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-[var(--color-muted)] mb-2">
        Wie zufrieden bist du mit AIRealCheck? <span className="text-[var(--color-muted-2)]">(1 = sehr unzufrieden, 10 = sehr zufrieden)</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-9 h-9 rounded-[var(--radius-md)] text-[13px] font-semibold border transition-all ${
              value === n
                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {value !== null && (
        <div className="text-[11px] text-[var(--color-muted-2)] mt-1.5">
          {value <= 4 ? 'Danke für dein ehrliches Feedback.' : value <= 7 ? 'Danke! Wir arbeiten weiter daran.' : 'Super, das freut uns!'}
        </div>
      )}
    </div>
  );
}

// ─── Shared field ─────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1.5">
        {label}{required && ' *'}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full h-9 px-3 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors';
const textareaCls = 'w-full px-3 py-2.5 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors resize-none';

// ─── Feature form ─────────────────────────────────────────────────────────────

function FeatureForm({ nps, onNps, onSubmit, submitting }: {
  nps: number | null;
  onNps: (v: number) => void;
  onSubmit: (data: Record<string, string>) => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) { toast.error('Bitte Titel und Beschreibung ausfüllen.'); return; }
    onSubmit({ title, description, category });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Titel" required>
        <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)}
          maxLength={200} placeholder="Kurze Beschreibung des Feature-Wunsches" />
      </Field>
      <Field label="Kategorie">
        <div className="relative">
          <select className={inputCls + ' appearance-none pr-8 cursor-pointer'} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Kategorie wählen (optional)</option>
            {FEATURE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none" />
        </div>
      </Field>
      <Field label="Beschreibung" required>
        <textarea className={textareaCls} rows={5} value={description} onChange={e => setDescription(e.target.value)}
          maxLength={3000} placeholder="Was soll das Feature tun? Warum wäre es nützlich?" />
        <div className="text-right text-[11px] text-[var(--color-muted-2)] mt-1">{description.length} / 3000</div>
      </Field>
      <NpsRating value={nps} onChange={onNps} />
      <button type="submit" disabled={submitting}
        className="flex items-center gap-2 h-9 px-5 text-[13px] font-semibold rounded-[var(--radius-md)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        style={{ background: '#a78bfa' }}
      >
        {submitting && <Loader2 size={13} className="animate-spin" />}
        {submitting ? 'Wird gesendet…' : 'Feedback senden'}
      </button>
    </form>
  );
}

// ─── Bug form ─────────────────────────────────────────────────────────────────

function BugForm({ onSubmit, submitting }: {
  onSubmit: (data: Record<string, string>) => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [analysisId, setAnalysisId] = useState('');
  const [browser, setBrowser] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !steps.trim()) { toast.error('Bitte Titel und Schritte ausfüllen.'); return; }
    onSubmit({ title, steps, expected, actual, analysisId, browser });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Fehlertitel" required>
        <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)}
          maxLength={200} placeholder="Kurze Beschreibung des Fehlers" />
      </Field>
      <Field label="Schritte zum Reproduzieren" required>
        <textarea className={textareaCls} rows={4} value={steps} onChange={e => setSteps(e.target.value)}
          maxLength={2000} placeholder={'1. Öffne die Analyse-Seite\n2. Lade eine Datei hoch\n3. Klicke auf …'} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Erwartetes Verhalten">
          <textarea className={textareaCls} rows={3} value={expected} onChange={e => setExpected(e.target.value)}
            maxLength={500} placeholder="Was hättest du erwartet?" />
        </Field>
        <Field label="Tatsächliches Verhalten">
          <textarea className={textareaCls} rows={3} value={actual} onChange={e => setActual(e.target.value)}
            maxLength={500} placeholder="Was ist stattdessen passiert?" />
        </Field>
      </div>
      <Field label="Analyse-ID (optional)">
        <div className="relative">
          <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input className={inputCls + ' pl-8'} value={analysisId} onChange={e => setAnalysisId(e.target.value)}
            placeholder="z.B. aus dem Verlauf kopieren" maxLength={100} />
        </div>
        <div className="text-[11px] text-[var(--color-muted-2)] mt-1">
          Falls der Fehler zu einer bestimmten Analyse gehört, hilft die ID bei der Diagnose.
        </div>
      </Field>
      <Field label="Browser">
        <div className="relative">
          <select className={inputCls + ' appearance-none pr-8 cursor-pointer'} value={browser} onChange={e => setBrowser(e.target.value)}>
            <option value="">Browser wählen (optional)</option>
            {BROWSERS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none" />
        </div>
      </Field>
      <button type="submit" disabled={submitting}
        className="flex items-center gap-2 h-9 px-5 text-[13px] font-semibold rounded-[var(--radius-md)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        style={{ background: 'var(--color-danger)' }}
      >
        {submitting && <Loader2 size={13} className="animate-spin" />}
        {submitting ? 'Wird gesendet…' : 'Bug melden'}
      </button>
    </form>
  );
}

// ─── General form ─────────────────────────────────────────────────────────────

function GeneralForm({ nps, onNps, onSubmit, submitting }: {
  nps: number | null;
  onNps: (v: number) => void;
  onSubmit: (data: Record<string, string>) => void;
  submitting: boolean;
}) {
  const [message, setMessage] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) { toast.error('Bitte Nachricht ausfüllen.'); return; }
    onSubmit({ message });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Dein Feedback" required>
        <textarea className={textareaCls} rows={6} value={message} onChange={e => setMessage(e.target.value)}
          maxLength={3000} placeholder="Teile uns mit, was dir gefällt, was dich stört oder was du dir wünschst…" />
        <div className="text-right text-[11px] text-[var(--color-muted-2)] mt-1">{message.length} / 3000</div>
      </Field>
      <NpsRating value={nps} onChange={onNps} />
      <button type="submit" disabled={submitting}
        className="flex items-center gap-2 h-9 px-5 text-[13px] font-semibold rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {submitting && <Loader2 size={13} className="animate-spin" />}
        {submitting ? 'Wird gesendet…' : 'Feedback senden'}
      </button>
    </form>
  );
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessState({ mode, onReset }: { mode: FeedbackMode; onReset: () => void }) {
  const msgs: Record<FeedbackMode, { title: string; sub: string }> = {
    feature: { title: 'Feature-Wunsch eingegangen!', sub: 'Wir prüfen alle Vorschläge und berücksichtigen sie in unserer Roadmap.' },
    bug:     { title: 'Bug gemeldet — danke!', sub: 'Wir untersuchen den Fehler so bald wie möglich.' },
    general: { title: 'Feedback erhalten — danke!', sub: 'Jedes Feedback hilft uns, AIRealCheck besser zu machen.' },
  };
  const { title, sub } = msgs[mode];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 gap-4 text-center"
    >
      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--color-success)' + '20' }}>
        <CheckCircle2 size={30} style={{ color: 'var(--color-success)' }} />
      </div>
      <div>
        <div className="text-[16px] font-semibold text-[var(--color-text)]">{title}</div>
        <div className="text-[13px] text-[var(--color-muted)] mt-1.5 max-w-sm">{sub}</div>
      </div>
      <button onClick={onReset} className="text-[12px] text-[var(--color-primary)] hover:underline">
        Weiteres Feedback senden
      </button>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<FeedbackMode>('feature');
  const [nps, setNps] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(_data: Record<string, string>) {
    setSubmitting(true);
    // Simulate submission — backend feedback persistence planned for next phase
    await new Promise(r => setTimeout(r, 1100));
    setSubmitting(false);
    setDone(true);
  }

  function handleReset() {
    setDone(false);
    setNps(null);
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10 space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-[24px] font-bold text-[var(--color-text)]">Feedback</h1>
        <p className="text-[14px] text-[var(--color-muted)] mt-1">
          Dein Feedback hilft uns, AIRealCheck weiterzuentwickeln.
          {user?.display_name && <> Danke, <strong>{user.display_name.split(' ')[0]}</strong>!</>}
        </p>
      </motion.div>

      {/* ── Mode selector ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.3 }}
        className="grid grid-cols-3 gap-3"
      >
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setDone(false); }}
            className={`flex flex-col items-center gap-2 p-4 rounded-[var(--radius-xl)] border text-center transition-all ${
              mode === m.id
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center" style={{ background: m.color + '20' }}>
              <m.icon size={18} style={{ color: m.color }} />
            </div>
            <div className="text-[12px] font-semibold text-[var(--color-text)]">{m.label}</div>
            <div className="text-[10px] text-[var(--color-muted-2)] leading-snug">{m.desc}</div>
          </button>
        ))}
      </motion.div>

      {/* ── Form card ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)]">
          {(() => {
            const m = MODES.find(x => x.id === mode)!;
            return <><m.icon size={15} style={{ color: m.color }} /><div className="text-[13px] font-semibold text-[var(--color-text)]">{m.label}</div></>;
          })()}
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {done ? (
              <SuccessState key="success" mode={mode} onReset={handleReset} />
            ) : (
              <motion.div key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {mode === 'feature' && <FeatureForm nps={nps} onNps={setNps} onSubmit={handleSubmit} submitting={submitting} />}
                {mode === 'bug'     && <BugForm onSubmit={handleSubmit} submitting={submitting} />}
                {mode === 'general' && <GeneralForm nps={nps} onNps={setNps} onSubmit={handleSubmit} submitting={submitting} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {!done && (
        <p className="text-[11px] text-[var(--color-muted-2)] text-center">
          Feedback wird anonym verarbeitet. Keine persönlichen Daten werden ohne Zustimmung weitergegeben.
        </p>
      )}
    </div>
  );
}
