// ─────────────────────────────────────────────────────────────────────────────
// Auth / User
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  display_name: string;
  is_admin: boolean;
  email_verified: boolean;
  plan_type: string;
  subscription_active: boolean;
  credits_total: number;
  credits_used: number;
  last_credit_reset?: string;
  created_at?: string;
  last_login_at?: string;
  banned?: boolean;
  language?: string;
}

export interface Balance {
  plan_type: string;
  subscription_active: boolean;
  credits_total: number;
  credits_used: number;
  credits_available: number;
  last_credit_reset?: string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  balance: Balance | null;
  loading: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

export type MediaType = 'image' | 'video' | 'audio';

export type VerdictKey = 'likely_ai' | 'likely_real' | 'uncertain';

export type ConfidenceLabel = 'high' | 'medium' | 'low';

export type TrafficLight = 'red' | 'yellow' | 'green';

// ─────────────────────────────────────────────────────────────────────────────
// Analysis result – public_result_v1 wire format (from /analyze endpoint)
// ─────────────────────────────────────────────────────────────────────────────

export interface PublicResultMeta {
  schema_version: 'public_result_v1';
  analysis_id?: string;
  media_type?: MediaType;
  created_at?: string;
}

export interface PublicResultSummary {
  verdict_key?: VerdictKey;
  label_de?: string;
  label_en?: string;
  traffic_light?: TrafficLight;
  ai_percent?: number | null;
  real_percent?: number | null;
  confidence_label?: ConfidenceLabel;
  confidence01?: number | null;
  conflict?: boolean;
  reasons_user?: string[];
  warnings_user?: string[];
}

export interface PublicResultEngineEntry {
  engine: string;
  status?: string;
  available?: boolean;
  ai01?: number | null;
  ai_percent?: number | null;
  confidence01?: number | null;
  timing_ms?: number;
  notes?: string;
  warning?: string;
}

export interface PublicResultDetails {
  decision_threshold?: number | null;
  engines?: PublicResultEngineEntry[];
  provenance?: {
    c2pa_status?: string;
    c2pa_summary?: string;
  };
  watermarks?: {
    status?: string;
    summary?: string;
  };
  forensics?: {
    ai_percent?: number | null;
    summary_lines?: string[];
  };
}

export interface PublicResultUsage {
  source?: string;
  credit_spent?: boolean;
  credits_left?: number | null;
  credits_used?: number | null;
}

export interface PublicResultV1 {
  meta: PublicResultMeta;
  summary: PublicResultSummary;
  details?: PublicResultDetails;
  usage?: PublicResultUsage;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical domain types – used across Dashboard, Verlauf, Results, Admin
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single engine result as returned in PublicResultDetails.engines
 * and stored in AnalysisHistory.engine_breakdown.
 */
export interface AnalysisEngineResult {
  engine: string;
  status: string | null;
  available: boolean;
  ai01: number | null;
  ai_percent: number | null;
  confidence01: number | null;
  timing_ms: number;
  notes?: string;
  warning?: string;
}

/**
 * A single user-visible signal (reason or warning) from an analysis.
 */
export interface AnalysisSignal {
  type: 'reason' | 'warning';
  text: string;
}

/**
 * Summary record as returned by GET /api/history (list endpoint).
 * This is the canonical list-level shape used by Verlauf, Dashboard, etc.
 */
export interface HistoryEntry {
  id: string;
  media_type: MediaType;
  status: 'success' | 'failed' | 'pending';
  title: string | null;
  final_score: number | null;        // 0–100 AI likelihood
  verdict_label: string | null;      // German verdict label
  confidence_label: ConfidenceLabel | null;
  credits_charged: number;
  created_at: string;
}

/**
 * Full detail record as returned by GET /api/history/:id.
 */
export interface HistoryDetail extends HistoryEntry {
  engine_breakdown: Record<string, number | { score: number | null; confidence?: number | null; status?: string; available?: boolean }> | null;
  result_payload: PublicResultSummary | null;
  file_ref: string | null;
  thumb_ref: string | null;
}

/**
 * List response shape from GET /api/history.
 */
export interface HistoryListResponse {
  ok: boolean;
  items: HistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Summary record from GET /analyses (internal analyses table, not history).
 */
export interface AnalysisSummary {
  id: string;
  status: 'running' | 'done' | 'failed';
  media_type: MediaType | null;
  final_score_ai01: number | null;  // 0–1
  cost_credits: number | null;
  created_at: string;
  finished_at: string | null;
}

/**
 * Full analysis detail from GET /analyses/:id.
 */
export interface AnalysisDetail extends AnalysisSummary {
  result_json: PublicResultV1 | null;
}

/**
 * Credit state summary – from GET /api/credits or embedded in AuthContext.
 */
export interface CreditSummary {
  plan_type: string;
  subscription_active: boolean;
  credits_total: number;
  credits_used: number;
  credits_available: number;
  last_credit_reset: string | null;
}

/**
 * Generic async state wrapper for data-fetching hooks and components.
 */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backwards-compat alias – HistoryItem now maps to HistoryEntry.
// Components should migrate to HistoryEntry; this alias prevents a build break.
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use HistoryEntry instead */
export type HistoryItem = HistoryEntry;

// ─────────────────────────────────────────────────────────────────────────────
// Legacy analysis result shape (pre-public_result_v1)
// ─────────────────────────────────────────────────────────────────────────────

export interface LegacyAnalysisResult {
  ok?: boolean;
  real?: number;
  fake?: number;
  confidence?: ConfidenceLabel;
  message?: string;
  user_summary?: string[];
  sources_used?: string[];
  primary_source?: string;
  source?: string;
  warnings?: string[];
  details?: {
    hive?: string | string[];
    forensics?: string | string[];
    model?: string | string[];
  };
  usage?: {
    credits_left?: number;
    credits_used?: number;
  };
}

export type AnalysisResult = PublicResultV1 | LegacyAnalysisResult;

// ─────────────────────────────────────────────────────────────────────────────
// Admin types
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminStats {
  // Counts
  total_users: number;
  new_users_today: number;
  analyses_today: number;
  analyses_total: number;
  // Credits (backend field names)
  credits_spent_total: number;
  credits_spent_today: number;
  // Derived / legacy aliases kept for compat
  credits_today?: number;
  credits_total?: number;
  // Errors
  errors_today: number;
  // Engines — backend returns string[] of active engine names
  engines_active: string[] | number;
  // Rich sub-lists
  recent_admin_events: AdminLogEntry[];
  recent_error_logs: AdminLogEntry[];
  recent_analyses: AdminAnalysisRow[];
  top_users: { id: number; email: string; analyses_count: number }[];
}

export interface AdminLogEntry {
  id: number;
  ts: string;
  level: string;
  event: string;
  meta?: unknown;
}

export interface AdminAnalysisRow {
  id: string | number;
  user_id: number;
  user_email?: string;
  media_type: string;
  status: string;
  final_score: number | null;
  verdict_label?: string | null;
  credits_charged: number;
  engines_summary?: string;
  created_at: string;
}

export interface AdminUser {
  id: number;
  email: string;
  display_name?: string;
  role?: string;
  is_admin: boolean;
  is_banned: boolean;
  /** @deprecated use is_banned */
  banned?: boolean;
  email_verified: boolean;
  plan_type: string;
  subscription_active?: boolean;
  credits_available: number;
  credits_total?: number;
  credits_used?: number;
  analyses_count?: number;
  created_at: string;
  last_login?: string;
  /** @deprecated use last_login */
  last_login_at?: string;
}

export interface AdminAnalysis {
  id: string;
  user_id: number;
  user_email?: string;
  media_type: MediaType;
  status: string;
  final_score: number | null;
  verdict_label?: string | null;
  confidence_label?: ConfidenceLabel | null;
  credits_charged: number;
  engines_summary?: string;
  created_at: string;
}

export interface Engine {
  name: string;
  /** 'active' | 'inactive' — backend field */
  status: string;
  /** @deprecated use status === 'active' */
  enabled?: boolean;
  last_used?: string | null;
  calls_total?: number;
  calls_recent?: number;
  description?: string;
}

/** AdminLog entry from GET /admin/logs */
export interface LogEntry {
  id: number;
  ts: string;
  level: string;
  event: string;
  meta?: unknown;
  /** @deprecated use ts */
  created_at?: string;
  /** @deprecated use event */
  message?: string;
}

export interface CreditTx {
  id: number;
  user_id: number;
  email: string;
  kind: string;
  amount: number;
  note?: string | null;
  analysis_id?: string | null;
  media_type?: string | null;
  created_at: string;
}

export interface AdminCreditsSummary {
  transactions_total: number;
  transactions_today: number;
  credits_spent_total: number;
  credits_spent_today: number;
  admin_adjust_total: number;
  admin_adjust_today: number;
  grants_total: number;
  grants_today: number;
}

export interface AdminSystemStatus {
  environment: string;
  admin_enabled: boolean;
  database: { engine: string; using_sqlite: boolean };
  email: Record<string, unknown>;
  features: {
    guest_analyze: boolean;
    paid_apis: boolean;
    local_ml: boolean;
    image_fallback: boolean;
  };
}
