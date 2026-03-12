'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, Video, Music, Clock, Cpu, AlertTriangle } from 'lucide-react';
import type { HistoryEntry, HistoryDetail, MediaType } from '@/lib/types';
import { fetchHistoryDetail } from '@/lib/services/analysisService';
import { formatDate } from '@/lib/utils';
import { VerdictBadge, StatusBadge } from './VerdictBadge';

const TYPE_ICONS: Record<MediaType, React.ReactNode> = {
  image: <ImageIcon size={16} />,
  video: <Video size={16} />,
  audio: <Music size={16} />,
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
};

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
}

interface Props {
  entry: HistoryEntry | null;
  onClose: () => void;
}

export function AnalysisDetailPanel({ entry, onClose }: Props) {
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entry || entry.status !== 'success') {
      setDetail(null);
      return;
    }
    setLoading(true);
    fetchHistoryDetail(entry.id)
      .then(d => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [entry?.id]);

  const score = entry?.final_score ?? 0;
  const scoreColor = score >= 70 ? 'var(--color-danger)' : score <= 30 ? 'var(--color-success)' : 'var(--color-warning)';

  const engines = detail?.engine_breakdown
    ? Object.entries(detail.engine_breakdown)
        .map(([name, val]) => ({
          name,
          score: typeof val === 'number' ? val : typeof val === 'object' && val !== null ? (val.score ?? null) : null,
        }))
        .filter(e => e.score !== null)
    : [];

  const signals: { type: 'reason' | 'warning'; text: string }[] = [];
  if (detail?.result_payload) {
    for (const t of (detail.result_payload.reasons_user ?? [])) signals.push({ type: 'reason', text: t });
    for (const t of (detail.result_payload.warnings_user ?? [])) signals.push({ type: 'warning', text: t });
  }

  return (
    <AnimatePresence>
      {entry && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-[var(--shadow-lg)] flex flex-col overflow-hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-surface-2)] text-[var(--color-muted)]">
                  {entry.media_type ? TYPE_ICONS[entry.media_type] : null}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--color-text)] truncate max-w-[220px]">
                    {entry.title ?? 'Analyse'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--color-muted-2)]">
                    <Clock size={10} />
                    <span>{formatDate(entry.created_at)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

              {/* Verdict + score */}
              {entry.status === 'success' && entry.final_score !== null ? (
                <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <VerdictBadge entry={entry} size="md" />
                    {entry.confidence_label && (
                      <span className="text-[11px] text-[var(--color-muted)]">
                        Sicherheit: <span className="font-medium text-[var(--color-text)]">{CONFIDENCE_LABELS[entry.confidence_label] ?? entry.confidence_label}</span>
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-[12px] mb-1.5">
                      <span className="text-[var(--color-muted)]">KI-Wahrscheinlichkeit</span>
                      <span className="font-semibold" style={{ color: scoreColor }}>{Math.round(score)}%</span>
                    </div>
                    <ScoreBar score={score} color={scoreColor} />
                  </div>
                </div>
              ) : (
                <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] p-5">
                  <StatusBadge status={entry.status} />
                </div>
              )}

              {/* Signals */}
              {signals.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-muted)] mb-2">Signale</div>
                  <div className="space-y-1.5">
                    {signals.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-[12px]">
                        {s.type === 'warning' ? (
                          <AlertTriangle size={12} className="text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-muted-2)] mt-1.5 flex-shrink-0" />
                        )}
                        <span className="text-[var(--color-muted)]">{s.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Engine breakdown */}
              {loading && (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-8 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] animate-pulse" />
                  ))}
                </div>
              )}
              {!loading && engines.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-[var(--color-muted)] mb-2">
                    <Cpu size={11} />
                    <span>Engines</span>
                  </div>
                  <div className="space-y-2.5">
                    {engines.map(e => {
                      const s = e.score as number;
                      const c = s >= 70 ? 'var(--color-danger)' : s <= 30 ? 'var(--color-success)' : 'var(--color-warning)';
                      return (
                        <div key={e.name}>
                          <div className="flex justify-between text-[12px] mb-1">
                            <span className="text-[var(--color-muted)] capitalize">{e.name}</span>
                            <span className="font-medium" style={{ color: c }}>{Math.round(s)}%</span>
                          </div>
                          <ScoreBar score={s} color={c} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                {entry.credits_charged > 0 && (
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-3">
                    <div className="text-[var(--color-muted)]">Credits</div>
                    <div className="font-semibold text-[var(--color-text)] mt-0.5">{entry.credits_charged}</div>
                  </div>
                )}
                {entry.media_type && (
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-3">
                    <div className="text-[var(--color-muted)]">Typ</div>
                    <div className="font-semibold text-[var(--color-text)] mt-0.5 capitalize">{entry.media_type}</div>
                  </div>
                )}
              </div>

              {/* Analysis ID */}
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-3 py-2.5 text-[11px]">
                <div className="text-[var(--color-muted)] mb-1">Analyse-ID</div>
                <div className="font-mono text-[var(--color-text)] break-all select-all">{entry.id}</div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
