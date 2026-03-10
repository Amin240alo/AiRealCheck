/**
 * analysisService.ts
 *
 * Clean service layer for all analysis-domain requests.
 * Import these functions in components instead of scattering apiFetch calls.
 */

import { apiFetch } from '@/lib/api';
import type {
  HistoryListResponse,
  HistoryEntry,
  HistoryDetail,
  AnalysisSummary,
  AnalysisDetail,
  CreditSummary,
  MediaType,
  AsyncState,
} from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// History (AnalysisHistory table – user-facing)
// ─────────────────────────────────────────────────────────────────────────────

export interface HistoryListParams {
  limit?: number;
  offset?: number;
  media_type?: MediaType | '';
  search?: string;
  verdict?: 'likely_ai' | 'likely_real' | 'uncertain' | '';
  confidence?: 'high' | 'medium' | 'low' | '';
  date_from?: string;
  date_to?: string;
  sort?: 'newest' | 'oldest';
}

/**
 * Fetch the user's analysis history (paginated).
 * Maps to GET /api/history
 */
export async function fetchHistory(params: HistoryListParams = {}): Promise<HistoryListResponse> {
  const { limit = 20, offset = 0, media_type = '', search = '', verdict = '', confidence = '', date_from = '', date_to = '', sort = 'newest' } = params;
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  qs.set('offset', String(offset));
  if (media_type) qs.set('media_type', media_type);
  if (search) qs.set('search', search);
  if (verdict) qs.set('verdict', verdict);
  if (confidence) qs.set('confidence', confidence);
  if (date_from) qs.set('date_from', date_from);
  if (date_to) qs.set('date_to', date_to);
  if (sort !== 'newest') qs.set('sort', sort);
  return apiFetch<HistoryListResponse>(`/api/history?${qs.toString()}`);
}

/**
 * Fetch a single history detail record.
 * Maps to GET /api/history/:id
 */
export async function fetchHistoryDetail(id: string): Promise<HistoryDetail> {
  return apiFetch<HistoryDetail>(`/api/history/${encodeURIComponent(id)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Analyses (Analysis table – internal tracking)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the list of raw analysis records for the current user.
 * Maps to GET /analyses
 */
export async function fetchAnalyses(limit = 50): Promise<{ ok: boolean; items: AnalysisSummary[] }> {
  return apiFetch<{ ok: boolean; items: AnalysisSummary[] }>(`/analyses?limit=${limit}`);
}

/**
 * Fetch a single raw analysis record by ID.
 * Maps to GET /analyses/:id
 */
export async function fetchAnalysisDetail(id: string): Promise<{ ok: boolean; analysis: AnalysisDetail }> {
  return apiFetch<{ ok: boolean; analysis: AnalysisDetail }>(`/analyses/${encodeURIComponent(id)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Credits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's credit summary.
 * Maps to GET /api/credits
 */
export async function fetchCreditSummary(): Promise<CreditSummary> {
  return apiFetch<CreditSummary>('/api/credits');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initial/idle AsyncState – use as default useState value.
 */
export function idleState<T>(): AsyncState<T> {
  return { status: 'idle', data: null, error: null };
}

/**
 * Loading AsyncState.
 */
export function loadingState<T>(): AsyncState<T> {
  return { status: 'loading', data: null, error: null };
}

/**
 * Success AsyncState.
 */
export function successState<T>(data: T): AsyncState<T> {
  return { status: 'success', data, error: null };
}

/**
 * Error AsyncState.
 */
export function errorState<T>(error: string): AsyncState<T> {
  return { status: 'error', data: null, error };
}

/**
 * Convenience: derives a human-readable error string from a caught value.
 */
export function toErrorMessage(err: unknown, fallback = 'Ein Fehler ist aufgetreten.'): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'string') return err || fallback;
  return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain helpers
// ─────────────────────────────────────────────────────────────────────────────

const VERDICT_LABELS_DE: Record<string, string> = {
  likely_ai: 'Wahrscheinlich KI-generiert',
  likely_real: 'Wahrscheinlich echt',
  uncertain: 'Unklar',
};

export function verdictLabel(key: string | null | undefined): string {
  if (!key) return 'Unbekannt';
  return VERDICT_LABELS_DE[key] ?? key;
}

const CONFIDENCE_LABELS_DE: Record<string, string> = {
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
};

export function confidenceLabel(key: string | null | undefined): string {
  if (!key) return '—';
  return CONFIDENCE_LABELS_DE[key] ?? key;
}

const MEDIA_TYPE_LABELS_DE: Record<string, string> = {
  image: 'Bild',
  video: 'Video',
  audio: 'Audio',
};

export function mediaTypeLabel(type: string | null | undefined): string {
  if (!type) return '—';
  return MEDIA_TYPE_LABELS_DE[type] ?? type;
}

/**
 * Given a final_score (0–100), return the verdict key.
 * Mirrors the backend threshold logic in public_result.py.
 */
export function scoreToVerdictKey(score: number | null | undefined): 'likely_ai' | 'likely_real' | 'uncertain' {
  if (score == null) return 'uncertain';
  if (score <= 20) return 'likely_real';
  if (score <= 60) return 'uncertain';
  return 'likely_ai';
}

/**
 * Extract all signals (reasons + warnings) from a HistoryEntry's result_payload.
 * Returns them in a typed list for uniform rendering.
 */
export function extractSignals(
  resultPayload: { reasons_user?: string[]; warnings_user?: string[] } | null | undefined
): Array<{ type: 'reason' | 'warning'; text: string }> {
  if (!resultPayload) return [];
  const signals: Array<{ type: 'reason' | 'warning'; text: string }> = [];
  for (const text of resultPayload.reasons_user ?? []) {
    if (text) signals.push({ type: 'reason', text });
  }
  for (const text of resultPayload.warnings_user ?? []) {
    if (text) signals.push({ type: 'warning', text });
  }
  return signals;
}

/**
 * Fetch recent history items for dashboard/preview use.
 * Returns up to `limit` items, newest first.
 */
export async function fetchRecentHistory(limit = 5): Promise<HistoryEntry[]> {
  const res = await fetchHistory({ limit });
  return res.items ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_analyses: number;
  ai_count: number;
  real_count: number;
  uncertain_count: number;
  analyses_7d: number;
  credits_30d: number;
  credits_7d: number;
  media_breakdown: Record<string, number>;
}

export interface DashboardResponse {
  ok: boolean;
  stats: DashboardStats;
  recent: HistoryEntry[];
}

/**
 * Fetch aggregated dashboard statistics + recent 5 history entries.
 * Maps to GET /api/history/summary
 */
export async function fetchDashboard(): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>('/api/history/summary');
}
