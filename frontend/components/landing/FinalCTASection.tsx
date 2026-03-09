'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function FinalCTASection() {
  return (
    <section className="relative py-20 md:py-28 px-5 md:px-12 overflow-hidden" style={{ background: '#06070A' }}>
      {/* Background ambient glows */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(53,214,255,0.07) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 20% 50%, rgba(139,92,246,0.05) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(53,214,255,0.06) 0%, rgba(139,92,246,0.07) 100%)',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 60px rgba(53,214,255,0.06)',
          }}
        >
          {/* Top light edge */}
          <div
            className="absolute top-0 left-0 right-0 h-px pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 10%, rgba(53,214,255,0.5) 50%, rgba(139,92,246,0.3) 80%, transparent)',
            }}
          />

          {/* Radial glow from top */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at top, rgba(53,214,255,0.1) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10 px-8 md:px-14 py-16">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-widest mb-7"
              style={{
                background: 'rgba(53,214,255,0.08)',
                border: '1px solid rgba(53,214,255,0.2)',
                color: '#35D6FF',
              }}
            >
              Bereit anzufangen?
            </div>

            <h2 className="text-[28px] md:text-[44px] font-bold text-[#F5F7FB] mb-5 leading-tight">
              Bereit, die Wahrheit
              <br />zu sehen?
            </h2>

            <p className="text-[16px] text-[#9AA6B2] mb-10 leading-relaxed">
              Starte jetzt mit 100 kostenlosen Credits.
              <br />Kein Risiko, keine Kreditkarte.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2.5 w-full sm:w-auto px-10 rounded-xl text-[#06070A] text-[15px] font-bold transition-all hover:brightness-110"
                style={{
                  height: '52px',
                  background: '#35D6FF',
                  boxShadow: '0 0 40px rgba(53,214,255,0.28), 0 4px 16px rgba(0,0,0,0.4)',
                }}
              >
                Get Started Free
                <ArrowRight size={16} />
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center justify-center w-full sm:w-auto h-[52px] px-8 rounded-xl text-[#D9E0EA] text-[15px] font-medium transition-all hover:bg-white/[0.05] hover:text-[#F5F7FB]"
                style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
              >
                Explore the Demo
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
