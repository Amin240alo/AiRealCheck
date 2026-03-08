'use client';

import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';

export default function FeedbackPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[var(--color-text)]">Feedback</h1>
        <p className="text-[13px] text-[var(--color-muted)] mt-1">Dein Feedback hilft uns, AIRealCheck zu verbessern.</p>
      </div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center mx-auto mb-4">
          <MessageSquare size={24} className="text-[var(--color-muted)]" />
        </div>
        <h2 className="text-[17px] font-bold text-[var(--color-text)] mb-2">Feedback-Formular kommt bald</h2>
        <p className="text-[13px] text-[var(--color-muted)]">In der Zwischenzeit kannst du uns per E-Mail erreichen: <strong>feedback@airealcheck.com</strong></p>
      </motion.div>
    </div>
  );
}
