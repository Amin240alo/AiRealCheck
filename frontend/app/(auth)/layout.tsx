import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AIRealCheck — Anmelden',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
      <header className="flex items-center justify-center h-16 border-b border-[var(--color-border)]">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Assets/Logos/airealcheck-secondary.png" alt="AIRealCheck" className="h-8 object-contain" />
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        {children}
      </main>
      <footer className="text-center py-4 text-[11px] text-[var(--color-muted-2)]">
        © 2026 AIRealCheck
      </footer>
    </div>
  );
}
