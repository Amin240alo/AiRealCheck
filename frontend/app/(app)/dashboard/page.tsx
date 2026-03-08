'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ScanSearch, History, TrendingUp, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import type { HistoryItem } from '@/lib/types';

export default function DashboardPage() {
  const router = useRouter();
  const { user, balance, isLoggedIn } = useAuth();
  const [recentItems, setRecentItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!isLoggedIn) return;
    apiFetch<{ items: HistoryItem[] }>('/api/history?limit=5').then(d => setRecentItems(d.items || [])).catch(() => {});
  }, [isLoggedIn]);

  const last7 = recentItems.filter(i => new Date(i.created_at).getTime() > Date.now() - 7*24*3600*1000);
  const aiDetected = recentItems.filter(i => (i.fake_score || 0) >= 70).length;

  const stats = [
    { label: 'Verfügbare Credits', value: balance?.credits_available ?? '—', icon: CreditCard, color: 'var(--color-primary)' },
    { label: 'Analysen (7 Tage)', value: last7.length, icon: TrendingUp, color: 'var(--color-success)' },
    { label: 'KI erkannt', value: aiDetected, icon: History, color: 'var(--color-danger)' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-9">
        <h1 className="text-[26px] font-bold text-[var(--color-text)]">
          Guten Tag{user?.display_name ? `, ${user.display_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-[14px] text-[var(--color-muted)] mt-1.5">Hier ist dein Überblick</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-[var(--radius-lg)] flex items-center justify-center" style={{ background: stat.color + '18' }}>
                <stat.icon size={20} style={{ color: stat.color }} />
              </div>
            </div>
            <div className="text-[32px] font-bold text-[var(--color-text)] leading-none">{stat.value}</div>
            <div className="text-[13px] text-[var(--color-muted)] mt-2">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          onClick={() => router.push('/analyze')}
          className="flex items-center gap-5 p-6 rounded-[var(--radius-xl)] bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-all text-left shadow-[var(--shadow-md)]">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <ScanSearch size={22} />
          </div>
          <div>
            <div className="text-[16px] font-semibold">Neue Analyse starten</div>
            <div className="text-[13px] opacity-80 mt-0.5">Bild, Video oder Audio prüfen</div>
          </div>
        </motion.button>

        <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          onClick={() => router.push('/history')}
          className="flex items-center gap-5 p-6 rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-all text-left">
          <div className="w-12 h-12 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center flex-shrink-0">
            <History size={22} className="text-[var(--color-muted)]" />
          </div>
          <div>
            <div className="text-[16px] font-semibold">Verlauf anzeigen</div>
            <div className="text-[13px] text-[var(--color-muted)] mt-0.5">Letzte {recentItems.length} Analysen</div>
          </div>
        </motion.button>
      </div>
    </div>
  );
}
