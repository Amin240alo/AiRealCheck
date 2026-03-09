'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    q: 'Welche Content-Typen erkennt AIRealCheck?',
    a: 'AIRealCheck analysiert Bilder, Video-Content und Audio-Aufnahmen auf KI-Generierung. Die Analyse läuft über spezialisierte Engines, die je nach Format relevante technische Signale prüfen.',
  },
  {
    q: 'Wie genau ist die Erkennung?',
    a: 'AIRealCheck kombiniert 6+ spezialisierte Detektoren über ein Ensemble-System. Das reduziert False-Positives und erhöht die Zuverlässigkeit gegenüber einzelnen Modellen deutlich. Genauigkeit variiert je nach Content-Typ und Generierungsverfahren.',
  },
  {
    q: 'Was bedeutet der Confidence-Score?',
    a: 'Der Confidence-Score zeigt, wie sicher das Ensemble in seiner Einschätzung ist — unabhängig vom AI-Wahrscheinlichkeitswert. Hohe Confidence + hohe AI-Wahrscheinlichkeit = starkes Signal. Niedrige Confidence bedeutet: mehr Kontext prüfen.',
  },
  {
    q: 'Was ist Model-Level Output?',
    a: 'Du siehst nicht nur ein Gesamtergebnis, sondern wie jeder einzelne Detektor reagiert hat. Das ermöglicht fundierte Entscheidungen statt blinder Akzeptanz eines Schwarze-Box-Scores.',
  },
  {
    q: 'Für wen ist AIRealCheck gedacht?',
    a: 'Für Journalisten, Agenturen, Unternehmen und Creator — alle, die professionell mit digitalem Bildmaterial arbeiten und Authentizität prüfen müssen.',
  },
  {
    q: 'Was sind Credits und wie lange halten sie?',
    a: 'Credits sind Analyse-Einheiten. Du startest mit 100 kostenlosen Credits. Monatliche Plan-Credits werden je Abrechnungsperiode zurückgesetzt. Einzelne Bildanalysen kosten 10 Credits.',
  },
  {
    q: 'Brauche ich ein Konto für die Analyse?',
    a: 'Ja, ein kostenloses Konto ist notwendig. Du bekommst sofort 100 Credits — keine Kreditkarte erforderlich. Das Konto ermöglicht uns, Missbrauch zu verhindern und die Qualität für alle Nutzer zu sichern.',
  },
  {
    q: 'Kann AIRealCheck Deepfakes erkennen?',
    a: 'Ja. AIRealCheck analysiert technische Signale, die auf KI-Manipulation hinweisen — darunter GAN-Patterns, Diffusion-Artifacts, Frame-Anomalien und Audio-Inkonsistenzen. Deepfake-Detection ist ein zentraler Anwendungsfall der Plattform.',
  },
];

function FAQItem({ faq, index }: { faq: (typeof faqs)[0]; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: open ? 'rgba(53,214,255,0.03)' : 'rgba(16,19,26,0.8)',
        border: open ? '1px solid rgba(53,214,255,0.15)' : '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-[14px] min-h-[52px] text-left transition-colors"
      >
        <span className="text-[14px] font-medium text-[#D9E0EA] pr-4 leading-snug">{faq.q}</span>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
          style={{
            background: open ? 'rgba(53,214,255,0.15)' : 'rgba(255,255,255,0.05)',
          }}
        >
          {open
            ? <Minus size={13} style={{ color: '#35D6FF' }} />
            : <Plus size={13} style={{ color: '#9AA6B2' }} />
          }
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="px-5 pb-5 text-[13px] text-[#9AA6B2] leading-relaxed"
              style={{ borderTop: '1px solid rgba(53,214,255,0.08)' }}
            >
              <div className="pt-4">{faq.a}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQSection() {
  return (
    <section
      id="faq"
      className="relative py-20 md:py-28 px-5 md:px-12"
      style={{ background: '#0B0D12' }}
    >
      {/* Top glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(53,214,255,0.22), transparent)' }}
      />

      <div className="max-w-2xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-[26px] md:text-[42px] font-bold text-[#F5F7FB] mb-4">FAQ</h2>
          <p className="text-[16px] text-[#9AA6B2]">Letzte Einwände beseitigen.</p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FAQItem key={faq.q} faq={faq} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
