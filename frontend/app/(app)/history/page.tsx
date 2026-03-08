'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Video, Music, CheckCircle2, XCircle, HelpCircle, ChevronDown, ChevronUp, RefreshCw, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import type { HistoryItem, MediaType } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const TYPE_ICONS: Record<MediaType, React.ReactNode> = {
  image: <ImageIcon size={15} />,
  video: <Video size={15} />,
  audio: <Music size={15} />,
};

const TYPE_LABELS: Record<MediaType, string> = { image: 'Bild', video: 'Video', audio: 'Audio' };

function RiskBadge({ score, confidence }: { score?: number; confidence?: string }) {
  const fake = Number(score || 0);
  const conf = String(confidence || '').toLowerCase();
  const verdict = (fake >= 70 && conf !== 'low') ? 'fake' : ((100 - fake) >= 70 && conf !== 'low' ? 'real' : 'uncertain');
  if (verdict === 'real') return <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-success-muted)] text-[var(--color-success)]">Echt</span>;
  if (verdict === 'fake') return <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-danger-muted)] text-[var(--color-danger)]">KI erkannt</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-warning-muted)] text-[var(--color-warning)]">Unklar</span>;
}

function HistoryItemCard({ item }: { item: HistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const statusOk = item.status === 'success';

  return (
    <motion.div layout className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
      <button
        onClick={() => statusOk && setExpanded(!expanded)}
        className={`flex items-center gap-4 w-full px-5 py-4 text-left transition-colors ${statusOk ? 'hover:bg-[var(--color-surface-2)] cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-[var(--color-surface-2)] text-[var(--color-muted)]">
          {TYPE_ICONS[item.media_type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-[var(--color-text)]">
              {item.filename ? item.filename.slice(0, 40) : `${TYPE_LABELS[item.media_type]} Analyse`}
            </span>
            {statusOk && item.fake_score !== undefined ? (
              <RiskBadge score={item.fake_score} confidence={item.confidence} />
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-muted-2)]">
                {item.status === 'failed' ? 'Fehlgeschlagen' : 'Ausstehend'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--color-muted-2)]">
            <Clock size={11} />
            <span>{formatDate(item.created_at)}</span>
            {item.credits_used !== undefined && <span>· {item.credits_used} Credits</span>}
          </div>
        </div>
        {statusOk && (expanded ? <ChevronUp size={14} className="text-[var(--color-muted-2)] flex-shrink-0" /> : <ChevronDown size={14} className="text-[var(--color-muted-2)] flex-shrink-0" />)}
      </button>

      <AnimatePresence>
        {expanded && statusOk && item.fake_score !== undefined && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-[var(--color-border)]">
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <div className="text-[var(--color-muted-2)]">KI-Wahrscheinlichkeit</div>
                  <div className="font-semibold text-[var(--color-text)] mt-0.5">{Math.round(item.fake_score)}%</div>
                  <div className="h-1 rounded-full bg-[var(--color-surface-3)] mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-danger)]" style={{ width: `${item.fake_score}%` }} />
                  </div>
                </div>
                {item.confidence && (
                  <div>
                    <div className="text-[var(--color-muted-2)]">Sicherheit</div>
                    <div className="font-semibold text-[var(--color-text)] mt-0.5 capitalize">{
                      item.confidence === 'high' ? 'Hoch' : item.confidence === 'medium' ? 'Mittel' : 'Niedrig'
                    }</div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function HistoryPage() {
  const { isLoggedIn } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | MediaType>('all');

  const fetchHistory = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await apiFetch<{ items: HistoryItem[] }>('/api/history?limit=50');
      setItems(data.items || []);
    } catch {
      setError('Verlauf konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isLoggedIn) fetchHistory(); else setLoading(false); }, [isLoggedIn, fetchHistory]);

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
  const last7 = items.filter(i => new Date(i.created_at).getTime() > sevenDaysAgo);
  const aiDetected = last7.filter(i => i.status === 'success' && (i.fake_score || 0) >= 70).length;

  const filtered = filter === 'all' ? items : items.filter(i => i.media_type === filter);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-[24px] font-bold text-[var(--color-text)]">Verlauf</h1>
          <p className="text-[14px] text-[var(--color-muted)] mt-1.5">Deine letzten Prüfungen</p>
        </div>
        {isLoggedIn && (
          <button onClick={fetchHistory} className="p-2 rounded-[var(--radius-md)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors">
            <RefreshCw size={16} />
          </button>
        )}
      </div>

      {/* Stats */}
      {isLoggedIn && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-5">
            <div className="text-[26px] font-bold text-[var(--color-text)] leading-none">{last7.length}</div>
            <div className="text-[12px] text-[var(--color-muted)] mt-1.5">Analysen (7 Tage)</div>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-5">
            <div className="text-[26px] font-bold text-[var(--color-danger)] leading-none">{aiDetected}</div>
            <div className="text-[12px] text-[var(--color-muted)] mt-1.5">KI erkannt</div>
          </div>
        </div>
      )}

      {/* Filters */}
      {isLoggedIn && items.length > 0 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {(['all', 'image', 'video', 'audio'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`h-7 px-3 rounded-full text-[12px] font-medium transition-all ${
                filter === f
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}>
              {f === 'all' ? 'Alle' : f === 'image' ? 'Bilder' : f === 'video' ? 'Videos' : 'Audio'}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {!isLoggedIn ? (
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center">
          <div className="text-[var(--color-muted)] mb-4">Bitte anmelden, um deinen Verlauf zu sehen.</div>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-[13px]">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center">
          <div className="text-[var(--color-muted-2)] text-[36px] mb-3">○</div>
          <div className="text-[14px] font-medium text-[var(--color-text)] mb-1">Keine Einträge</div>
          <div className="text-[13px] text-[var(--color-muted)]">Starte deine erste Analyse um sie hier zu sehen.</div>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <HistoryItemCard item={item} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
