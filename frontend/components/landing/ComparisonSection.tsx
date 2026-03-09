'use client';

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import Link from 'next/link';

const rows = [
  { label: 'Image-only Detection',              basic: true,  aire: false },
  { label: 'Multi-Format (Image/Video/Audio)',  basic: false, aire: true  },
  { label: 'Ensemble (6+ Engines)',             basic: false, aire: true  },
  { label: 'Technical Signals',                basic: false, aire: true  },
  { label: 'Model-Level Output',               basic: false, aire: true  },
  { label: 'Confidence-Framing',               basic: false, aire: true  },
];

// ─── Shared icon helpers ──────────────────────────────────────────────────────
function YesIcon({ featured = false }: { featured?: boolean }) {
  return featured ? (
    <div className="w-7 h-7 rounded-full flex items-center justify-center"
      style={{ background: 'rgba(53,214,255,0.12)' }}>
      <Check size={14} style={{ color: '#35D6FF' }} />
    </div>
  ) : (
    <Check size={16} className="text-[#22C55E]" />
  );
}

function NoIcon() {
  return <X size={15} style={{ color: 'rgba(255,255,255,0.18)' }} />;
}

export function ComparisonSection() {
  return (
    <section className="relative py-20 md:py-28 px-5 md:px-12" style={{ background: '#06070A' }}>
      {/* Top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.25), transparent)' }} />

      <div className="max-w-3xl mx-auto">
        <motion.div className="text-center mb-10 md:mb-12"
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-[28px] md:text-[42px] font-bold text-[#F5F7FB] mb-3 leading-tight">
            Mehr als ein einfacher Score.
          </h2>
          <p className="text-[15px] md:text-[16px] text-[#9AA6B2]">
            AIRealCheck geht tiefer — mehr Formate, mehr Engines, mehr Transparenz.
          </p>
        </motion.div>

        {/* ── MOBILE: Stacked cards (AIRealCheck first) ── */}
        <div className="md:hidden space-y-4 mb-8">
          {/* AIRealCheck card — featured, first */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(53,214,255,0.03)',
              border: '1px solid rgba(53,214,255,0.22)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {/* Cyan top bar */}
            <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #35D6FF, transparent)' }} />
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(53,214,255,0.1)' }}>
              <div className="text-[14px] font-semibold text-[#35D6FF]">AIRealCheck</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'rgba(53,214,255,0.5)' }}>Multi-Format · Ensemble · Transparent</div>
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {rows.map(row => (
                <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[13px] text-[#D9E0EA] pr-4">{row.label}</span>
                  {row.aire ? <YesIcon featured /> : <NoIcon />}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Basic Detector card — second */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl overflow-hidden"
            style={{
              background: '#0B0D12',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-[14px] font-medium text-[#9AA6B2]">Basic Detector</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'rgba(154,166,178,0.4)' }}>Image-only · Single Model</div>
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {rows.map(row => (
                <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[13px] text-[#D9E0EA] pr-4">{row.label}</span>
                  {row.basic ? <YesIcon /> : <NoIcon />}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── DESKTOP: 3-column table ── */}
        <div
          className="hidden md:block rounded-2xl overflow-hidden mb-10"
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            background: '#0B0D12',
            boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          }}
        >
          {/* Top light edge */}
          <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.08) 50%, transparent 80%)' }} />

          {/* Column headers */}
          <div className="grid grid-cols-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="p-5" />
            <div className="p-5 text-center" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[12px] text-[#9AA6B2] font-medium">Basic Detector</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'rgba(154,166,178,0.45)' }}>Image-only · Single Model</div>
            </div>
            <div className="p-5 text-center relative" style={{ borderLeft: '1px solid rgba(53,214,255,0.2)', background: 'rgba(53,214,255,0.03)' }}>
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, #35D6FF, transparent)' }} />
              <div className="text-[12px] text-[#35D6FF] font-semibold">AIRealCheck</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'rgba(53,214,255,0.5)' }}>Multi-Format · Ensemble · Transparent</div>
            </div>
          </div>

          {rows.map((row, i) => (
            <motion.div key={row.label}
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="grid grid-cols-3"
              style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
            >
              <div className="px-5 py-4 text-[13px] text-[#D9E0EA]">{row.label}</div>
              <div className="px-5 py-4 flex items-center justify-center" style={{ borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                {row.basic ? <YesIcon /> : <NoIcon />}
              </div>
              <div className="px-5 py-4 flex items-center justify-center"
                style={{ borderLeft: '1px solid rgba(53,214,255,0.15)', background: 'rgba(53,214,255,0.02)' }}>
                {row.aire ? <YesIcon featured /> : <NoIcon />}
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA — full-width on mobile */}
        <div className="text-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center w-full md:w-auto h-12 px-8 rounded-xl text-[#06070A] text-[14px] font-bold transition-all hover:brightness-110"
            style={{ background: '#35D6FF', boxShadow: '0 0 24px rgba(53,214,255,0.2)' }}
          >
            Try the difference
          </Link>
        </div>
      </div>
    </section>
  );
}
