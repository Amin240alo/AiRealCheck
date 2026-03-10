'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanSearch,
  History,
  Zap,
  ShieldCheck,
  HelpCircle,
  Image as ImageIcon,
  Video,
  Music,
  ArrowRight,
  Sparkles,
  TrendingUp,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchDashboard,
  type DashboardStats,
  type DashboardResponse,
} from '@/lib/services/analysisService';
import type { HistoryEntry } from '@/lib/types';
import { VerdictBadge } from '@/components/analysis/VerdictBadge';
import { formatDateShort } from '@/lib/utils';

// ─── helpers ────────────────────────────────────────────────────────────────

function greeting(name?: string | null): string {
  const hour = new Date().getHours();
  const salut = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
  return name ? `${salut}, ${name.split(' ')[0]}` : salut;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

// ─── Donut chart ─────────────────────────────────────────────────────────────

interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const r = 44;
  const C = 2 * Math.PI * r;
  const cx = 60;
  const cy = 60;

  const rendered = segments.filter(s => s.value > 0);

  if (total === 0) {
    return (
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-border)" strokeWidth={12} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={11} fill="var(--color-muted)" fontFamily="inherit">
          Keine
        </text>
      </svg>
    );
  }

  let offset = C / 4; // start at 12 o'clock
  return (
    <svg width={120} height={120} viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg) scaleX(-1)' }}>
      {rendered.map((seg) => {
        const portion = (seg.value / total) * C;
        const el = (
          <motion.circle
            key={seg.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={12}
            strokeDasharray={`${portion} ${C}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            initial={{ strokeDasharray: `0 ${C}` }}
            animate={{ strokeDasharray: `${portion} ${C}` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          />
        );
        offset += portion;
        return el;
      })}
    </svg>
  );
}

// ─── KPI card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  delay?: number;
}

function KpiCard({ label, value, sub, icon: Icon, color, delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-5 flex flex-col gap-3"
    >
      <div className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center" style={{ background: color + '20' }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <div className="text-[28px] font-bold text-[var(--color-text)] leading-none tabular-nums">{value}</div>
        {sub && <div className="text-[11px] text-[var(--color-muted-2)] mt-0.5 tabular-nums">{sub}</div>}
      </div>
      <div className="text-[12px] text-[var(--color-muted)]">{label}</div>
    </motion.div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded-[var(--radius-md)] bg-[var(--color-surface-2)] animate-pulse ${className ?? ''}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

// ─── Recent row ──────────────────────────────────────────────────────────────

const TYPE_ICONS = {
  image: <ImageIcon size={14} />,
  video: <Video size={14} />,
  audio: <Music size={14} />,
} as const;

function RecentRow({ entry, onClick }: { entry: HistoryEntry; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] hover:bg-[var(--color-surface-2)] transition-colors text-left group"
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-surface-2)] text-[var(--color-muted)] flex-shrink-0 group-hover:bg-[var(--color-surface-3)] transition-colors">
        {entry.media_type ? TYPE_ICONS[entry.media_type as keyof typeof TYPE_ICONS] ?? <HelpCircle size={14} /> : <HelpCircle size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[var(--color-text)] truncate">{entry.title ?? 'Analyse'}</div>
        <div className="text-[11px] text-[var(--color-muted-2)] mt-0.5">{formatDateShort(entry.created_at)}</div>
      </div>
      <div className="flex-shrink-0">
        <VerdictBadge entry={entry} size="sm" />
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user, balance, isLoggedIn } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || fetchedRef.current) return;
    fetchedRef.current = true;

    // fetch dashboard data + health check in parallel
    Promise.all([
      fetchDashboard()
        .then(d => setData(d))
        .catch(() => setError('Statistiken konnten nicht geladen werden.')),
      fetch('/health')
        .then(r => setBackendUp(r.ok))
        .catch(() => setBackendUp(false)),
    ]).finally(() => setLoading(false));
  }, [isLoggedIn]);

  const stats: DashboardStats | null = data?.stats ?? null;
  const recent: HistoryEntry[] = data?.recent ?? [];

  const planType = balance?.plan_type ?? 'free';
  const credits = balance?.credits_available ?? null;
  const isPaid = planType !== 'free';

  const mediaBreakdown = stats?.media_breakdown ?? {};
  const mediaTotal = Object.values(mediaBreakdown).reduce((a, b) => a + b, 0);
  const donutSegments = [
    { label: 'Bild', value: mediaBreakdown.image ?? 0, color: '#22d3ee' },
    { label: 'Video', value: mediaBreakdown.video ?? 0, color: '#a78bfa' },
    { label: 'Audio', value: mediaBreakdown.audio ?? 0, color: '#34d399' },
  ];

  const aiPct = stats && stats.total_analyses > 0
    ? Math.round((stats.ai_count / stats.total_analyses) * 100)
    : null;
  const realPct = stats && stats.total_analyses > 0
    ? Math.round((stats.real_count / stats.total_analyses) * 100)
    : null;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-5 py-10">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-10 space-y-7">

      {/* ── Hero header ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[26px] font-bold text-[var(--color-text)] leading-tight">
              {greeting(user?.display_name)}
            </h1>
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
              style={{
                background: isPaid ? '#a78bfa20' : 'var(--color-surface-2)',
                borderColor: isPaid ? '#a78bfa50' : 'var(--color-border)',
                color: isPaid ? '#a78bfa' : 'var(--color-muted)',
              }}
            >
              {isPaid && <Sparkles size={9} className="mr-1" />}
              {PLAN_LABELS[planType] ?? planType}
            </span>
          </div>
          <p className="text-[14px] text-[var(--color-muted)] mt-1">
            {credits !== null ? (
              <span>
                <span className="font-semibold text-[var(--color-text)]">{credits}</span> Credits verfügbar
              </span>
            ) : 'Hier ist dein Überblick'}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2.5">
          <button
            onClick={() => router.push('/analyze')}
            aria-label="Neue Analyse starten"
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-lg)] text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #22d3ee, #7c3aed)' }}
          >
            <ScanSearch size={15} aria-hidden="true" />
            Neue Analyse
          </button>
          <button
            onClick={() => router.push('/history')}
            aria-label="Analyse-Verlauf anzeigen"
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-lg)] text-[13px] font-medium text-[var(--color-text)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] transition-colors"
          >
            <History size={15} aria-hidden="true" />
            Verlauf
          </button>
        </div>
      </motion.div>

      {/* ── Context banner ────────────────────────────────────────────── */}
      <AnimatePresence>
        {!isPaid && stats && stats.total_analyses > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-[var(--radius-xl)] border text-[13px]"
              style={{ background: '#a78bfa12', borderColor: '#a78bfa40' }}
            >
              <div className="flex items-center gap-2.5 text-[var(--color-text)]">
                <Sparkles size={15} style={{ color: '#a78bfa' }} className="flex-shrink-0" />
                <span>Upgrade auf <strong>Pro</strong> für unbegrenzte Analysen und priorisierte Engines.</span>
              </div>
              <button
                onClick={() => router.push('/premium')}
                className="flex items-center gap-1 text-[12px] font-semibold flex-shrink-0"
                style={{ color: '#a78bfa' }}
              >
                Mehr erfahren <ArrowRight size={12} />
              </button>
            </div>
          </motion.div>
        )}
        {isPaid && stats && stats.total_analyses >= 10 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="flex items-center gap-2.5 px-5 py-3 rounded-[var(--radius-xl)] border text-[13px] text-[var(--color-text)]"
              style={{ background: '#22d3ee12', borderColor: '#22d3ee40' }}
            >
              <CheckCircle size={15} style={{ color: '#22d3ee' }} className="flex-shrink-0" />
              <span>
                Du hast bereits <strong>{stats.total_analyses}</strong> Analysen durchgeführt. Super!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KPI cards ─────────────────────────────────────────────────── */}
      {error ? (
        <div className="flex items-center gap-2.5 p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[13px] text-[var(--color-muted)]">
          <AlertCircle size={15} className="text-[var(--color-warning)] flex-shrink-0" />
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard
            label="Analysen gesamt"
            value={stats?.total_analyses ?? 0}
            icon={Activity}
            color="#22d3ee"
            delay={0.05}
          />
          <KpiCard
            label="KI erkannt"
            value={stats?.ai_count ?? 0}
            sub={aiPct !== null ? `${aiPct}% aller Analysen` : undefined}
            icon={Zap}
            color="var(--color-danger)"
            delay={0.1}
          />
          <KpiCard
            label="Als echt eingestuft"
            value={stats?.real_count ?? 0}
            sub={realPct !== null ? `${realPct}% aller Analysen` : undefined}
            icon={ShieldCheck}
            color="var(--color-success)"
            delay={0.15}
          />
          <KpiCard
            label="Analysen (7 Tage)"
            value={stats?.analyses_7d ?? 0}
            icon={TrendingUp}
            color="#a78bfa"
            delay={0.2}
          />
          <KpiCard
            label="Credits (30 Tage)"
            value={stats?.credits_30d ?? 0}
            sub={stats?.credits_7d ? `${stats.credits_7d} in 7 Tagen` : undefined}
            icon={CreditCard}
            color="var(--color-primary)"
            delay={0.25}
          />
        </div>
      )}

      {/* ── Main content row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent analyses */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
          className="lg:col-span-2 rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <div className="text-[13px] font-semibold text-[var(--color-text)]">Letzte Analysen</div>
            <button
              onClick={() => router.push('/history')}
              className="flex items-center gap-1 text-[12px] text-[var(--color-primary)] hover:underline"
            >
              Alle anzeigen <ArrowRight size={12} />
            </button>
          </div>
          <div className="flex-1 p-2">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
                  <ScanSearch size={22} className="text-[var(--color-muted)]" />
                </div>
                <div className="text-[13px] text-[var(--color-muted)]">Noch keine Analysen</div>
                <button
                  onClick={() => router.push('/analyze')}
                  className="text-[12px] text-[var(--color-primary)] hover:underline"
                >
                  Erste Analyse starten →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {recent.map(entry => (
                  <RecentRow
                    key={entry.id}
                    entry={entry}
                    onClick={() => router.push('/history')}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Right column: donut + system health */}
        <div className="flex flex-col gap-5">

          {/* Media type distribution */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.35 }}
            className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-5"
          >
            <div className="text-[13px] font-semibold text-[var(--color-text)] mb-4">Medientypen</div>
            <div className="flex items-center gap-4">
              <DonutChart segments={donutSegments} total={mediaTotal} />
              <div className="space-y-2 flex-1">
                {donutSegments.map(seg => (
                  <div key={seg.label} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
                      <span className="text-[var(--color-muted)]">{seg.label}</span>
                    </div>
                    <span className="font-medium text-[var(--color-text)] tabular-nums">{seg.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* System health */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.35 }}
            className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-5"
          >
            <div className="text-[13px] font-semibold text-[var(--color-text)] mb-3">Systemstatus</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--color-muted)]">API</span>
                {backendUp === null ? (
                  <span className="text-[var(--color-muted-2)]">Prüfen…</span>
                ) : backendUp ? (
                  <span className="flex items-center gap-1.5 text-[var(--color-success)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                    Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[var(--color-danger)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger)]" />
                    Offline
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--color-muted)]">Analyse-Engine</span>
                <span className="flex items-center gap-1.5 text-[var(--color-success)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                  Aktiv
                </span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>

    </div>
  );
}
