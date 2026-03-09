'use client';

import { motion } from 'framer-motion';
import { Newspaper, Building2, Users, Camera } from 'lucide-react';

const audiences = [
  {
    icon: Newspaper,
    title: 'Journalisten',
    desc: 'Verifiziere Bildmaterial schnell und sicher. Keine Annahmen — klare Signale und Transparenz.',
    accent: '#35D6FF',
    detail: 'Fact-Checking · Editorial · Breaking News',
  },
  {
    icon: Building2,
    title: 'Agenturen',
    desc: 'Schütze deine Clients vor KI-generierten Fake-Visuals mit systemischer Verifizierung.',
    accent: '#8B5CF6',
    detail: 'Brand Safety · Campaign Audit · Compliance',
  },
  {
    icon: Users,
    title: 'Unternehmen',
    desc: 'Interne Checks für Brand Safety, Compliance und Content-Qualitätssicherung.',
    accent: '#35D6FF',
    detail: 'Internal Review · Risk Management · QA',
  },
  {
    icon: Camera,
    title: 'Creator',
    desc: 'Beweise die Authentizität deiner Arbeit. Hebe dich von KI-generiertem Content ab.',
    accent: '#8B5CF6',
    detail: 'Photography · Portfolio · Attribution',
  },
];

export function AudienceFitSection() {
  return (
    <section className="relative py-20 md:py-28 px-5 md:px-12" style={{ background: '#06070A' }}>
      {/* Top glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.22), transparent)' }}
      />

      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-[26px] md:text-[42px] font-bold text-[#F5F7FB] mb-4 leading-tight">
            Relevanz ohne fake Social Proof.
          </h2>
          <p className="text-[16px] text-[#9AA6B2] max-w-lg mx-auto">
            AIRealCheck ist für jede Person gebaut, die Verantwortung
            für digitale Medien trägt.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {audiences.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="rounded-2xl p-7 flex gap-5 transition-all duration-300"
              style={{
                background: '#0B0D12',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${a.accent}25`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
              }}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: `${a.accent}10`,
                  border: `1px solid ${a.accent}20`,
                  boxShadow: `0 0 16px ${a.accent}12`,
                }}
              >
                <a.icon size={22} style={{ color: a.accent }} />
              </div>

              <div>
                <h3 className="text-[15px] font-semibold text-[#F5F7FB] mb-1.5">{a.title}</h3>
                <p className="text-[13px] text-[#9AA6B2] leading-relaxed mb-3">{a.desc}</p>
                <p className="text-[11px] font-mono" style={{ color: `${a.accent}80` }}>
                  {a.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
