'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '€0',
    period: '',
    credits: '100 Credits / Monat',
    highlights: ['Core-Analyse', 'Kein Upload-Limit', 'Keine Kreditkarte'],
    cta: 'Start Free',
    ctaHref: '/register',
    featured: false,
    badge: null,
    accentColor: '#35D6FF',
  },
  {
    name: 'Basic',
    price: 'ab 9 €',
    period: '/Mo',
    credits: '500 Credits / Monat',
    highlights: ['Erhöhte Credits', 'Standard-Support', 'Alle Core-Features'],
    cta: 'Get Basic',
    ctaHref: '/register',
    featured: false,
    badge: null,
    accentColor: '#35D6FF',
  },
  {
    name: 'Pro',
    price: 'ab 29 €',
    period: '/Mo',
    credits: '2.500 Credits / Monat',
    highlights: ['API-Zugang', 'Schnellere Analyse', 'Priority Support'],
    cta: 'Get Pro',
    ctaHref: '/register',
    featured: true,
    badge: 'Most Popular',
    accentColor: '#8B5CF6',
  },
  {
    name: 'Business',
    price: 'ab 99 €',
    period: '/Mo',
    credits: 'Unbegrenzte Credits',
    highlights: ['Bulk-Upload', 'Erweiterte Details', 'Team-Accounts'],
    cta: 'Contact Us',
    ctaHref: '/register',
    featured: false,
    badge: null,
    accentColor: '#35D6FF',
  },
];

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative py-20 md:py-28 px-5 md:px-12 overflow-hidden"
      style={{ background: '#0B0D12' }}
    >
      {/* Top glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(53,214,255,0.25), transparent)' }}
      />

      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-[26px] md:text-[42px] font-bold text-[#F5F7FB] mb-4 leading-tight">
            Friction entfernen. Einstieg klar machen.
          </h2>
          <p className="text-[16px] text-[#9AA6B2]">
            Starte kostenlos. Kein Risiko, keine Kreditkarte.
          </p>
          <p className="text-[12px] text-[#9AA6B2]/40 mt-2">
            * Alle Preise sind Arbeitshypothesen und werden vor Launch finalisiert.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -5 }}
              className="rounded-2xl p-6 flex flex-col relative overflow-hidden transition-all duration-300"
              style={
                plan.featured
                  ? {
                      background: 'rgba(139,92,246,0.07)',
                      border: '1px solid rgba(139,92,246,0.35)',
                      boxShadow: '0 0 48px rgba(139,92,246,0.12), 0 16px 40px rgba(0,0,0,0.5)',
                    }
                  : {
                      background: '#10131A',
                      border: '1px solid rgba(255,255,255,0.07)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    }
              }
            >
              {/* Featured top glow line */}
              {plan.featured && (
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: 'linear-gradient(90deg, transparent, #8B5CF6, transparent)' }}
                />
              )}

              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="text-[14px] font-semibold text-[#F5F7FB]">{plan.name}</div>
                {plan.badge && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: 'rgba(139,92,246,0.15)',
                      color: '#A78BFA',
                      border: '1px solid rgba(139,92,246,0.3)',
                    }}
                  >
                    {plan.badge}
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="mb-1">
                <span
                  className="text-[34px] font-bold leading-none"
                  style={{ color: plan.featured ? '#A78BFA' : '#F5F7FB' }}
                >
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-[14px] text-[#9AA6B2] ml-1">{plan.period}</span>
                )}
              </div>
              <div className="text-[12px] text-[#9AA6B2] mb-7">{plan.credits}</div>

              {/* Highlights */}
              <div className="flex-1 space-y-3 mb-8">
                {plan.highlights.map(h => (
                  <div key={h} className="flex items-center gap-2.5 text-[13px] text-[#D9E0EA]">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: `${plan.accentColor}14` }}
                    >
                      <Check size={10} style={{ color: plan.accentColor }} />
                    </div>
                    {h}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Link
                href={plan.ctaHref}
                className="w-full h-11 rounded-xl text-center flex items-center justify-center text-[13px] font-semibold transition-all hover:brightness-110"
                style={
                  plan.featured
                    ? {
                        background: '#8B5CF6',
                        color: '#fff',
                        boxShadow: '0 0 20px rgba(139,92,246,0.3)',
                      }
                    : {
                        background: 'rgba(255,255,255,0.05)',
                        color: '#D9E0EA',
                        border: '1px solid rgba(255,255,255,0.09)',
                      }
                }
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/register"
            className="text-[13px] text-[#9AA6B2] hover:text-[#D9E0EA] transition-colors underline underline-offset-4 decoration-white/20"
          >
            View Premium Options
          </Link>
        </div>
      </div>
    </section>
  );
}
