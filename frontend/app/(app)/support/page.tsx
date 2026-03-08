'use client';

import { motion } from 'framer-motion';
import { HelpCircle, Mail } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[var(--color-text)]">Support & Hilfe</h1>
        <p className="text-[13px] text-[var(--color-muted)] mt-1">Wir sind für dich da.</p>
      </div>
      <div className="space-y-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
          <div className="flex items-start gap-3">
            <HelpCircle size={20} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--color-text)] mb-1">FAQ</h3>
              <p className="text-[13px] text-[var(--color-muted)]">Antworten auf häufige Fragen findest du auf unserer Landing Page.</p>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
          <div className="flex items-start gap-3">
            <Mail size={20} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--color-text)] mb-1">Kontakt</h3>
              <p className="text-[13px] text-[var(--color-muted)]">Schreib uns an <strong>support@airealcheck.com</strong></p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
