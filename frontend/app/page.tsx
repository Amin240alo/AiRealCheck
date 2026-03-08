'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ScanSearch, Shield, BarChart3, History, ChevronRight, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/spinner';

export default function LandingPage() {
  const router = useRouter();
  const { isLoggedIn, loading } = useAuth();

  useEffect(() => {
    if (!loading && isLoggedIn) router.replace('/dashboard');
  }, [isLoggedIn, loading, router]);

  if (loading) {
    return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (isLoggedIn) return null;

  const features = [
    { icon: ScanSearch, title: 'Analyse von Bildern, Videos und Audio', desc: 'Ein Workflow für alle gängigen Medientypen inklusive klarer Ergebnisse.' },
    { icon: Shield, title: 'Mehrere KI-Detektoren im Ensemble', desc: 'Kombiniert spezialisierte Engines für robuste, nachvollziehbare Resultate.' },
    { icon: BarChart3, title: 'Klare Wahrscheinlichkeit & Risiko', desc: 'Verständliche Scores und Konfidenz statt kryptischer Daten.' },
    { icon: History, title: 'Transparente Detailanalyse', desc: 'Signale und Hinweise machen Entscheidungen nachvollziehbar.' },
  ];

  const faqs = [
    { q: 'Wie funktioniert die Analyse?', a: 'AIRealCheck kombiniert mehrere spezialisierte Detektoren und fasst die Ergebnisse zu einer Wahrscheinlichkeit zusammen.' },
    { q: 'Welche Dateitypen werden unterstützt?', a: 'Bilder (JPG, PNG, WebP), Videos (MP4, MOV, WebM) und Audio (MP3, WAV, M4A).' },
    { q: 'Was sind Credits?', a: 'Credits sind Einheiten für Analysen: Bild 10, Video 25, Audio 15 Credits.' },
    { q: 'Kann ich kostenlos testen?', a: 'Ja. Neue Accounts starten mit 100 Credits, damit du mehrere Analysen ausprobieren kannst.' },
  ];

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Nav */}
      <nav className="sticky top-0 z-20 flex items-center justify-between h-16 px-6 bg-[var(--color-bg)] border-b border-[var(--color-border)]" style={{ backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Assets/Logos/airealcheck-secondary.png" alt="AIRealCheck" className="h-7 object-contain" />
        </div>
        <div className="hidden md:flex items-center gap-6 text-[13px] text-[var(--color-muted)]">
          <a href="#features" className="hover:text-[var(--color-text)] transition-colors">Features</a>
          <a href="#how" className="hover:text-[var(--color-text)] transition-colors">So funktioniert es</a>
          <a href="#faq" className="hover:text-[var(--color-text)] transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="h-8 px-3 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">Login</Link>
          <Link href="/register" className="h-8 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-medium hover:bg-[var(--color-primary-hover)] transition-colors flex items-center">Kostenlos starten</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary-muted)] text-[var(--color-primary)] text-[12px] font-medium mb-6">
              <span>AIRealCheck</span>
              <span className="w-px h-3 bg-[var(--color-primary)] opacity-40" />
              <span>KI-Erkennung für alle</span>
            </div>
            <h1 className="text-[42px] md:text-[56px] font-bold leading-tight mb-6 tracking-tight">
              Erkenne KI-generierte
              <br />
              <span style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Inhalte in Sekunden
              </span>
            </h1>
            <p className="text-[17px] text-[var(--color-muted)] mb-8 max-w-xl mx-auto leading-relaxed">
              AIRealCheck analysiert Bilder, Videos und Audio mit mehreren KI-Detektoren gleichzeitig und liefert klare, nachvollziehbare Ergebnisse.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/register" className="inline-flex items-center gap-2 h-12 px-8 rounded-[var(--radius-lg)] bg-[var(--color-primary)] text-white text-[14px] font-semibold hover:bg-[var(--color-primary-hover)] transition-all shadow-[0_4px_20px_rgba(59,130,246,0.4)]">
                Kostenlos starten <ChevronRight size={16} />
              </Link>
              <Link href="/login" className="inline-flex items-center h-12 px-8 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-[14px] font-medium hover:bg-[var(--color-surface-2)] transition-colors">
                Login
              </Link>
            </div>
            <div className="flex items-center justify-center gap-4 mt-6 text-[12px] text-[var(--color-muted)]">
              {['100 kostenlose Credits', 'Mehrere Engines', 'Sofort-Analyse'].map(t => (
                <div key={t} className="flex items-center gap-1.5"><CheckCircle size={12} className="text-[var(--color-success)]" />{t}</div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-[32px] font-bold mb-3">AIRealCheck hilft dir dabei</h2>
            <p className="text-[var(--color-muted)]">Wir kombinieren mehrere Detektoren für nachvollziehbare, verlässliche Ergebnisse.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="flex items-start gap-4 p-6 rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-2)] transition-all">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-muted)] flex items-center justify-center flex-shrink-0">
                  <f.icon size={20} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--color-text)] mb-1">{f.title}</h3>
                  <p className="text-[13px] text-[var(--color-muted)] leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 px-6 bg-[var(--color-surface)]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-[32px] font-bold mb-3">So funktioniert es</h2>
          <p className="text-[var(--color-muted)] mb-12">In drei klaren Schritten von der Datei bis zum Ergebnis.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { n: '1', title: 'Datei hochladen', desc: 'Wähle Bild, Video oder Audio und starte die Prüfung.' },
              { n: '2', title: 'KI analysiert', desc: 'Mehrere Engines bewerten den Inhalt parallel.' },
              { n: '3', title: 'Ergebnis erhalten', desc: 'Klare Ergebnisse plus nachvollziehbare Details.' },
            ].map((step, i) => (
              <motion.div key={step.n} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center text-center p-6 rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white text-[16px] font-bold flex items-center justify-center mb-4">{step.n}</div>
                <h3 className="text-[14px] font-semibold mb-2">{step.title}</h3>
                <p className="text-[13px] text-[var(--color-muted)]">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-[32px] font-bold mb-3">FAQ</h2>
            <p className="text-[var(--color-muted)]">Häufig gestellte Fragen.</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.details key={faq.q} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="group rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-[14px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors list-none">
                  {faq.q}
                  <ChevronRight size={16} className="text-[var(--color-muted)] group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-5 pb-4 text-[13px] text-[var(--color-muted)] leading-relaxed">{faq.a}</div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] p-10" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))' }}>
            <h2 className="text-[28px] font-bold mb-3">Starte jetzt kostenlos</h2>
            <p className="text-[var(--color-muted)] mb-8">Starte mit 100 Credits und erhalte sofort nachvollziehbare Ergebnisse.</p>
            <Link href="/register" className="inline-flex items-center gap-2 h-12 px-10 rounded-[var(--radius-lg)] bg-[var(--color-primary)] text-white text-[14px] font-semibold hover:bg-[var(--color-primary-hover)] transition-all shadow-[0_4px_20px_rgba(59,130,246,0.3)]">
              Account erstellen <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="text-[14px] font-semibold text-[var(--color-text)] mb-3">AIRealCheck</div>
              <p className="text-[12px] text-[var(--color-muted)]">Vertrauen in digitale Medien durch KI-Analyse.</p>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-2)] mb-3">Produkt</div>
              {['Features', 'So funktioniert es', 'Kostenlos starten'].map(t => (
                <a key={t} href={`#${t.toLowerCase().replace(/ /g, '-')}`} className="block text-[12px] text-[var(--color-muted)] hover:text-[var(--color-text)] mb-1.5 transition-colors">{t}</a>
              ))}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-2)] mb-3">Account</div>
              {[['Login', '/login'], ['Registrierung', '/register'], ['Support', '/support']].map(([t, h]) => (
                <Link key={t} href={h} className="block text-[12px] text-[var(--color-muted)] hover:text-[var(--color-text)] mb-1.5 transition-colors">{t}</Link>
              ))}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-2)] mb-3">Rechtliches</div>
              {[['Datenschutz', '/legal?section=privacy'], ['Impressum', '/legal?section=impressum'], ['AGB', '/legal?section=tac']].map(([t, h]) => (
                <Link key={t} href={h} className="block text-[12px] text-[var(--color-muted)] hover:text-[var(--color-text)] mb-1.5 transition-colors">{t}</Link>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--color-border)] pt-6 text-center text-[11px] text-[var(--color-muted-2)]">
            © 2026 AIRealCheck. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
