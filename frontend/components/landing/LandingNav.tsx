'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'So funktioniert es', href: '#how-it-works' },
  { label: 'Preise', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  // Close on resize to desktop
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setOpen(false);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  function closeAndNavigate() {
    setOpen(false);
  }

  return (
    <>
      <nav
        className="sticky top-0 z-50 flex items-center justify-between h-16 px-5 md:px-12"
        style={{
          background: 'rgba(6,7,10,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 1px 0 rgba(53,214,255,0.05)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Assets/Logos/airealcheck-secondary.png"
            alt="AIRealCheck"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8 text-[13px] text-[#9AA6B2]">
          {navLinks.map(l => (
            <a key={l.label} href={l.href} className="hover:text-[#F5F7FB] transition-colors duration-150">
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="h-9 px-4 text-[13px] text-[#9AA6B2] hover:text-[#F5F7FB] transition-colors flex items-center">
            Login
          </Link>
          <Link
            href="/register"
            className="h-9 px-5 rounded-lg text-[13px] font-semibold text-[#06070A] flex items-center transition-all hover:brightness-110"
            style={{ background: '#35D6FF', boxShadow: '0 0 16px rgba(53,214,255,0.22)' }}
          >
            Kostenlos starten
          </Link>
        </div>

        {/* Mobile: Login + Hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <Link href="/login" className="h-9 px-3 text-[13px] text-[#9AA6B2] flex items-center">
            Login
          </Link>
          <button
            onClick={() => setOpen(v => !v)}
            className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X size={18} style={{ color: '#D9E0EA' }} /> : <Menu size={18} style={{ color: '#D9E0EA' }} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            {/* Drawer panel */}
            <motion.div
              className="fixed top-16 left-0 right-0 z-40 md:hidden"
              style={{
                background: 'rgba(11,13,18,0.97)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
              }}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="px-5 py-4 space-y-1">
                {navLinks.map((l, i) => (
                  <motion.a
                    key={l.label}
                    href={l.href}
                    onClick={closeAndNavigate}
                    className="flex items-center h-12 px-3 rounded-xl text-[15px] text-[#D9E0EA] hover:text-[#F5F7FB] transition-colors"
                    style={{ background: 'transparent' }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {l.label}
                  </motion.a>
                ))}
              </div>

              <div className="px-5 pb-5 pt-1">
                <Link
                  href="/register"
                  onClick={closeAndNavigate}
                  className="flex items-center justify-center w-full h-12 rounded-xl text-[15px] font-bold text-[#06070A] transition-all hover:brightness-110"
                  style={{ background: '#35D6FF', boxShadow: '0 0 20px rgba(53,214,255,0.22)' }}
                >
                  Kostenlos starten — 100 Free Credits
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
