'use client';

import { motion } from 'framer-motion';
import { Upload, Cpu, BarChart2 } from 'lucide-react';

const steps = [
  {
    n: '01',
    num: 1,
    icon: Upload,
    title: 'Upload your image',
    desc: 'Datei in Sekunden hinzufügen. Unterstützt alle gängigen Bildformate — direkt im Browser.',
    accent: '#35D6FF',
  },
  {
    n: '02',
    num: 2,
    icon: Cpu,
    title: 'Run the analysis',
    desc: 'Ensemble-Detection + Technical Signal Checks laufen parallel auf 6+ spezialisierten Engines.',
    accent: '#8B5CF6',
  },
  {
    n: '03',
    num: 3,
    icon: BarChart2,
    title: 'Review the result',
    desc: 'Score, Confidence, Detector-Breakdown, Signal-Summary — alles transparent und nachvollziehbar.',
    accent: '#35D6FF',
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative py-20 md:py-28 px-5 md:px-12 overflow-hidden"
      style={{ background: '#0B0D12' }}
    >
      {/* Top border glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(53,214,255,0.25), transparent)' }}
      />

      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-[26px] md:text-[42px] font-bold text-[#F5F7FB] mb-4 leading-tight">
            3 Schritte —{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #35D6FF, #8B5CF6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              sophistiziert unter der Haube,
            </span>
            <br className="hidden md:block" />
            simpel in der Nutzung.
          </h2>
        </motion.div>

        {/* ── Steps container ── */}
        <div className="relative">

          {/* ── Desktop connector line (animated, behind nodes) ── */}
          <div className="hidden md:block absolute top-[20px] left-0 right-0 pointer-events-none"
            style={{ zIndex: 0 }}>
            {/* Full span background track */}
            <div
              className="absolute h-px"
              style={{
                top: 0,
                left: '16.67%',
                right: '16.67%',
                background: 'rgba(255,255,255,0.06)',
              }}
            />
            {/* Animated fill — Cyan to Violet gradient */}
            <motion.div
              className="absolute h-px"
              style={{
                top: 0,
                left: '16.67%',
                transformOrigin: 'left center',
                background: 'linear-gradient(90deg, #35D6FF, #8B5CF6)',
                boxShadow: '0 0 6px rgba(53,214,255,0.35)',
              }}
              initial={{ scaleX: 0, right: '16.67%' }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            />
          </div>

          {/* ── Step cards ── */}
          <div className="flex flex-col md:flex-row gap-5 md:gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.13, duration: 0.55 }}
                className="flex-1 flex flex-col items-center text-center"
                style={{ zIndex: 1 }}
              >
                {/* Glow number node */}
                <motion.div
                  className="w-10 h-10 rounded-full flex items-center justify-center mb-6 text-[#06070A] text-[15px] font-bold shrink-0"
                  style={{
                    background: step.accent,
                    boxShadow: `0 0 0 4px rgba(${step.accent === '#35D6FF' ? '53,214,255' : '139,92,246'},0.12), 0 0 20px ${step.accent}55`,
                  }}
                  whileHover={{ scale: 1.12 }}
                  transition={{ duration: 0.2 }}
                >
                  {step.num}
                </motion.div>

                {/* Card */}
                <motion.div
                  className="rounded-2xl p-7 w-full h-full flex flex-col items-center"
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    background: '#10131A',
                    border: '1px solid rgba(255,255,255,0.07)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${step.accent}28`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
                  }}
                >
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${step.accent}12`, border: `1px solid ${step.accent}20` }}
                  >
                    <step.icon size={18} style={{ color: step.accent }} />
                  </div>

                  <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: 'rgba(154,166,178,0.45)' }}>
                    {step.n}
                  </div>
                  <h3 className="text-[15px] font-semibold text-[#F5F7FB] mb-2.5">{step.title}</h3>
                  <p className="text-[13px] leading-relaxed" style={{ color: '#9AA6B2' }}>{step.desc}</p>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
