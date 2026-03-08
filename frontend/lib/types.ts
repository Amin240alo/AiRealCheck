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

export type MediaType = 'image' | 'video' | 'audio';

export interface AnalysisResult {
  ok: boolean;
  real: number;
  fake: number;
  confidence: 'high' | 'medium' | 'low';
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
    credits_left: number;
    credits_used: number;
  };
}

export interface HistoryItem {
  id: number;
  media_type: MediaType;
  status: 'success' | 'failed' | 'pending';
  fake_score?: number;
  real_score?: number;
  confidence?: string;
  filename?: string;
  created_at: string;
  credits_used?: number;
  result?: AnalysisResult;
}

export interface AdminStats {
  total_users: number;
  new_users_today: number;
  analyses_today: number;
  analyses_total: number;
  credits_today: number;
  credits_total: number;
  errors_today: number;
  engines_active: number;
}

export interface AdminUser {
  id: number;
  email: string;
  display_name?: string;
  is_admin: boolean;
  email_verified: boolean;
  banned: boolean;
  plan_type: string;
  credits_available: number;
  analyses_count: number;
  created_at: string;
  last_login_at?: string;
}

export interface AdminAnalysis {
  id: number;
  user_id: number;
  user_email?: string;
  media_type: MediaType;
  status: string;
  fake_score?: number;
  confidence?: string;
  credits_used?: number;
  created_at: string;
}

export interface Engine {
  name: string;
  enabled: boolean;
  status?: string;
  description?: string;
}

export interface LogEntry {
  id: number;
  level: string;
  message: string;
  created_at: string;
  user_id?: number;
}
