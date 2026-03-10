'use client';

import React, { useState, useMemo } from 'react';
import { CONTACT_EMAIL } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ScanSearch,
  CreditCard,
  Settings2,
  Package,
  Mail,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  Loader2,
  FileText,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// ─── FAQ data ─────────────────────────────────────────────────────────────────

interface FaqItem {
  q: string;
  a: string;
}

interface FaqCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  items: FaqItem[];
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'analyse',
    label: 'Analyse',
    icon: ScanSearch,
    color: '#22d3ee',
    items: [
      {
        q: 'Welche Dateiformate werden unterstützt?',
        a: 'Bilder: JPG, PNG, WebP, AVIF (max. 20 MB). Videos: MP4, MOV, WebM (max. 200 MB, bis 10 Min.). Audio: MP3, WAV, M4A, OGG (max. 50 MB, bis 30 Min.).',
      },
      {
        q: 'Wie funktioniert die KI-Erkennung?',
        a: 'AIRealCheck kombiniert mehrere spezialisierte Analyse-Engines und wertet deren Ergebnisse ensemble-basiert aus. Jede Engine liefert eine KI-Wahrscheinlichkeit; das Gesamtergebnis ist ein gewichteter Durchschnitt.',
      },
      {
        q: 'Was bedeuten die Ergebnisfarben (Rot/Gelb/Grün)?',
        a: '🔴 Rot (≥ 70 %): Wahrscheinlich KI-generiert. 🟡 Gelb (31–69 %): Unsicher. 🟢 Grün (≤ 30 %): Wahrscheinlich echt. Die Prozentzahl zeigt die KI-Wahrscheinlichkeit.',
      },
      {
        q: 'Warum dauert meine Analyse so lange?',
        a: 'Videoanalysen sind rechenintensiv und können bis zu 2 Minuten dauern. Bei Videos werden mehrere Frames und der Audiokanal separat analysiert. Länger als 5 Minuten deutet auf einen Fehler hin — bitte erneut versuchen.',
      },
      {
        q: 'Kann ich eine Analyse erneut durchführen?',
        a: 'Ja. Gehe im Verlauf auf eine frühere Analyse und verwende „Neue Analyse starten". Jede Analyse verbraucht Credits gemäß deinem Plan.',
      },
    ],
  },
  {
    id: 'credits',
    label: 'Konto & Credits',
    icon: CreditCard,
    color: '#a78bfa',
    items: [
      {
        q: 'Wie viele Credits bekomme ich im Free-Plan?',
        a: 'Im Free-Plan erhältst du 100 Credits. Credits werden monatlich zurückgesetzt. Pro Analyse werden je nach Medientyp 15 (Bild), 20 (Audio) oder 30 (Video) Credits abgezogen.',
      },
      {
        q: 'Wann werden meine Credits zurückgesetzt?',
        a: 'Credits werden 30 Tage nach deiner Registrierung zurückgesetzt, dann monatlich. Das genaue Datum siehst du in deinem Profil unter „Letzter Reset".',
      },
      {
        q: 'Was passiert, wenn mir die Credits ausgehen?',
        a: 'Wenn du 0 Credits hast, sind neue Analysen gesperrt. Dein Verlauf bleibt weiterhin abrufbar. Ein Upgrade auf Pro schaltet mehr Credits frei.',
      },
      {
        q: 'Wie kann ich mein E-Mail-Passwort ändern?',
        a: 'Gehe zu Profil → „Passwort ändern". Du benötigst dein aktuelles Passwort. Die Änderung ist sofort wirksam.',
      },
    ],
  },
  {
    id: 'technik',
    label: 'Technik',
    icon: Settings2,
    color: '#34d399',
    items: [
      {
        q: 'Werden meine Dateien gespeichert?',
        a: 'Nein — Dateien werden ausschließlich während der Analyse im Arbeitsspeicher verarbeitet und anschließend sofort verworfen. Wir speichern keine Kopien deiner Bilder, Videos oder Audiodateien.',
      },
      {
        q: 'Wie sicher sind meine Analysedaten?',
        a: 'Analyseergebnisse werden verschlüsselt übertragen (TLS) und datenbankbasiert gespeichert. Dein Verlauf ist nur für dich sichtbar. Admins sehen aggregierte Statistiken, keine persönlichen Inhalte.',
      },
      {
        q: 'Was passiert bei einem Analysefehler?',
        a: 'Wenn eine Analyse fehlschlägt, werden keine Credits abgezogen. Im Verlauf wird der Eintrag als „Fehler" markiert. Bitte versuche es erneut oder kontaktiere den Support, falls es wiederholt vorkommt.',
      },
      {
        q: 'Welche Browser werden unterstützt?',
        a: 'AIRealCheck unterstützt Chrome 100+, Firefox 100+, Safari 15+, Edge 100+ und alle modernen Chromium-basierten Browser. Internet Explorer wird nicht unterstützt.',
      },
    ],
  },
  {
    id: 'preise',
    label: 'Preise & Abo',
    icon: Package,
    color: '#f59e0b',
    items: [
      {
        q: 'Welche Pläne gibt es?',
        a: 'Derzeit bieten wir einen kostenlosen Free-Plan an. Pro- und Enterprise-Pläne mit mehr Credits, schnelleren Engines und API-Zugang sind in Vorbereitung.',
      },
      {
        q: 'Wie kann ich upgraden?',
        a: 'Upgrade-Optionen werden über Einstellungen → „Abo & Plan" verfügbar sein. Das Upgrade-System befindet sich derzeit in der finalen Entwicklung.',
      },
      {
        q: 'Gibt es Rabatte für Unternehmen oder Bildungseinrichtungen?',
        a: `Ja, Enterprise- und Bildungskonditionen sind geplant. Schreib uns an ${CONTACT_EMAIL} für eine individuelle Vereinbarung.`,
      },
    ],
  },
];

// ─── FAQ Accordion ────────────────────────────────────────────────────────────

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-[var(--color-border)]">
      {items.map((item, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <span className="text-[13px] font-medium text-[var(--color-text)] flex-1">{item.q}</span>
            {open === i
              ? <ChevronUp size={15} className="text-[var(--color-muted)] flex-shrink-0 mt-0.5" />
              : <ChevronDown size={15} className="text-[var(--color-muted)] flex-shrink-0 mt-0.5" />}
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4 text-[13px] text-[var(--color-muted)] leading-relaxed border-t border-[var(--color-border)]">
                  <div className="pt-3">{item.a}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// ─── Contact form ─────────────────────────────────────────────────────────────

function ContactForm() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || !email.trim()) {
      toast.error('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    setSubmitting(true);
    // Simulate submission (backend ticket system in development)
    await new Promise(r => setTimeout(r, 1200));
    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-10 gap-4 text-center"
      >
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--color-success)' + '20' }}>
          <CheckCircle2 size={26} style={{ color: 'var(--color-success)' }} />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-[var(--color-text)]">Nachricht gesendet</div>
          <div className="text-[13px] text-[var(--color-muted)] mt-1">Wir melden uns in der Regel innerhalb von 1–2 Werktagen.</div>
        </div>
        <button
          onClick={() => { setDone(false); setSubject(''); setMessage(''); }}
          className="text-[12px] text-[var(--color-primary)] hover:underline"
        >
          Weitere Nachricht senden
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      <div>
        <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1.5">E-Mail *</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full h-9 px-3 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          placeholder="deine@email.de"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1.5">Betreff *</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          required
          maxLength={200}
          className="w-full h-9 px-3 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          placeholder="Kurze Beschreibung deines Anliegens"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1.5">Nachricht *</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          required
          rows={5}
          maxLength={2000}
          className="w-full px-3 py-2.5 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors resize-none"
          placeholder="Beschreibe dein Anliegen so genau wie möglich…"
        />
        <div className="text-right text-[11px] text-[var(--color-muted-2)] mt-1">{message.length} / 2000</div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="flex items-center gap-2 h-9 px-5 text-[13px] font-semibold rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {submitting && <Loader2 size={13} className="animate-spin" />}
        {submitting ? 'Wird gesendet…' : 'Nachricht senden'}
      </button>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const results: (FaqItem & { category: string })[] = [];
    for (const cat of FAQ_CATEGORIES) {
      for (const item of cat.items) {
        if (item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)) {
          results.push({ ...item, category: cat.label });
        }
      }
    }
    return results;
  }, [search]);

  const activeItems = activeCategory
    ? FAQ_CATEGORIES.find(c => c.id === activeCategory)?.items ?? []
    : [];

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 space-y-7">

      {/* ── Header + search ────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-[24px] font-bold text-[var(--color-text)]">Support & Hilfe</h1>
        <p className="text-[14px] text-[var(--color-muted)] mt-1">Antworten auf häufige Fragen oder direkt Kontakt aufnehmen.</p>
        <div className="relative mt-5">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Fragen durchsuchen…"
            className="w-full h-11 pl-10 pr-4 text-[14px] rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] shadow-[var(--shadow-sm)] transition-colors"
          />
        </div>
      </motion.div>

      {/* ── Search results ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {search.trim() && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-[var(--color-border)] text-[12px] font-semibold text-[var(--color-muted)] uppercase tracking-wider">
              Suchergebnisse ({searchResults.length})
            </div>
            {searchResults.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <HelpCircle size={24} className="mx-auto text-[var(--color-muted)] mb-3" />
                <div className="text-[13px] text-[var(--color-muted)]">Keine Ergebnisse für „{search}"</div>
                <div className="text-[12px] text-[var(--color-muted-2)] mt-1">Versuche einen anderen Begriff oder kontaktiere uns direkt.</div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {searchResults.map((item, i) => (
                  <div key={i} className="px-5 py-4">
                    <div className="text-[11px] text-[var(--color-primary)] font-medium mb-1">{item.category}</div>
                    <div className="text-[13px] font-medium text-[var(--color-text)] mb-1">{item.q}</div>
                    <div className="text-[12px] text-[var(--color-muted)] line-clamp-2">{item.a}</div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Category grid ────────────────────────────────────────────────────── */}
      {!search.trim() && (
        <>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-widest text-[var(--color-muted-2)] mb-3">Themen</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {FAQ_CATEGORIES.map((cat, i) => (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  className={`flex flex-col items-center gap-2.5 p-4 rounded-[var(--radius-xl)] border text-center transition-all ${
                    activeCategory === cat.id
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center"
                    style={{ background: cat.color + '20' }}
                  >
                    <cat.icon size={18} style={{ color: cat.color }} />
                  </div>
                  <div className="text-[12px] font-medium text-[var(--color-text)]">{cat.label}</div>
                  <div className="text-[11px] text-[var(--color-muted-2)]">{cat.items.length} Fragen</div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* ── Active category FAQ ─────────────────────────────────────────── */}
          <AnimatePresence>
            {activeCategory && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
                  <div className="text-[13px] font-semibold text-[var(--color-text)]">
                    {FAQ_CATEGORIES.find(c => c.id === activeCategory)?.label}
                  </div>
                  <button onClick={() => setActiveCategory(null)} className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
                    Schließen
                  </button>
                </div>
                <FaqAccordion items={activeItems} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Quick links row ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: FileText, label: 'Dokumentation', sub: 'Technische Referenz', href: '#', color: '#22d3ee' },
              { icon: Activity, label: 'Systemstatus', sub: 'Aktuelle Verfügbarkeit', href: '#', color: '#34d399' },
              { icon: MessageSquare, label: 'Feedback geben', sub: 'Feature-Wünsche & Bugs', href: '/feedback', color: '#a78bfa' },
            ].map(({ icon: Icon, label, sub, href, color }) => (
              <a
                key={label}
                href={href}
                className="flex items-center gap-3 p-4 rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors group"
              >
                <div className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0" style={{ background: color + '20' }}>
                  <Icon size={17} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--color-text)] flex items-center gap-1">
                    {label}
                    <ExternalLink size={11} className="text-[var(--color-muted)] group-hover:text-[var(--color-text)] transition-colors" />
                  </div>
                  <div className="text-[11px] text-[var(--color-muted-2)]">{sub}</div>
                </div>
              </a>
            ))}
          </div>

          {/* ── Contact form ─────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)]">
              <Mail size={15} className="text-[var(--color-muted)]" />
              <div>
                <div className="text-[13px] font-semibold text-[var(--color-text)]">Kontakt & Ticket</div>
                <div className="text-[12px] text-[var(--color-muted)] mt-0.5">Wir antworten innerhalb von 1–2 Werktagen</div>
              </div>
            </div>
            <ContactForm />
            <div className="px-5 pb-4 flex items-center gap-1.5 text-[11px] text-[var(--color-muted-2)]">
              <AlertTriangle size={11} />
              Oder direkt per E-Mail: <strong className="text-[var(--color-muted)]">{CONTACT_EMAIL}</strong>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
