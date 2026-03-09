import Link from 'next/link';
import { ThemeLogo } from '@/components/ui/ThemeLogo';

export function FooterSection() {
  return (
    <footer
      className="relative px-5 md:px-12 pt-16 pb-10"
      style={{
        background: '#050608',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Top subtle glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }}
      />

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8 mb-14">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <ThemeLogo height="h-7" className="mb-5" />
            <p className="text-[12px] text-[#9AA6B2]/60 leading-relaxed max-w-[180px]">
              Vertrauen in digitale Medien durch KI-Ensemble-Analyse.
            </p>

            {/* Status indicator */}
            <div className="flex items-center gap-2 mt-5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"
                style={{ boxShadow: '0 0 6px rgba(34,197,94,0.6)' }} />
              <span className="text-[11px] text-[#9AA6B2]/50">All systems operational</span>
            </div>
          </div>

          {/* Produkt */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9AA6B2]/40 mb-5">
              Produkt
            </div>
            <div className="space-y-3">
              {[
                ['Features', '#features'],
                ['So funktioniert es', '#how-it-works'],
                ['Preise', '#pricing'],
                ['Demo', '#demo'],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  className="block text-[13px] text-[#9AA6B2]/70 hover:text-[#F5F7FB] transition-colors duration-150"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Account */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9AA6B2]/40 mb-5">
              Account
            </div>
            <div className="space-y-3">
              {[
                ['Login', '/login'],
                ['Registrierung', '/register'],
                ['Support', '/support'],
              ].map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="block text-[13px] text-[#9AA6B2]/70 hover:text-[#F5F7FB] transition-colors duration-150"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Rechtliches */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9AA6B2]/40 mb-5">
              Rechtliches
            </div>
            <div className="space-y-3">
              {[
                ['Datenschutz', '/legal?section=privacy'],
                ['Impressum', '/legal?section=impressum'],
                ['AGB', '/legal?section=tac'],
              ].map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="block text-[13px] text-[#9AA6B2]/70 hover:text-[#F5F7FB] transition-colors duration-150"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col md:flex-row items-center justify-between gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span className="text-[12px] text-[#9AA6B2]/35">
            © 2026 AIRealCheck. All rights reserved.
          </span>
          <span className="text-[12px] text-[#9AA6B2]/35">
            Built for professional verification work.
          </span>
        </div>
      </div>
    </footer>
  );
}
