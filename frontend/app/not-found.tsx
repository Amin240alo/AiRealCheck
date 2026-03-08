'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="text-[80px] font-bold text-[var(--color-surface-3)] mb-4">404</div>
        <h1 className="text-[24px] font-bold text-[var(--color-text)] mb-2">Seite nicht gefunden</h1>
        <p className="text-[14px] text-[var(--color-muted)] mb-8">Die angeforderte Seite existiert nicht.</p>
        <Link
          href="/"
          className="inline-flex items-center h-10 px-6 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Zurück zur Startseite
        </Link>
      </motion.div>
    </div>
  );
}
