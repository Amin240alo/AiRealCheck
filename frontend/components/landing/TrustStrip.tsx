'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { CreditCard, Layers, ShieldCheck, Zap } from 'lucide-react';

// ─── CountUp hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [inView, target, duration]);

  return { ref, count };
}

// ─── Numeric stat ─────────────────────────────────────────────────────────────
function NumericStat({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const { ref, count } = useCountUp(target);
  return (
    <span ref={ref as React.RefObject<HTMLSpanElement>}>
      {prefix}{count}{suffix}
    </span>
  );
}

// ─── Stat data ────────────────────────────────────────────────────────────────
const stats = [
  {
    icon: CreditCard,
    numeric: true,
    target: 100,
    suffix: '',
    label: 'Free Credits',
    sub: 'Testen ohne Upgrade',
    color: '#35D6FF',
  },
  {
    icon: Layers,
    numeric: true,
    target: 6,
    suffix: '+',
    label: 'Detection Engines',
    sub: 'Mehr als ein Score',
    color: '#8B5CF6',
  },
  {
    icon: ShieldCheck,
    numeric: false,
    staticVal: 'Built for',
    label: 'Verification',
    sub: 'Journalisten, Teams, Creator',
    color: '#35D6FF',
  },
  {
    icon: Zap,
    numeric: false,
    staticVal: '< 5s',
    label: 'Results',
    sub: 'Schnell & verlässlich',
    color: '#8B5CF6',
  },
];

export function TrustStrip() {
  return (
    <section
      className="relative py-20 px-5 md:px-12 overflow-hidden"
      style={{
        background: '#06070A',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(53,214,255,0.025) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.09, duration: 0.55 }}
            className="flex flex-col items-center text-center"
          >
            {/* Icon with glow */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{
                background: `${s.color}10`,
                border: `1px solid ${s.color}22`,
                boxShadow: `0 0 18px ${s.color}16`,
              }}
            >
              <s.icon size={22} style={{ color: s.color }} />
            </div>

            {/* Value — animated for numbers, static otherwise */}
            <div
              className="text-[34px] md:text-[40px] font-bold leading-none mb-1.5"
              style={{ color: '#F5F7FB' }}
            >
              {s.numeric
                ? <NumericStat target={s.target!} suffix={s.suffix} />
                : s.staticVal
              }
            </div>

            <div className="text-[13px] font-medium mb-1" style={{ color: '#D9E0EA' }}>{s.label}</div>
            <div className="text-[12px]" style={{ color: '#9AA6B2' }}>{s.sub}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
