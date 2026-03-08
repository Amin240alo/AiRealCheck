'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

const SECTIONS = [
  { id: 'impressum', label: 'Impressum' },
  { id: 'privacy', label: 'Datenschutz' },
  { id: 'tac', label: 'AGB' },
];

const CONTENT: Record<string, string> = {
  impressum: 'Angaben gemäß § 5 TMG. AIRealCheck — Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV. Diese Seite befindet sich im Aufbau.',
  privacy: 'Datenschutzerklärung: Wir erheben und verarbeiten personenbezogene Daten nur soweit erforderlich und nach geltendem Datenschutzrecht. Diese Seite befindet sich im Aufbau.',
  tac: 'Allgemeine Geschäftsbedingungen: Durch die Nutzung von AIRealCheck stimmen Sie unseren AGB zu. Diese Seite befindet sich im Aufbau.',
};

function LegalContent() {
  const searchParams = useSearchParams();
  const [section, setSection] = useState('impressum');

  useEffect(() => {
    const s = searchParams.get('section');
    if (s && SECTIONS.find(x => x.id === s)) setSection(s);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-[26px] font-bold text-[var(--color-text)] mb-6">Rechtliches</h1>
        <div className="flex gap-1 mb-6 p-1 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] w-fit">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`h-8 px-4 rounded-[var(--radius-sm)] text-[13px] font-medium transition-all ${
                section === s.id ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] p-8">
          <h2 className="text-[20px] font-bold text-[var(--color-text)] mb-4">{SECTIONS.find(s2 => s2.id === section)?.label}</h2>
          <p className="text-[14px] text-[var(--color-muted)] leading-relaxed">{CONTENT[section]}</p>
        </motion.div>
      </div>
    </div>
  );
}

export default function LegalPage() {
  return (
    <Suspense>
      <LegalContent />
    </Suspense>
  );
}
