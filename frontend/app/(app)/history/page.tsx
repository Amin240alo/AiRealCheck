'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Video, Music, RefreshCw, Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchHistory } from '@/lib/services/analysisService';
import type { HistoryEntry, HistoryListResponse, MediaType } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { VerdictBadge, StatusBadge } from '@/components/analysis/VerdictBadge';
import { AnalysisDetailPanel } from '@/components/analysis/AnalysisDetailPanel';
import { useT, useLang } from '@/contexts/LanguageContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type VerdictFilter = '' | 'likely_ai' | 'likely_real' | 'uncertain';
type MediaFilter = '' | MediaType;
type ConfidenceFilter = '' | 'high' | 'medium' | 'low';
type SortOption = 'newest' | 'oldest';

interface Filters {
  search: string;
  media_type: MediaFilter;
  verdict: VerdictFilter;
  confidence: ConfidenceFilter;
  sort: SortOption;
}

const PAGE_SIZE = 20;

// ─── Sub-components ──────────────────────────────────────────────────────────

const TYPE_ICONS: Record<MediaType, React.ReactNode> = {
  image: <ImageIcon size={15} />,
  video: <Video size={15} />,
  audio: <Music size={15} />,
};

function SkeletonCard() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse">
      <div className="w-9 h-9 rounded-full bg-[var(--color-surface-2)] flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-[var(--color-surface-2)] rounded w-2/5" />
        <div className="h-2.5 bg-[var(--color-surface-2)] rounded w-1/4" />
      </div>
      <div className="h-5 w-16 bg-[var(--color-surface-2)] rounded-full" />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`h-7 px-3 rounded-full text-[12px] font-medium transition-all whitespace-nowrap ${
        active
          ? 'bg-[var(--color-primary)] text-white'
          : 'bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
      }`}
    >
      {children}
    </button>
  );
}

function HistoryRow({
  item,
  onClick,
  selected,
}: {
  item: HistoryEntry;
  onClick: () => void;
  selected: boolean;
}) {
  const { t } = useT();
  const lang = useLang();
  const statusOk = item.status === 'success';
  const displayName = item.title ? item.title.slice(0, 50) : `${item.media_type ?? t('history.analysis')} ${t('history.analysis')}`;

  return (
    <motion.button
      layout
      onClick={onClick}
      className={`flex items-center gap-4 w-full px-5 py-4 rounded-[var(--radius-lg)] border transition-all text-left ${
        selected
          ? 'bg-[var(--color-primary-muted)] border-[var(--color-primary)] shadow-[var(--shadow-sm)]'
          : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)] shadow-[var(--shadow-sm)]'
      }`}
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-[var(--color-surface-2)] text-[var(--color-muted)]">
        {item.media_type ? TYPE_ICONS[item.media_type] : null}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-[var(--color-text)] truncate max-w-[200px]">
            {displayName}
          </span>
          {statusOk && item.final_score !== null ? (
            <VerdictBadge entry={item} />
          ) : (
            <StatusBadge status={item.status} />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--color-muted-2)]">
          <span>{formatDate(item.created_at, lang)}</span>
          {item.credits_charged > 0 && <span>· {item.credits_charged} {t('history.credits')}</span>}
          <span className="font-mono text-[10px] opacity-60 select-all">{item.id.slice(0, 8)}</span>
        </div>
      </div>

      <ChevronDown size={13} className="text-[var(--color-muted-2)] flex-shrink-0 -rotate-90" />
    </motion.button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { isLoggedIn } = useAuth();
  const { t, tf } = useT();

  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);

  const [filters, setFilters] = useState<Filters>({
    search: '',
    media_type: '',
    verdict: '',
    confidence: '',
    sort: 'newest',
  });
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(
    async (newOffset = 0, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError('');
      try {
        const res: HistoryListResponse = await fetchHistory({
          limit: PAGE_SIZE,
          offset: newOffset,
          media_type: filters.media_type,
          search: filters.search,
          verdict: filters.verdict,
          confidence: filters.confidence,
          sort: filters.sort,
        });
        setTotal(res.total ?? 0);
        if (append) {
          setItems(prev => [...prev, ...(res.items ?? [])]);
        } else {
          setItems(res.items ?? []);
        }
        setOffset(newOffset + (res.items?.length ?? 0));
      } catch {
        setError(t('history.errorLoad'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    if (isLoggedIn) {
      setOffset(0);
      load(0, false);
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, filters]);

  // ── Search debounce ───────────────────────────────────────────────────────

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setFilters(f => ({ ...f, search: val }));
    }, 350);
  };

  const clearSearch = () => {
    setSearchInput('');
    setFilters(f => ({ ...f, search: '' }));
  };

  // ── Filter helpers ────────────────────────────────────────────────────────

  const setMediaFilter = (val: MediaFilter) => setFilters(f => ({ ...f, media_type: val }));
  const setVerdictFilter = (val: VerdictFilter) => setFilters(f => ({ ...f, verdict: val }));
  const setConfidenceFilter = (val: ConfidenceFilter) => setFilters(f => ({ ...f, confidence: val }));
  const setSortFilter = (val: SortOption) => setFilters(f => ({ ...f, sort: val }));

  const hasActiveFilters =
    !!filters.media_type || !!filters.verdict || !!filters.confidence || filters.sort !== 'newest';

  const clearAllFilters = () =>
    setFilters({ search: '', media_type: '', verdict: '', confidence: '', sort: 'newest' });

  const hasMore = offset < total;

  const loadMore = () => {
    if (!loadingMore && hasMore) load(offset, true);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className={`flex-1 min-w-0 transition-all duration-300 ${selectedEntry ? 'mr-0 lg:mr-[420px]' : ''}`}>
        <div className="max-w-3xl mx-auto px-6 py-10">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[24px] font-bold text-[var(--color-text)]">{t('history.title')}</h1>
              <p className="text-[14px] text-[var(--color-muted)] mt-1">{t('history.subtitle')}</p>
            </div>
            {isLoggedIn && (
              <button
                onClick={() => load(0, false)}
                aria-label={t('history.refresh')}
                title={t('history.refreshLabel')}
                className="p-2 rounded-[var(--radius-md)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <RefreshCw size={15} aria-hidden="true" />
              </button>
            )}
          </div>

          {!isLoggedIn ? (
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-10 text-center">
              <div className="text-[var(--color-muted)] text-[14px]">{t('history.loginRequired')}</div>
            </div>
          ) : (
            <>
              {/* Search + filter toggle */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-2)]" />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder={t('history.searchPh')}
                    aria-label={t('history.searchLabel')}
                    className="w-full h-9 pl-8 pr-8 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                  />
                  {searchInput && (
                    <button onClick={clearSearch} aria-label={t('history.clearSearch')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-2)] hover:text-[var(--color-muted)] transition-colors">
                      <X size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(v => !v)}
                  className={`flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] text-[13px] font-medium transition-all border ${
                    showFilters || hasActiveFilters
                      ? 'bg-[var(--color-primary-muted)] border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <SlidersHorizontal size={13} />
                  <span>{t('history.filter')}</span>
                  {hasActiveFilters && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] ml-0.5" />
                  )}
                </button>
              </div>

              {/* Expanded filter row */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-4 space-y-2.5">
                      {/* Media type */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-[var(--color-muted)] w-16 flex-shrink-0">{t('history.filterType')}</span>
                        {(['', 'image', 'video', 'audio'] as const).map(f => (
                          <FilterChip key={f} active={filters.media_type === f} onClick={() => setMediaFilter(f)}>
                            {f === '' ? t('history.all') : f === 'image' ? t('history.images') : f === 'video' ? t('history.videos') : t('history.audio')}
                          </FilterChip>
                        ))}
                      </div>
                      {/* Verdict */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-[var(--color-muted)] w-16 flex-shrink-0">{t('history.filterVerdict')}</span>
                        {(['', 'likely_ai', 'likely_real', 'uncertain'] as const).map(f => (
                          <FilterChip key={f} active={filters.verdict === f} onClick={() => setVerdictFilter(f)}>
                            {f === '' ? t('history.all') : f === 'likely_ai' ? t('history.aiDetected') : f === 'likely_real' ? t('history.real') : t('history.unclear')}
                          </FilterChip>
                        ))}
                      </div>
                      {/* Confidence */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-[var(--color-muted)] w-16 flex-shrink-0">{t('history.filterConfidence')}</span>
                        {(['', 'high', 'medium', 'low'] as const).map(f => (
                          <FilterChip key={f} active={filters.confidence === f} onClick={() => setConfidenceFilter(f)}>
                            {f === '' ? t('history.all') : f === 'high' ? t('history.high') : f === 'medium' ? t('history.medium') : t('history.low')}
                          </FilterChip>
                        ))}
                      </div>
                      {/* Sort */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-[var(--color-muted)] w-16 flex-shrink-0">{t('history.filterSort')}</span>
                        {(['newest', 'oldest'] as const).map(f => (
                          <FilterChip key={f} active={filters.sort === f} onClick={() => setSortFilter(f)}>
                            {f === 'newest' ? t('history.newest') : t('history.oldest')}
                          </FilterChip>
                        ))}
                      </div>
                      {/* Clear */}
                      {hasActiveFilters && (
                        <button onClick={clearAllFilters} className="text-[12px] text-[var(--color-danger)] hover:underline">
                          {t('history.clearFilters')}
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Results count */}
              {!loading && !error && (
                <div className="text-[12px] text-[var(--color-muted-2)] mb-3">
                  {total === 0 ? t('history.noEntries') : `${total} ${total === 1 ? t('history.entry') : t('history.entries')}`}
                  {filters.search && ` ${tf('history.forSearch', filters.search)}`}
                </div>
              )}

              {/* List */}
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
                </div>
              ) : error ? (
                <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-[13px]">
                  {error}
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-10 text-center">
                  <div className="text-[36px] text-[var(--color-muted-2)] mb-3">○</div>
                  <div className="text-[14px] font-medium text-[var(--color-text)] mb-1">{t('history.noEntries')}</div>
                  <div className="text-[13px] text-[var(--color-muted)]">
                    {hasActiveFilters || filters.search
                      ? t('history.tryOtherFilters')
                      : t('history.startFirstAnalysis')}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {items.map((item, i) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.025, 0.3) }}
                        >
                          <HistoryRow
                            item={item}
                            selected={selectedEntry?.id === item.id}
                            onClick={() => setSelectedEntry(prev => prev?.id === item.id ? null : item)}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {hasMore && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="h-9 px-5 rounded-[var(--radius-md)] text-[13px] font-medium bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-all disabled:opacity-50"
                      >
                        {loadingMore ? t('history.loading') : tf('history.loadMore', total - offset)}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      <AnalysisDetailPanel
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}
