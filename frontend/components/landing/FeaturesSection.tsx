'use client';

import { motion } from 'framer-motion';
import { Layers, ScanSearch, BarChart3, ListOrdered, ShieldCheck, Briefcase } from 'lucide-react';

const features = [
  {
    icon: Layers,
    title: 'Multi-Format Detection',
    desc: 'Erkennt KI-generierte Inhalte in Bildern, Videos und Audio — eine Plattform für alle Content-Typen.',
    accent: '#35D6FF',
  },
  {
    icon: ScanSearch,
    title: 'Technical Signal Analysis',
    desc: 'Artifacts, Compression, Frame-Anomalien, Audio-Patterns — tiefgreifende Signalanalyse statt Blackbox.',
    accent: '#8B5CF6',
  },
  {
    icon: BarChart3,
    title: 'Confidence Scoring',
    desc: 'Klare Wahrscheinlichkeit und Verlässlichkeitsindikatoren. Wisse, wie sicher das Ergebnis ist.',
    accent: '#35D6FF',
  },
  {
    icon: ListOrdered,
    title: 'Model-Level Breakdown',
    desc: 'Wie jeder einzelne Detektor reagiert hat — transparent, nachvollziehbar, detailliert.',
    accent: '#8B5CF6',
  },
  {
    icon: ShieldCheck,
    title: 'Ensemble Detection',
    desc: '6+ spezialisierte Engines pro Analyse. Robustere Ergebnisse durch Konsensbildung statt einem Modell.',
    accent: '#35D6FF',
  },
  {
    icon: Briefcase,
    title: 'Built for Professional Work',
    desc: 'Editorial, Agency, Enterprise. Für professionelle Content-Verification-Workflows gebaut.',
    accent: '#8B5CF6',
  },
];

// Stagger grid via parent/child variants
const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-20 md:py-28 px-5 md:px-12" style={{ background: '#06070A' }}>
      {/* Top glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.28), transparent)' }}
      />

      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-[26px] md:text-[42px] font-bold text-[#F5F7FB] mb-4 leading-tight">
            Eine Platform. Alle Formate. Volle Transparenz.
          </h2>
          <p className="text-[16px] max-w-lg mx-auto" style={{ color: '#9AA6B2' }}>
            AIRealCheck ist mehr als ein einfacher Detektor —
            multi-format, multi-engine, vollständig nachvollziehbar.
          </p>
        </motion.div>

        {/* Staggered grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          variants={gridVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          {features.map(f => (
            <motion.div
              key={f.title}
              variants={cardVariants}
              whileHover={{ y: -5, transition: { duration: 0.25 } }}
              className="group rounded-2xl p-7 flex flex-col cursor-default"
              style={{
                background: '#0B0D12',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = `${f.accent}30`;
                el.style.boxShadow = `0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px ${f.accent}16 inset`;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'rgba(255,255,255,0.07)';
                el.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)';
              }}
            >
              {/* Icon */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 shrink-0"
                style={{ background: `${f.accent}12`, border: `1px solid ${f.accent}22` }}
              >
                <f.icon size={20} style={{ color: f.accent }} />
              </div>

              <h3 className="text-[15px] font-semibold text-[#F5F7FB] mb-2.5 leading-snug">{f.title}</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: '#9AA6B2' }}>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
