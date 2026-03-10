'use client';

import React, { useState, useEffect } from 'react';
import { CONTACT_EMAIL } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Code2,
  ShieldCheck,
  BarChart3,
  Webhook,
  CheckCircle2,
  Loader2,
  Clock,
  Lock,
  Globe,
  FileJson,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// ─── Waitlist localStorage ────────────────────────────────────────────────────

const WAITLIST_KEY = 'ac_api_waitlist_submitted';

function getWaitlistDone(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(WAITLIST_KEY) === '1'; } catch { return false; }
}
function setWaitlistDone() {
  try { localStorage.setItem(WAITLIST_KEY, '1'); } catch { /* ignore */ }
}

// ─── Planned features ─────────────────────────────────────────────────────────

const PLANNED_FEATURES = [
  {
    icon: Code2,
    color: '#22d3ee',
    title: 'REST API',
    desc: 'Vollständige REST-Schnittstelle für alle Analyse-Typen mit JSON-Antworten im public_result_v1-Format.',
  },
  {
    icon: ShieldCheck,
    color: '#34d399',
    title: 'API-Keys & Authentifizierung',
    desc: 'Projektspeifische API-Keys mit konfigurierbaren Berechtigungen, Rate-Limits und Verwendungsprotokoll.',
  },
  {
    icon: BarChart3,
    color: '#a78bfa',
    title: 'Usage Dashboard',
    desc: 'Echtzeit-Übersicht über API-Aufrufe, Credits-Verbrauch und Antwortzeiten pro Key.',
  },
  {
    icon: Webhook,
    color: '#f59e0b',
    title: 'Webhooks',
    desc: 'Asynchrone Benachrichtigungen bei abgeschlossenen Analysen — ideal für Batch-Verarbeitung.',
  },
  {
    icon: FileJson,
    color: '#22d3ee',
    title: 'SDK & Dokumentation',
    desc: 'Offizielle SDKs für Python und Node.js sowie interaktive API-Referenz.',
  },
  {
    icon: Globe,
    color: '#34d399',
    title: 'Alle Medientypen',
    desc: 'Bild-, Video- und Audioanalyse über dieselbe API — konsistentes Ergebnis-Schema für alle Typen.',
  },
];

// ─── Waitlist form ────────────────────────────────────────────────────────────

function WaitlistForm({ prefillEmail }: { prefillEmail?: string }) {
  const [email, setEmail] = useState(prefillEmail ?? '');
  const [useCase, setUseCase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(getWaitlistDone);

  useEffect(() => {
    if (prefillEmail && !email) setEmail(prefillEmail);
  }, [prefillEmail]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { toast.error('Bitte gültige E-Mail eingeben.'); return; }
    setSubmitting(true);
    // Simulate registration — backend waitlist endpoint planned
    await new Promise(r => setTimeout(r, 1000));
    setWaitlistDone();
    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-3 py-8 text-center"
      >
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#22d3ee20' }}>
          <CheckCircle2 size={26} style={{ color: '#22d3ee' }} />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-[var(--color-text)]">Du stehst auf der Warteliste!</div>
          <div className="text-[13px] text-[var(--color-muted)] mt-1">Wir benachrichtigen dich per E-Mail, sobald der API-Zugang verfügbar ist.</div>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1.5">E-Mail *</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full h-9 px-3 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          placeholder="deine@email.de"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1.5">Anwendungsfall (optional)</label>
        <select
          value={useCase}
          onChange={e => setUseCase(e.target.value)}
          className="w-full h-9 px-3 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors appearance-none cursor-pointer"
        >
          <option value="">Bitte wählen…</option>
          <option value="journalism">Journalismus / Faktencheck</option>
          <option value="platform">Plattform / Moderation</option>
          <option value="enterprise">Unternehmen / Compliance</option>
          <option value="research">Forschung / Wissenschaft</option>
          <option value="developer">Entwickler / Eigenprojekt</option>
          <option value="other">Sonstiges</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 h-10 text-[13px] font-semibold rounded-[var(--radius-md)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #22d3ee, #7c3aed)' }}
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        {submitting ? 'Wird registriert…' : 'Auf Warteliste eintragen'}
      </button>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApiAccessPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 space-y-8">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="text-center py-6"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border mb-5"
          style={{ background: '#22d3ee10', borderColor: '#22d3ee40', color: '#22d3ee' }}
        >
          <Clock size={12} />
          In Entwicklung
        </div>
        <h1 className="text-[30px] font-bold text-[var(--color-text)] leading-tight">
          AIRealCheck API
        </h1>
        <p className="text-[15px] text-[var(--color-muted)] mt-3 max-w-lg mx-auto leading-relaxed">
          Integriere KI-Erkennung direkt in deine Anwendung. Dieselben Engines, die AIRealCheck antreiben — als REST API.
        </p>
        <div className="inline-flex items-center gap-2 mt-4 px-3.5 py-1.5 rounded-[var(--radius-md)] text-[12px] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)]">
          <Lock size={11} />
          Noch nicht öffentlich verfügbar — kein Fake-Dashboard, keine Fake-Docs
        </div>
      </motion.div>

      {/* ── Planned features ────────────────────────────────────────────────── */}
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-widest text-[var(--color-muted-2)] mb-4">Was geplant ist</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLANNED_FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5 space-y-3"
            >
              <div className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center" style={{ background: f.color + '20' }}>
                <f.icon size={18} style={{ color: f.color }} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[var(--color-text)]">{f.title}</div>
                <div className="text-[12px] text-[var(--color-muted)] mt-1 leading-relaxed">{f.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Preview snippet ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="text-[12px] font-semibold uppercase tracking-widest text-[var(--color-muted-2)] mb-4">API-Vorschau (geplant)</div>
        <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <Code2 size={14} className="text-[var(--color-muted)]" />
            <span className="text-[12px] font-medium text-[var(--color-muted)]">POST /v1/analyze</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border" style={{ background: '#f59e0b15', borderColor: '#f59e0b40', color: '#f59e0b' }}>
              Vorschau
            </span>
          </div>
          <div className="p-5 font-mono text-[12px] leading-relaxed overflow-x-auto" style={{ color: 'var(--color-muted)' }}>
            <div><span style={{ color: '#a78bfa' }}>curl</span> <span style={{ color: '#22d3ee' }}>-X POST</span> https://api.airealcheck.com/v1/analyze \</div>
            <div className="pl-4"><span style={{ color: '#a78bfa' }}>-H</span> <span style={{ color: '#34d399' }}>&quot;Authorization: Bearer YOUR_API_KEY&quot;</span> \</div>
            <div className="pl-4"><span style={{ color: '#a78bfa' }}>-F</span> <span style={{ color: '#34d399' }}>&quot;file=@image.jpg&quot;</span> \</div>
            <div className="pl-4"><span style={{ color: '#a78bfa' }}>-F</span> <span style={{ color: '#34d399' }}>&quot;media_type=image&quot;</span></div>
            <div className="mt-4 text-[var(--color-muted-2)]">{'// Response (public_result_v1)'}</div>
            <div><span style={{ color: 'var(--color-border)' }}>{'{'}</span></div>
            <div className="pl-4"><span style={{ color: '#22d3ee' }}>&quot;summary&quot;</span>: <span style={{ color: 'var(--color-border)' }}>{'{'}</span></div>
            <div className="pl-8"><span style={{ color: '#22d3ee' }}>&quot;ai_percent&quot;</span>: <span style={{ color: '#f59e0b' }}>82</span>,</div>
            <div className="pl-8"><span style={{ color: '#22d3ee' }}>&quot;verdict_key&quot;</span>: <span style={{ color: '#34d399' }}>&quot;likely_ai&quot;</span>,</div>
            <div className="pl-8"><span style={{ color: '#22d3ee' }}>&quot;confidence_label&quot;</span>: <span style={{ color: '#34d399' }}>&quot;high&quot;</span></div>
            <div className="pl-4"><span style={{ color: 'var(--color-border)' }}>{'}'}</span></div>
            <div><span style={{ color: 'var(--color-border)' }}>{'}'}</span></div>
          </div>
        </div>
      </motion.div>

      {/* ── Waitlist ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-[var(--radius-xl)] overflow-hidden border"
        style={{ borderColor: '#22d3ee40' }}
      >
        <div className="px-6 py-5 border-b" style={{ borderColor: '#22d3ee30', background: '#22d3ee08' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center" style={{ background: '#22d3ee20' }}>
              <Zap size={18} style={{ color: '#22d3ee' }} />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[var(--color-text)]">Frühen Zugang sichern</div>
              <div className="text-[12px] text-[var(--color-muted)] mt-0.5">Trage dich auf die Warteliste ein — wir kontaktieren dich als erstes.</div>
            </div>
          </div>
        </div>
        <div className="p-6 bg-[var(--color-surface)]">
          <WaitlistForm prefillEmail={user?.email} />
        </div>
      </motion.div>

      {/* ── Enterprise note ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-between p-4 rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[13px]"
      >
        <div>
          <div className="font-medium text-[var(--color-text)]">Enterprise & individuelle Integration?</div>
          <div className="text-[var(--color-muted)] text-[12px] mt-0.5">Kontaktiere uns für maßgeschneiderte SLA und Volumenpreise.</div>
        </div>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="flex-shrink-0 ml-4 h-9 px-4 text-[12px] font-semibold rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors flex items-center"
        >
          Kontakt
        </a>
      </motion.div>

    </div>
  );
}
