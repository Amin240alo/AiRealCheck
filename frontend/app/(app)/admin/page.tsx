'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, BarChart3, CreditCard, Shield, Zap, FileText, Settings2,
  RefreshCw, TrendingUp, AlertTriangle, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { AdminStats, AdminUser, AdminAnalysis, Engine, LogEntry } from '@/lib/types';

type AdminView = 'dashboard' | 'users' | 'analyses' | 'credits' | 'moderation' | 'engines' | 'logs' | 'system';

const NAV_ITEMS: { id: AdminView; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Nutzer', icon: Users },
  { id: 'analyses', label: 'Analysen', icon: BarChart3 },
  { id: 'credits', label: 'Credits', icon: CreditCard },
  { id: 'moderation', label: 'Moderation', icon: Shield },
  { id: 'engines', label: 'Engines', icon: Zap },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'system', label: 'System', icon: Settings2 },
];

// KPI Card
function KpiCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
      <div className="text-[11px] text-[var(--color-muted-2)] uppercase tracking-wider mb-2">{label}</div>
      <div className="text-[28px] font-bold" style={{ color: color || 'var(--color-text)' }}>{value}</div>
    </div>
  );
}

// Table wrapper
function AdminTable({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
            {headers.map(h => <th key={h} className="px-3 py-2.5 text-left font-semibold text-[var(--color-muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {empty
            ? <tr><td colSpan={headers.length} className="px-3 py-8 text-center text-[var(--color-muted)]">Keine Einträge.</td></tr>
            : children}
        </tbody>
      </table>
    </div>
  );
}

// Dashboard view
function DashboardView() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<AdminAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        apiFetch<AdminStats>('/admin/stats'),
        apiFetch<{ analyses: AdminAnalysis[] }>('/admin/analyses?limit=10'),
      ]);
      setStats(s);
      setRecentAnalyses(a.analyses || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8 text-center text-[var(--color-muted)]">Laden…</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Nutzer gesamt" value={stats?.total_users ?? '--'} />
        <KpiCard label="Neue Nutzer heute" value={stats?.new_users_today ?? '--'} color="var(--color-success)" />
        <KpiCard label="Analysen heute" value={stats?.analyses_today ?? '--'} />
        <KpiCard label="Analysen gesamt" value={stats?.analyses_total ?? '--'} />
        <KpiCard label="Credits heute" value={stats?.credits_today ?? '--'} color="var(--color-primary)" />
        <KpiCard label="Credits gesamt" value={stats?.credits_total ?? '--'} />
        <KpiCard label="Fehler heute" value={stats?.errors_today ?? '--'} color="var(--color-danger)" />
        <KpiCard label="Aktive Engines" value={stats?.engines_active ?? '--'} color="var(--color-success)" />
      </div>

      <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <div className="text-[14px] font-semibold text-[var(--color-text)]">Letzte Analysen</div>
        </div>
        <AdminTable headers={['ID', 'Nutzer', 'Datum', 'Typ', 'Status', 'Score', 'Credits']} empty={recentAnalyses.length === 0}>
          {recentAnalyses.map(a => (
            <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)] transition-colors">
              <td className="px-3 py-2.5 text-[var(--color-muted-2)]">#{a.id}</td>
              <td className="px-3 py-2.5 text-[var(--color-text)] truncate max-w-[120px]">{a.user_email || `User ${a.user_id}`}</td>
              <td className="px-3 py-2.5 text-[var(--color-muted)] whitespace-nowrap">{formatDate(a.created_at)}</td>
              <td className="px-3 py-2.5">
                <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-muted)] text-[10px] capitalize">{a.media_type}</span>
              </td>
              <td className="px-3 py-2.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${a.status === 'success' ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]' : 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]'}`}>
                  {a.status}
                </span>
              </td>
              <td className="px-3 py-2.5 text-[var(--color-text)]">{a.fake_score !== undefined ? `${Math.round(a.fake_score)}%` : '—'}</td>
              <td className="px-3 py-2.5 text-[var(--color-muted)]">{a.credits_used ?? '—'}</td>
            </tr>
          ))}
        </AdminTable>
      </div>
    </div>
  );
}

// Users view
function UsersView() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ users: AdminUser[]; total: number }>(
        `/admin/users?page=${page}&limit=20&search=${encodeURIComponent(search)}`
      );
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch { setUsers([]); }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  async function handleBan(id: number, banned: boolean) {
    try {
      await apiFetch(`/admin/users/${id}/${banned ? 'unban' : 'ban'}`, { method: 'POST' });
      setActionMsg(banned ? 'Entsperrt.' : 'Gesperrt.');
      load();
    } catch { setActionMsg('Fehler.'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Suche E-Mail oder ID"
            className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[13px] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-primary)]" />
        </div>
        <button onClick={load} className="h-9 px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]"><RefreshCw size={14} /></button>
      </div>
      {actionMsg && <div className="text-[12px] text-[var(--color-success)]">{actionMsg}</div>}
      {loading ? <div className="text-[var(--color-muted)] text-[13px] py-8 text-center">Laden…</div> : (
        <AdminTable headers={['ID', 'E-Mail', 'Rolle', 'Status', 'Verifiziert', 'Credits', 'Analysen', 'Registriert', 'Aktionen']} empty={users.length === 0}>
          {users.map(u => (
            <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]">
              <td className="px-3 py-2.5 text-[var(--color-muted-2)]">#{u.id}</td>
              <td className="px-3 py-2.5 text-[var(--color-text)] max-w-[160px] truncate">{u.email}</td>
              <td className="px-3 py-2.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${u.is_admin ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]' : 'bg-[var(--color-surface-3)] text-[var(--color-muted)]'}`}>
                  {u.is_admin ? 'Admin' : 'User'}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${u.banned ? 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]' : 'bg-[var(--color-success-muted)] text-[var(--color-success)]'}`}>
                  {u.banned ? 'Gesperrt' : 'Aktiv'}
                </span>
              </td>
              <td className="px-3 py-2.5 text-[var(--color-muted)]">{u.email_verified ? '✓' : '✗'}</td>
              <td className="px-3 py-2.5 text-[var(--color-text)]">{u.credits_available}</td>
              <td className="px-3 py-2.5 text-[var(--color-muted)]">{u.analyses_count}</td>
              <td className="px-3 py-2.5 text-[var(--color-muted)] whitespace-nowrap">{formatDate(u.created_at)}</td>
              <td className="px-3 py-2.5">
                <button onClick={() => handleBan(u.id, u.banned)}
                  className={`text-[11px] px-2 py-1 rounded transition-colors ${u.banned ? 'bg-[var(--color-success-muted)] text-[var(--color-success)] hover:bg-[var(--color-success)] hover:text-white' : 'bg-[var(--color-danger-muted)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white'}`}>
                  {u.banned ? 'Entsperren' : 'Sperren'}
                </button>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
      <div className="flex items-center justify-between text-[12px] text-[var(--color-muted)]">
        <span>{total} Nutzer gesamt</span>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="h-7 px-3 rounded bg-[var(--color-surface-2)] disabled:opacity-40"><ChevronLeft size={14} /></button>
          <span className="h-7 flex items-center px-3">Seite {page}</span>
          <button onClick={() => setPage(p => p+1)} disabled={users.length < 20} className="h-7 px-3 rounded bg-[var(--color-surface-2)] disabled:opacity-40"><ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}

// Analyses view
function AnalysesView() {
  const [analyses, setAnalyses] = useState<AdminAnalysis[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ analyses: AdminAnalysis[]; total: number }>(`/admin/analyses?page=${page}&limit=20`);
      setAnalyses(data.analyses || []); setTotal(data.total || 0);
    } catch { setAnalyses([]); }
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={load} className="h-9 px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] flex items-center gap-1.5 text-[13px]"><RefreshCw size={14} /> Aktualisieren</button>
      </div>
      {loading ? <div className="text-[var(--color-muted)] text-[13px] py-8 text-center">Laden…</div> : (
        <AdminTable headers={['ID', 'Nutzer', 'Datum', 'Typ', 'Status', 'Score', 'Konfidenz', 'Credits']} empty={analyses.length === 0}>
          {analyses.map(a => (
            <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]">
              <td className="px-3 py-2.5 text-[var(--color-muted-2)]">#{a.id}</td>
              <td className="px-3 py-2.5 text-[var(--color-text)] max-w-[140px] truncate">{a.user_email || `#${a.user_id}`}</td>
              <td className="px-3 py-2.5 text-[var(--color-muted)] whitespace-nowrap">{formatDate(a.created_at)}</td>
              <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-muted)] text-[10px] capitalize">{a.media_type}</span></td>
              <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] ${a.status === 'success' ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]' : 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]'}`}>{a.status}</span></td>
              <td className="px-3 py-2.5 text-[var(--color-text)]">{a.fake_score !== undefined ? `${Math.round(a.fake_score)}%` : '—'}</td>
              <td className="px-3 py-2.5 text-[var(--color-muted)] capitalize">{a.confidence || '—'}</td>
              <td className="px-3 py-2.5 text-[var(--color-muted)]">{a.credits_used ?? '—'}</td>
            </tr>
          ))}
        </AdminTable>
      )}
      <div className="flex items-center justify-between text-[12px] text-[var(--color-muted)]">
        <span>{total} Analysen gesamt</span>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="h-7 px-3 rounded bg-[var(--color-surface-2)] disabled:opacity-40"><ChevronLeft size={14} /></button>
          <span className="h-7 flex items-center px-3">Seite {page}</span>
          <button onClick={() => setPage(p => p+1)} disabled={analyses.length < 20} className="h-7 px-3 rounded bg-[var(--color-surface-2)] disabled:opacity-40"><ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}

// Engines view
function EnginesView() {
  const [engines, setEngines] = useState<Engine[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiFetch<{ engines: Engine[] }>('/admin/engines').then(d => setEngines(d.engines || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return (
    <div>
      {loading ? <div className="text-[var(--color-muted)] py-8 text-center">Laden…</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {engines.map(e => (
            <div key={e.name} className="flex items-center gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)]">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${e.enabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-muted-2)]'}`} />
              <div>
                <div className="text-[13px] font-medium text-[var(--color-text)]">{e.name}</div>
                {e.status && <div className="text-[11px] text-[var(--color-muted-2)]">{e.status}</div>}
              </div>
              <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full ${e.enabled ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]' : 'bg-[var(--color-surface-3)] text-[var(--color-muted-2)]'}`}>
                {e.enabled ? 'Aktiv' : 'Inaktiv'}
              </span>
            </div>
          ))}
          {engines.length === 0 && <div className="col-span-2 text-center text-[var(--color-muted)] py-8">Keine Engines verfügbar.</div>}
        </div>
      )}
    </div>
  );
}

// Logs view
function LogsView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiFetch<{ logs: LogEntry[] }>('/admin/logs?limit=50').then(d => setLogs(d.logs || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const levelColor = (l: string) => {
    if (l === 'error') return 'var(--color-danger)';
    if (l === 'warning' || l === 'warn') return 'var(--color-warning)';
    return 'var(--color-muted)';
  };
  return (
    <div>
      {loading ? <div className="text-[var(--color-muted)] py-8 text-center">Laden…</div> : (
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[12px]">
              <span className="font-semibold uppercase text-[10px] w-12 flex-shrink-0 mt-0.5" style={{ color: levelColor(log.level) }}>{log.level}</span>
              <span className="flex-1 text-[var(--color-text)] break-all">{log.message}</span>
              <span className="text-[var(--color-muted-2)] whitespace-nowrap flex-shrink-0">{formatDate(log.created_at)}</span>
            </div>
          ))}
          {logs.length === 0 && <div className="text-center text-[var(--color-muted)] py-8">Keine Logs.</div>}
        </div>
      )}
    </div>
  );
}

// Simple placeholder view
function PlaceholderView({ title }: { title: string }) {
  return <div className="py-8 text-center text-[var(--color-muted)]">{title} — In Entwicklung.</div>;
}

// Main admin page
export default function AdminPage() {
  const router = useRouter();
  const { isAdmin, user, loading } = useAuth();
  const [view, setView] = useState<AdminView>('dashboard');

  useEffect(() => {
    if (!loading && !isAdmin) router.replace('/dashboard');
  }, [isAdmin, loading, router]);

  if (loading || !isAdmin) return null;

  const viewTitles: Record<AdminView, string> = {
    dashboard: 'Dashboard', users: 'Nutzer', analyses: 'Analysen', credits: 'Credits',
    moderation: 'Moderation', engines: 'Engines', logs: 'Logs', system: 'System',
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Admin sidenav */}
      <aside className="hidden md:flex flex-col w-52 flex-shrink-0 bg-[var(--color-surface-2)] border-r border-[var(--color-border)] py-4">
        <div className="px-4 mb-4">
          <div className="text-[13px] font-bold text-[var(--color-text)]">Admin</div>
          <div className="text-[11px] text-[var(--color-muted-2)]">AIRealCheck</div>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setView(id)}
              className={`flex items-center gap-2.5 h-8 w-full px-2 rounded-[var(--radius-sm)] text-[13px] transition-colors ${
                view === id ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]' : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)]'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
        <div className="px-4 pt-4 border-t border-[var(--color-border)]">
          <div className="text-[11px] text-[var(--color-muted-2)]">{user?.email}</div>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden flex gap-1 overflow-x-auto px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] flex-shrink-0">
        {NAV_ITEMS.map(({ id, label }) => (
          <button key={id} onClick={() => setView(id)}
            className={`flex-shrink-0 h-7 px-3 rounded-full text-[12px] font-medium transition-all ${view === id ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-3)] text-[var(--color-muted)]'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-6 py-6 max-w-6xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[20px] font-bold text-[var(--color-text)]">{viewTitles[view]}</h1>
            </div>
          </div>
          <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {view === 'dashboard' && <DashboardView />}
            {view === 'users' && <UsersView />}
            {view === 'analyses' && <AnalysesView />}
            {view === 'credits' && <PlaceholderView title="Credits-Verwaltung" />}
            {view === 'moderation' && <PlaceholderView title="Moderation" />}
            {view === 'engines' && <EnginesView />}
            {view === 'logs' && <LogsView />}
            {view === 'system' && <PlaceholderView title="System" />}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
