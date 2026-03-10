import React from 'react';
import type { HistoryEntry } from '@/lib/types';

interface VerdictBadgeProps {
  entry: Pick<HistoryEntry, 'final_score' | 'confidence_label' | 'verdict_label'>;
  size?: 'sm' | 'md';
}

export function VerdictBadge({ entry, size = 'sm' }: VerdictBadgeProps) {
  const score = entry.final_score ?? 0;
  const isLow = entry.confidence_label === 'low';
  const px = size === 'md' ? 'px-2.5 py-1 text-[12px]' : 'px-2 py-0.5 text-[11px]';

  const isAi = score >= 70 && !isLow;
  const isReal = score <= 30 && !isLow;

  const label = entry.verdict_label
    ? entry.verdict_label
    : isAi ? 'KI erkannt'
    : isReal ? 'Echt'
    : 'Unklar';

  if (isAi) {
    return (
      <span className={`${px} rounded-full font-medium bg-[var(--color-danger-muted)] text-[var(--color-danger)]`}>
        {label}
      </span>
    );
  }
  if (isReal) {
    return (
      <span className={`${px} rounded-full font-medium bg-[var(--color-success-muted)] text-[var(--color-success)]`}>
        {label}
      </span>
    );
  }
  return (
    <span className={`${px} rounded-full font-medium bg-[var(--color-warning-muted)] text-[var(--color-warning)]`}>
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: HistoryEntry['status'] }) {
  if (status === 'failed') {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-danger-muted)] text-[var(--color-danger)]">
        Fehlgeschlagen
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-muted)]">
        Ausstehend
      </span>
    );
  }
  return null;
}
