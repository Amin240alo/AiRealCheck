'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Upload, Loader2, Activity, AlertTriangle, CheckCircle2, Cpu, FileImage, Video, Mic } from 'lucide-react';

type Stage = 'idle' | 'loading' | 'result';

// ─── Engine data for the result ──────────────────────────────────────────────
const engines = [
  { name: 'GAN Detector',    val: 82, verdict: 'AI', color: '#EF4444' },
  { name: 'Diffusion Guard', val: 74, verdict: 'AI', color: '#EF4444' },
  { name: 'Artifact Scanner',val: 79, verdict: 'AI', color: '#EF4444' },
  { name: 'Edge Analyzer',   val: 88, verdict: 'AI', color: '#EF4444' },
  { name: 'Texture Engine',  val: 71, verdict: 'AI', color: '#F59E0B' },
  { name: 'Compression AI',  val: 76, verdict: 'AI', color: '#EF4444' },
];

const signals = ['GAN Pattern', 'Diffusion Artifacts', 'Edge Smoothing', 'Texture Noise', 'Compression Artifacts'];

// ─── Stagger variants for result reveal ──────────────────────────────────────
const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.2 } },
};

const listItem = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35 } },
};

const signalVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.85 } },
};

const signalItem = {
  hidden: { opacity: 0, scale: 0.85, y: 4 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3 } },
};

export function DemoSection() {
  const [stage, setStage] = useState<Stage>('idle');

  function runDemo() {
    setStage('loading');
    setTimeout(() => setStage('result'), 2800);
  }

  // Circumference for r=46: 2π×46 ≈ 289
  // 78% fill → offset = 289 × (1 - 0.78) = 63.6
  const CIRC = 289;
  const targetOffset = CIRC * (1 - 0.78); // ≈ 63.6

  return (
    <section
      id="demo"
      className="relative py-20 md:py-28 px-5 md:px-12 overflow-hidden"
      style={{ background: '#0B0D12' }}
    >
      {/* Top border glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(53,214,255,0.28), transparent)' }}
      />

      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-widest mb-5"
            style={{
              background: 'rgba(53,214,255,0.07)',
              border: '1px solid rgba(53,214,255,0.2)',
              color: '#35D6FF',
            }}
          >
            <Activity size={11} />
            See it in action
          </div>
          <h2 className="text-[26px] md:text-[42px] font-bold text-[#F5F7FB] mb-4 leading-tight">
            A live preview of how AIRealCheck
            <br className="hidden md:block" /> analyzes visual content.
          </h2>
          <p className="text-[15px] text-[#9AA6B2]">
            Beispiel-Analyse mit einem Bild — AIRealCheck erkennt auch Video- und Audio-Content.
          </p>
        </motion.div>

        {/* ── Demo Card ── */}
        <motion.div
          className="max-w-2xl mx-auto rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            background: 'rgba(16,19,26,0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset',
          }}
        >
          {/* Top light edge */}
          <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.1) 50%, transparent 90%)' }} />

          {/* Window chrome */}
          <div className="flex items-center gap-2 px-5 py-3.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(239,68,68,0.5)' }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(245,158,11,0.5)' }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(34,197,94,0.5)' }} />
            <span className="ml-3 text-[11px] font-mono" style={{ color: 'rgba(154,166,178,0.5)' }}>
              airealcheck — image_analysis
            </span>
            {stage === 'result' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ml-auto flex items-center gap-1.5"
              >
                <CheckCircle2 size={12} className="text-[#22C55E]" />
                <span className="text-[10px] text-[#22C55E] font-mono">complete</span>
              </motion.div>
            )}
          </div>

          {/* Content format selector */}
          <div className="flex gap-1.5 px-5 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}>
            {[
              { label: 'Image', icon: FileImage, active: true },
              { label: 'Video', icon: Video, active: false },
              { label: 'Audio', icon: Mic, active: false },
            ].map(tab => (
              <div
                key={tab.label}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono"
                style={tab.active
                  ? { background: 'rgba(53,214,255,0.1)', color: '#35D6FF', border: '1px solid rgba(53,214,255,0.2)' }
                  : { color: 'rgba(154,166,178,0.35)' }
                }
              >
                <tab.icon size={10} />
                {tab.label}
              </div>
            ))}
            <span className="ml-auto text-[10px] font-mono" style={{ color: 'rgba(154,166,178,0.3)' }}>Demo</span>
          </div>

          {/* ── Stage Content ── */}
          <div className="p-5 sm:p-8 min-h-[360px] sm:min-h-[420px] flex items-center justify-center">
            <AnimatePresence mode="wait">

              {/* IDLE */}
              {stage === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center text-center"
                >
                  <motion.div
                    className="w-24 h-24 rounded-2xl flex items-center justify-center mb-6"
                    style={{ background: 'rgba(53,214,255,0.05)', border: '2px dashed rgba(53,214,255,0.22)' }}
                    animate={{ borderColor: ['rgba(53,214,255,0.22)', 'rgba(53,214,255,0.45)', 'rgba(53,214,255,0.22)'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Upload size={30} style={{ color: 'rgba(53,214,255,0.55)' }} />
                  </motion.div>
                  <p className="text-[#D9E0EA] font-semibold mb-2 text-[15px]">Upload area</p>
                  <p className="text-[13px] mb-8 max-w-[280px] leading-relaxed" style={{ color: '#9AA6B2' }}>
                    Drag &amp; drop an image or click to select a file
                  </p>
                  <motion.button
                    onClick={runDemo}
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    className="h-11 px-9 rounded-xl text-[#06070A] text-[14px] font-bold"
                    style={{ background: '#35D6FF', boxShadow: '0 0 24px rgba(53,214,255,0.24)' }}
                  >
                    Demo starten
                  </motion.button>
                </motion.div>
              )}

              {/* LOADING */}
              {stage === 'loading' && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center text-center w-full"
                >
                  {/* Pulsing engine icon */}
                  <motion.div
                    className="mb-6"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    <Cpu size={40} style={{ color: '#35D6FF' }} />
                  </motion.div>

                  <p className="text-[#D9E0EA] font-semibold mb-1.5 text-[16px]">Analysiere Bild…</p>
                  <p className="text-[13px] mb-8" style={{ color: '#9AA6B2' }}>
                    6 Engines aktiv · Ensemble Detection läuft
                  </p>

                  {/* Progress bar */}
                  <div className="w-full max-w-xs h-2 rounded-full overflow-hidden mb-5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div
                      className="h-2 rounded-full"
                      style={{ background: 'linear-gradient(90deg, #35D6FF, #8B5CF6)' }}
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 2.6, ease: 'easeInOut' }}
                    />
                  </div>

                  {/* Mini engine status shimmer */}
                  <div className="w-full max-w-xs space-y-2">
                    {engines.map((e, i) => (
                      <motion.div
                        key={e.name}
                        className="flex items-center gap-3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.2 + 0.3 }}
                      >
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: '#35D6FF' }}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                        />
                        <span className="text-[11px] font-mono flex-1 text-left" style={{ color: '#9AA6B2' }}>
                          {e.name}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: 'rgba(154,166,178,0.4)' }}>
                          running…
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* RESULT */}
              {stage === 'result' && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="w-full"
                >
                  {/* ── Score header ── */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-6">
                    {/* Animated SVG score ring */}
                    <div className="relative shrink-0">
                      <svg viewBox="0 0 100 100" className="w-[110px] h-[110px] -rotate-90">
                        {/* Track */}
                        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                        {/* Violet background arc */}
                        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="7"
                          strokeDasharray={CIRC} strokeDashoffset={0} strokeLinecap="round" />
                        {/* Animated cyan fill */}
                        <motion.circle
                          cx="50" cy="50" r="46"
                          fill="none"
                          stroke="#35D6FF"
                          strokeWidth="7"
                          strokeLinecap="round"
                          strokeDasharray={CIRC}
                          initial={{ strokeDashoffset: CIRC }}
                          animate={{ strokeDashoffset: targetOffset }}
                          transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                          style={{ filter: 'drop-shadow(0 0 8px rgba(53,214,255,0.65))' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <motion.span
                          className="text-[26px] font-bold text-[#F5F7FB] leading-none"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5, duration: 0.4 }}
                        >
                          78%
                        </motion.span>
                        <span className="text-[9px] font-mono uppercase tracking-wide mt-0.5" style={{ color: '#9AA6B2' }}>
                          AI Score
                        </span>
                      </div>
                    </div>

                    {/* Summary cards */}
                    <motion.div
                      className="flex-1 w-full"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
                    >
                      <div className="mb-3">
                        <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: 'rgba(154,166,178,0.6)' }}>
                          Verdict
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={14} style={{ color: '#EF4444' }} />
                          <span className="text-[15px] font-semibold" style={{ color: '#EF4444' }}>
                            Wahrscheinlich KI-generiert
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { l: 'Confidence', v: 'High',  c: '#22C55E' },
                          { l: 'Engines',    v: '6/6',   c: '#35D6FF' },
                          { l: 'Dauer',      v: '1.8s',  c: '#D9E0EA' },
                        ].map(item => (
                          <div
                            key={item.l}
                            className="rounded-lg p-2.5 text-center"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                          >
                            <div className="text-[10px] font-mono mb-0.5" style={{ color: 'rgba(154,166,178,0.6)' }}>{item.l}</div>
                            <div className="text-[13px] font-semibold" style={{ color: item.c }}>{item.v}</div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </div>

                  {/* ── Engine breakdown — staggered ── */}
                  <div className="rounded-xl p-4 mb-4"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: 'rgba(154,166,178,0.5)' }}>
                      Engine Breakdown
                    </div>
                    <motion.div className="space-y-2.5" variants={listVariants} initial="hidden" animate="show">
                      {engines.map(e => (
                        <motion.div key={e.name} variants={listItem} className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.color }} />
                          <span className="text-[11px] font-mono flex-1" style={{ color: '#9AA6B2' }}>{e.name}</span>
                          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <motion.div
                              className="h-1.5 rounded-full"
                              style={{ background: e.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${e.val}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                          </div>
                          <span className="text-[11px] font-mono w-7 text-right" style={{ color: '#D9E0EA' }}>{e.val}%</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>{e.verdict}</span>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>

                  {/* ── Signal panel — staggered ── */}
                  <div className="mb-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest mb-2.5" style={{ color: 'rgba(154,166,178,0.5)' }}>
                      Signals Detected
                    </div>
                    <motion.div className="flex flex-wrap gap-2" variants={signalVariants} initial="hidden" animate="show">
                      {signals.map(s => (
                        <motion.span
                          key={s}
                          variants={signalItem}
                          className="text-[11px] px-2.5 py-1 rounded-full font-mono"
                          style={{
                            background: 'rgba(53,214,255,0.07)',
                            color: '#35D6FF',
                            border: '1px solid rgba(53,214,255,0.15)',
                          }}
                        >
                          {s}
                        </motion.span>
                      ))}
                    </motion.div>
                  </div>

                  <button
                    onClick={() => setStage('idle')}
                    className="w-full h-11 rounded-lg text-[12px] transition-colors hover:bg-white/[0.04]"
                    style={{ border: '1px solid rgba(255,255,255,0.07)', color: '#9AA6B2' }}
                  >
                    Zurücksetzen
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <div className="text-center mt-10">
          <motion.div whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/register"
              className="inline-flex items-center h-11 px-8 rounded-xl text-[#06070A] text-[14px] font-bold"
              style={{ background: '#35D6FF', boxShadow: '0 0 24px rgba(53,214,255,0.22)' }}
            >
              Try it with 100 free credits
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
