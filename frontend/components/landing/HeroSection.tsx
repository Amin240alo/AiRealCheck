'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Layers, ScanSearch, BarChart3, Zap, ShieldCheck } from 'lucide-react';

const chips = [
  { icon: Layers, label: '6 Engines' },
  { icon: ScanSearch, label: 'Ensemble Detection' },
  { icon: BarChart3, label: 'Confidence Score' },
  { icon: Zap, label: 'Fast Results' },
];

const chipVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.5 } },
};

const chipItem = {
  hidden: { opacity: 0, y: 10, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
};

const engines = [
  { name: 'GAN Detector',    val: 82, color: '#35D6FF' },
  { name: 'Diffusion Guard', val: 74, color: '#35D6FF' },
  { name: 'Artifact Scanner',val: 79, color: '#8B5CF6' },
  { name: 'Edge Analyzer',   val: 88, color: '#35D6FF' },
  { name: 'Texture Engine',  val: 71, color: '#8B5CF6' },
  { name: 'Compression AI',  val: 76, color: '#35D6FF' },
];

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  // Subtle upward parallax as user scrolls past the hero
  const mockupY       = useTransform(scrollY, [0, 600], [0, -28]);
  const mockupOpacity = useTransform(scrollY, [0, 450], [1, 0.7]);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[85vh] flex items-center py-16 md:py-20 px-5 md:px-12 overflow-hidden"
    >
      {/* Background radial glows */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 70% 40%, rgba(53,214,255,0.055) 0%, transparent 70%),' +
            'radial-gradient(ellipse 50% 50% at 30% 60%, rgba(139,92,246,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 md:gap-16 items-center">

        {/* ── Left: Messaging ── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-widest uppercase mb-5 md:mb-7"
            style={{
              background: 'rgba(53,214,255,0.07)',
              border: '1px solid rgba(53,214,255,0.22)',
              color: '#35D6FF',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#35D6FF', boxShadow: '0 0 6px #35D6FF' }}
            />
            KI-Erkennung — jetzt verfügbar
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="text-[34px] sm:text-[42px] md:text-[50px] lg:text-[60px] font-bold leading-[1.1] tracking-[-0.02em] text-[#F5F7FB] mb-5 md:mb-6"
          >
            Know if an image is real{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #35D6FF 0%, #8B5CF6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              or AI-generated
            </span>
            {' '}— in seconds.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-[15px] md:text-[17px] text-[#9AA6B2] leading-relaxed mb-7 md:mb-9 max-w-[480px]"
          >
            AIRealCheck uses ensemble analysis across 6+ detection engines
            to verify visual content with depth, not just a single score.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.32 }}
            className="flex flex-col sm:flex-row gap-3 mb-5"
          >
            <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.2 }}>
              <Link
                href="/register"
                className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-[#35D6FF] text-[#06070A] text-[15px] font-bold transition-colors hover:bg-[#10BEE8] w-full sm:w-auto"
                style={{ boxShadow: '0 0 32px rgba(53,214,255,0.28), 0 2px 8px rgba(0,0,0,0.4)' }}
              >
                Start Free Analysis
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.2 }}>
              <a
                href="#demo"
                className="inline-flex items-center justify-center h-12 px-8 rounded-xl text-[#D9E0EA] text-[15px] font-medium transition-colors hover:text-[#F5F7FB] w-full sm:w-auto"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              >
                Watch Live Demo
              </a>
            </motion.div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-[12px] mb-6 md:mb-9"
            style={{ color: 'rgba(154,166,178,0.6)' }}
          >
            100 free credits. No credit card required.
          </motion.p>

          {/* Feature Chips — staggered */}
          <motion.div className="flex flex-wrap gap-2" variants={chipVariants} initial="hidden" animate="show">
            {chips.map(({ icon: Icon, label }) => (
              <motion.div
                key={label}
                variants={chipItem}
                whileHover={{ scale: 1.05, y: -1 }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] text-[#D9E0EA] cursor-default"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Icon size={12} className="text-[#35D6FF]" />
                {label}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* ── Right: Product Mockup — parallax on scroll ── */}
        <motion.div
          style={{ y: mockupY, opacity: mockupOpacity }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="hidden md:flex justify-center"
        >
          <div className="relative w-full max-w-[440px]">
            {/* Blurred ambient glow */}
            <div
              className="absolute -inset-6 rounded-3xl pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 50% 50%, rgba(53,214,255,0.11) 0%, transparent 70%)',
                filter: 'blur(24px)',
              }}
            />

            {/* Mockup card */}
            <motion.div
              className="relative rounded-2xl overflow-hidden"
              whileHover={{ scale: 1.014, y: -5 }}
              transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: '#0B0D12',
                border: '1px solid rgba(53,214,255,0.14)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset, 0 32px 64px rgba(0,0,0,0.6)',
              }}
            >
              {/* Top light edge */}
              <div
                className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 10%, rgba(53,214,255,0.45) 50%, transparent 90%)',
                }}
              />

              {/* Window chrome */}
              <div
                className="flex items-center gap-2 px-5 py-3.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(239,68,68,0.5)' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(245,158,11,0.5)' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(34,197,94,0.5)' }} />
                <span className="ml-3 text-[11px] font-mono" style={{ color: 'rgba(154,166,178,0.5)' }}>
                  airealcheck — analysis_result.json
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-[#35D6FF]" />
                  <span className="text-[10px] text-[#35D6FF] font-mono">verified</span>
                </div>
              </div>

              <div className="p-5">
                {/* Score header */}
                <div className="flex items-center gap-5 mb-5">
                  <div className="relative shrink-0">
                    <svg viewBox="0 0 80 80" className="w-[88px] h-[88px] -rotate-90">
                      <circle cx="40" cy="40" r="31" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
                      <circle cx="40" cy="40" r="31" fill="none" stroke="rgba(139,92,246,0.18)" strokeWidth="7"
                        strokeDasharray="194.78" strokeDashoffset="0" strokeLinecap="round" />
                      <circle cx="40" cy="40" r="31" fill="none" stroke="#35D6FF" strokeWidth="7"
                        strokeDasharray="194.78" strokeDashoffset="43" strokeLinecap="round"
                        style={{ filter: 'drop-shadow(0 0 6px rgba(53,214,255,0.7))' }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[20px] font-bold text-[#F5F7FB] leading-none">78%</span>
                      <span className="text-[9px] font-mono uppercase tracking-wide" style={{ color: '#9AA6B2' }}>AI Score</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider mb-0.5 font-mono" style={{ color: '#9AA6B2' }}>AI Probability</div>
                      <div className="text-[18px] font-bold text-[#35D6FF]">78%</div>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider mb-0.5 font-mono" style={{ color: '#9AA6B2' }}>Confidence</div>
                        <div className="text-[13px] font-semibold text-[#22C55E]">High</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider mb-0.5 font-mono" style={{ color: '#9AA6B2' }}>Engines</div>
                        <div className="text-[13px] font-semibold text-[#F5F7FB]">6 / 6</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px mb-4" style={{ background: 'rgba(255,255,255,0.05)' }} />

                <div className="text-[10px] font-mono uppercase tracking-wider mb-2.5" style={{ color: 'rgba(154,166,178,0.5)' }}>
                  Engine Breakdown
                </div>
                <div className="space-y-2 mb-4">
                  {engines.map(e => (
                    <div key={e.name} className="flex items-center gap-2.5">
                      <span className="text-[10px] font-mono w-[120px] shrink-0" style={{ color: '#9AA6B2' }}>{e.name}</span>
                      <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-1 rounded-full" style={{ width: `${e.val}%`, background: e.color, boxShadow: `0 0 4px ${e.color}80` }} />
                      </div>
                      <span className="text-[10px] font-mono w-7 text-right" style={{ color: '#D9E0EA' }}>{e.val}%</span>
                    </div>
                  ))}
                </div>

                <div className="h-px mb-3" style={{ background: 'rgba(255,255,255,0.05)' }} />

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {['GAN Pattern', 'Diffusion Artifacts', 'Edge Smoothing'].map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                      style={{ background: 'rgba(53,214,255,0.08)', color: '#35D6FF', border: '1px solid rgba(53,214,255,0.15)' }}>
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono" style={{ color: 'rgba(154,166,178,0.45)' }}>Processed in 1.8s</span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold"
                    style={{ background: 'rgba(139,92,246,0.12)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.2)' }}>
                    Premium Analysis
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
