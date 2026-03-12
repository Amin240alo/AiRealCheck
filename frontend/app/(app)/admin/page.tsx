'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CONTACT_EMAIL } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, BarChart3, CreditCard, Zap, TrendingUp,
  AlertTriangle, Activity, MessageSquare, Shield, RefreshCw, Search,
  ChevronLeft, ChevronRight, ChevronDown, Check, X, Plus, Minus,
  Server, Database, Mail, Globe, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type {
  AdminStats, AdminUser, AdminAnalysisRow, Engine, LogEntry,
  CreditTx, AdminCreditsSummary, AdminSystemStatus, AdminLogEntry,
} from '@/lib/types';

// ─── View type ────────────────────────────────────────────────────────────────

type AdminView = 'overview' | 'users' | 'analyses' | 'credits' | 'engines'
               | 'costs' | 'logs' | 'system' | 'feedback' | 'audit';

const NAV_ITEMS: { id: AdminView; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'overview',  label: 'Übersicht',   icon: LayoutDashboard },
  { id: 'users',     label: 'Nutzer',       icon: Users },
  { id: 'analyses',  label: 'Analysen',     icon: BarChart3 },
  { id: 'credits',   label: 'Credits',      icon: CreditCard },
  { id: 'engines',   label: 'Engines',      icon: Zap },
  { id: 'costs',     label: 'Kosten',       icon: TrendingUp },
  { id: 'logs',      label: 'Fehler-Log',   icon: AlertTriangle },
  { id: 'system',    label: 'System',       icon: Server },
  { id: 'feedback',  label: 'Feedback',     icon: MessageSquare },
  { id: 'audit',     label: 'Audit-Log',    icon: Shield },
];

// ─── Shared primitives ────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
      <div className="text-[11px] text-[var(--color-muted-2)] uppercase tracking-wider mb-1.5">{label}</div>
      <div className="text-[26px] font-bold leading-none" style={{ color: color || 'var(--color-text)' }}>{value}</div>
      {sub && <div className="text-[11px] text-[var(--color-muted-2)] mt-1">{sub}</div>}
    </div>
  );
}

function AdminTable({ headers, children, empty }: { headers: string[]; children?: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
            {headers.map(h => (
              <th key={h} className="px-3 py-2.5 text-left font-semibold text-[var(--color-muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
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

function Pagination({ offset, limit, hasMore, onPrev, onNext }: {
  offset: number; limit: number; hasMore: boolean; onPrev: () => void; onNext: () => void;
}) {
  const page = Math.floor(offset / limit) + 1;
  return (
    <div className="flex items-center justify-between text-[12px] text-[var(--color-muted)]">
      <span>Seite {page}</span>
      <div className="flex gap-2">
        <button onClick={onPrev} disabled={offset === 0} className="h-7 px-3 rounded bg-[var(--color-surface-2)] disabled:opacity-40"><ChevronLeft size={14} /></button>
        <button onClick={onNext} disabled={!hasMore} className="h-7 px-3 rounded bg-[var(--color-surface-2)] disabled:opacity-40"><ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${active ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]' : 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]'}`}>
      {active ? 'Aktiv' : 'Gesperrt'}
    </span>
  );
}

const ROLE_STYLES: Record<string, string> = {
  admin:     'bg-[var(--color-warning-muted)] text-[var(--color-warning)]',
  moderator: 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]',
  user:      'bg-[var(--color-surface-3)] text-[var(--color-muted)]',
};
const ROLE_LABELS: Record<string, string> = {
  admin:     'Admin',
  moderator: 'Moderator',
  user:      'Nutzer',
};

function RoleBadge({ role }: { role?: string }) {
  const r = role || 'user';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ROLE_STYLES[r] ?? ROLE_STYLES.user}`}>
      {ROLE_LABELS[r] ?? r}
    </span>
  );
}

function LevelBadge({ level }: { level: string }) {
  const c = level === 'error' ? '#ef4444' : level === 'warning' || level === 'warn' ? '#f59e0b' : '#22d3ee';
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase" style={{ background: c + '20', color: c }}>{level}</span>;
}

function Loader() {
  return <div className="py-10 text-center text-[var(--color-muted)] text-[13px]">Laden…</div>;
}

function SectionHeader({ title, onRefresh }: { title: string; onRefresh?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-[17px] font-bold text-[var(--color-text)]">{title}</h2>
      {onRefresh && (
        <button onClick={onRefresh} className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] text-[12px] transition-colors">
          <RefreshCw size={13} /> Aktualisieren
        </button>
      )}
    </div>
  );
}

// ─── 1. Overview ──────────────────────────────────────────────────────────────

function OverviewView() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await apiFetch<AdminStats>('/admin/stats');
      setStats(s);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;

  const enginesCount = Array.isArray(stats?.engines_active)
    ? stats!.engines_active.length
    : (stats?.engines_active ?? 0);

  return (
    <div className="space-y-6">
      <SectionHeader title="Übersicht" onRefresh={load} />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Nutzer gesamt" value={stats?.total_users ?? '—'} />
        <KpiCard label="Neue Nutzer heute" value={stats?.new_users_today ?? '—'} color="var(--color-success)" />
        <KpiCard label="Analysen heute" value={stats?.analyses_today ?? '—'} />
        <KpiCard label="Analysen gesamt" value={stats?.analyses_total ?? '—'} />
        <KpiCard label="Credits verbraucht heute" value={stats?.credits_spent_today ?? '—'} color="var(--color-primary)" />
        <KpiCard label="Credits gesamt" value={stats?.credits_spent_total ?? '—'} />
        <KpiCard label="Fehler heute" value={stats?.errors_today ?? '—'} color={stats?.errors_today ? 'var(--color-danger)' : undefined} />
        <KpiCard label="Aktive Engines" value={enginesCount} color="#22d3ee" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent analyses */}
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] text-[13px] font-semibold text-[var(--color-text)]">Letzte Analysen</div>
          <AdminTable headers={['ID', 'Datum', 'Typ', 'Score', 'Cr.']} empty={!stats?.recent_analyses?.length}>
            {stats?.recent_analyses?.map(a => (
              <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]">
                <td className="px-3 py-2 text-[var(--color-muted-2)]">#{a.id}</td>
                <td className="px-3 py-2 text-[var(--color-muted)] whitespace-nowrap">{formatDate(a.created_at)}</td>
                <td className="px-3 py-2">
                  <span className="px-1.5 py-0.5 rounded bg-[var(--color-surface-3)] text-[var(--color-muted)] text-[10px] capitalize">{a.media_type}</span>
                </td>
                <td className="px-3 py-2 text-[var(--color-text)]">{a.final_score != null ? `${a.final_score}%` : '—'}</td>
                <td className="px-3 py-2 text-[var(--color-muted)]">{a.credits_charged}</td>
              </tr>
            ))}
          </AdminTable>
        </div>

        {/* Top users */}
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] text-[13px] font-semibold text-[var(--color-text)]">Top-Nutzer</div>
          <AdminTable headers={['#', 'E-Mail', 'Analysen']} empty={!stats?.top_users?.length}>
            {stats?.top_users?.map((u, i) => (
              <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]">
                <td className="px-3 py-2 text-[var(--color-muted-2)]">{i + 1}</td>
                <td className="px-3 py-2 text-[var(--color-text)] max-w-[180px] truncate">{u.email}</td>
                <td className="px-3 py-2 text-[var(--color-primary)] font-medium">{u.analyses_count}</td>
              </tr>
            ))}
          </AdminTable>
        </div>
      </div>

      {/* Recent errors */}
      {!!stats?.recent_error_logs?.length && (
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--color-danger)' }}>
            <AlertTriangle size={14} /> Letzte Fehler
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {stats.recent_error_logs.map(e => (
              <div key={e.id} className="px-4 py-2.5 flex items-start gap-3 text-[12px]">
                <span className="text-[var(--color-muted-2)] whitespace-nowrap flex-shrink-0 mt-0.5">{formatDate(e.ts)}</span>
                <span className="text-[var(--color-text)] break-all">{e.event}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 2. Users ─────────────────────────────────────────────────────────────────

interface CreditGrantFormProps { userId: number; onDone: () => void }
function CreditGrantForm({ userId, onDone }: CreditGrantFormProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(amount);
    if (!n || isNaN(n)) { toast.error('Ungültiger Betrag'); return; }
    setBusy(true);
    try {
      await apiFetch(`/api/admin/users/${userId}/credits/grant`, {
        method: 'POST',
        body: { amount: n, note: note || 'admin_adjust' },
      });
      toast.success(`${n > 0 ? '+' : ''}${n} Credits vergeben`);
      onDone();
    } catch { toast.error('Fehler beim Vergeben'); }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 mt-3">
      <input
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="±Credits"
        className="w-24 h-8 px-2 text-[12px] rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
      />
      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Notiz (optional)"
        className="flex-1 h-8 px-2 text-[12px] rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
      />
      <button type="submit" disabled={busy} className="h-8 px-3 text-[12px] rounded-[var(--radius-sm)] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
        {busy ? '…' : 'Vergeben'}
      </button>
    </form>
  );
}

interface RoleChangeFormProps { user: AdminUser; currentAdminId?: number; onDone: () => void }
function RoleChangeForm({ user, currentAdminId, onDone }: RoleChangeFormProps) {
  const [role, setRole] = useState(user.role || 'user');
  const [busy, setBusy] = useState(false);

  const isSelf = currentAdminId != null && user.id === currentAdminId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (role === (user.role || 'user')) { onDone(); return; }
    setBusy(true);
    try {
      await apiFetch(`/admin/users/${user.id}/set_role`, {
        method: 'POST',
        body: { role },
      });
      toast.success(`Rolle auf „${ROLE_LABELS[role] ?? role}" gesetzt.`);
      onDone();
    } catch (err: any) {
      const code = err?.error || '';
      if (code === 'cannot_demote_self') toast.error('Du kannst deine eigene Admin-Rolle nicht entfernen.');
      else if (code === 'last_admin_protected') toast.error('Letzter Admin – Herabstufung nicht möglich.');
      else toast.error('Rollenwechsel fehlgeschlagen.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 mt-3">
      <select
        value={role}
        onChange={e => setRole(e.target.value)}
        disabled={isSelf}
        className="h-8 px-2 text-[12px] rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
      >
        <option value="user">Nutzer</option>
        <option value="moderator">Moderator</option>
        <option value="admin">Admin</option>
      </select>
      <button type="submit" disabled={busy || isSelf} className="h-8 px-3 text-[12px] rounded-[var(--radius-sm)] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
        {busy ? '…' : 'Speichern'}
      </button>
      {isSelf && <span className="text-[11px] text-[var(--color-muted)]">Eigene Rolle schreibgeschützt</span>}
    </form>
  );
}

function UsersView() {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [grantId, setGrantId] = useState<number | null>(null);
  const [roleId, setRoleId] = useState<number | null>(null);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (search) params.set('q', search);
      const data = await apiFetch<{ users: AdminUser[]; has_more: boolean }>(`/admin/users?${params}`);
      setUsers(data.users || []);
      setHasMore(data.has_more ?? false);
    } catch { setUsers([]); }
    setLoading(false);
  }, [offset, search]);

  useEffect(() => { load(); }, [load]);

  async function handleBan(id: number, isBanned: boolean) {
    try {
      await apiFetch(`/admin/users/${id}/${isBanned ? 'unban' : 'ban'}`, { method: 'POST' });
      toast.success(isBanned ? 'Nutzer entsperrt.' : 'Nutzer gesperrt.');
      load();
    } catch { toast.error('Aktion fehlgeschlagen.'); }
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Nutzer" onRefresh={load} />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }}
            placeholder="Suche E-Mail / ID…"
            className="w-full h-9 pl-8 pr-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[13px] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
      </div>

      {loading ? <Loader /> : (
        <AdminTable headers={['ID', 'E-Mail', 'Rolle', 'Plan', 'Status', 'Credits', 'Analysen', 'Registriert', '']} empty={users.length === 0}>
          {users.map(u => (
            <React.Fragment key={u.id}>
              <tr className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)] cursor-pointer"
                onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}>
                <td className="px-3 py-2.5 text-[var(--color-muted-2)]">#{u.id}</td>
                <td className="px-3 py-2.5 text-[var(--color-text)] max-w-[180px] truncate">{u.email}</td>
                <td className="px-3 py-2.5"><RoleBadge role={u.role} /></td>
                <td className="px-3 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${u.plan_type !== 'free' ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]' : 'bg-[var(--color-surface-3)] text-[var(--color-muted)]'}`}>
                    {u.plan_type || 'free'}
                  </span>
                </td>
                <td className="px-3 py-2.5"><StatusBadge active={!u.is_banned} /></td>
                <td className="px-3 py-2.5 text-[var(--color-text)]">{u.credits_available}</td>
                <td className="px-3 py-2.5 text-[var(--color-muted)]">{u.analyses_count ?? '—'}</td>
                <td className="px-3 py-2.5 text-[var(--color-muted)] whitespace-nowrap">{formatDate(u.created_at)}</td>
                <td className="px-3 py-2.5"><ChevronDown size={13} className={`text-[var(--color-muted)] transition-transform ${expandedId === u.id ? 'rotate-180' : ''}`} /></td>
              </tr>
              <AnimatePresence>
                {expandedId === u.id && (
                  <tr>
                    <td colSpan={9} className="p-0">
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <div className="px-5 py-4 bg-[var(--color-surface-2)] border-b border-[var(--color-border)] space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                            <div><div className="text-[var(--color-muted-2)] mb-0.5">E-Mail verifiziert</div><div className="font-medium">{u.email_verified ? <Check size={13} className="text-[var(--color-success)]" /> : <X size={13} className="text-[var(--color-danger)]" />}</div></div>
                            <div><div className="text-[var(--color-muted-2)] mb-0.5">Rolle</div><div className="font-medium mt-0.5"><RoleBadge role={u.role} /></div></div>
                            <div><div className="text-[var(--color-muted-2)] mb-0.5">Letzter Login</div><div className="font-medium">{u.last_login ? formatDate(u.last_login) : '—'}</div></div>
                            <div><div className="text-[var(--color-muted-2)] mb-0.5">Credits gesamt</div><div className="font-medium">{u.credits_total ?? '—'}</div></div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button onClick={() => handleBan(u.id, u.is_banned)}
                              className={`h-7 px-3 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors ${u.is_banned ? 'bg-[var(--color-success-muted)] text-[var(--color-success)] hover:bg-[var(--color-success)] hover:text-white' : 'bg-[var(--color-danger-muted)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white'}`}>
                              {u.is_banned ? 'Entsperren' : 'Sperren'}
                            </button>
                            <button onClick={() => setGrantId(grantId === u.id ? null : u.id)}
                              className="h-7 px-3 text-[11px] font-medium rounded-[var(--radius-sm)] bg-[var(--color-surface-3)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors flex items-center gap-1">
                              <Plus size={11} /> Credits
                            </button>
                            <button onClick={() => setRoleId(roleId === u.id ? null : u.id)}
                              className="h-7 px-3 text-[11px] font-medium rounded-[var(--radius-sm)] bg-[var(--color-surface-3)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors flex items-center gap-1">
                              <Shield size={11} /> Rolle
                            </button>
                          </div>
                          {grantId === u.id && (
                            <CreditGrantForm userId={u.id} onDone={() => { setGrantId(null); load(); }} />
                          )}
                          {roleId === u.id && (
                            <RoleChangeForm user={u} currentAdminId={authUser?.id} onDone={() => { setRoleId(null); load(); }} />
                          )}
                        </div>
                      </motion.div>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </React.Fragment>
          ))}
        </AdminTable>
      )}
      <Pagination offset={offset} limit={LIMIT} hasMore={hasMore} onPrev={() => setOffset(o => Math.max(0, o - LIMIT))} onNext={() => setOffset(o => o + LIMIT)} />
    </div>
  );
}

// ─── 3. Analyses ──────────────────────────────────────────────────────────────

function AnalysesView() {
  const [items, setItems] = useState<AdminAnalysisRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [mediaFilter, setMediaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (mediaFilter) params.set('type', mediaFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const data = await apiFetch<{ items: AdminAnalysisRow[]; has_more: boolean }>(`/admin/analyses?${params}`);
      setItems(data.items || []);
      setHasMore(data.has_more ?? false);
    } catch { setItems([]); }
    setLoading(false);
  }, [offset, mediaFilter, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setSearch(val); setOffset(0); }, 350);
  };

  const sel = "h-8 px-2 text-[12px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none cursor-pointer";

  return (
    <div className="space-y-4">
      <SectionHeader title="Analysen" onRefresh={load} />
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-2)]" />
          <input
            type="search"
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Nach ID oder Titel suchen…"
            className="w-full h-8 pl-7 pr-3 text-[12px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <select value={mediaFilter} onChange={e => { setMediaFilter(e.target.value); setOffset(0); }} className={sel}>
          <option value="">Alle Typen</option>
          <option value="image">Bild</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setOffset(0); }} className={sel}>
          <option value="">Alle Status</option>
          <option value="success">Erfolg</option>
          <option value="failed">Fehler</option>
        </select>
      </div>
      {loading ? <Loader /> : (
        <AdminTable headers={['Analyse-ID', 'Nutzer', 'Datum', 'Typ', 'Status', 'Score', 'Urteil', 'Cr.']} empty={items.length === 0}>
          {items.map(a => (
            <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]">
              <td className="px-3 py-2.5">
                <span className="font-mono text-[10px] text-[var(--color-muted-2)] select-all">{a.id}</span>
              </td>
              <td className="px-3 py-2.5 text-[var(--color-text)] max-w-[140px] truncate">{a.user_email || `#${a.user_id}`}</td>
              <td className="px-3 py-2.5 text-[var(--color-muted)] whitespace-nowrap">{formatDate(a.created_at)}</td>
              <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 rounded bg-[var(--color-surface-3)] text-[var(--color-muted)] text-[10px] capitalize">{a.media_type}</span></td>
              <td className="px-3 py-2.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${a.status === 'success' ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]' : 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]'}`}>
                  {a.status}
                </span>
              </td>
              <td className="px-3 py-2.5 text-[var(--color-text)]">{a.final_score != null ? `${a.final_score}%` : '—'}</td>
              <td className="px-3 py-2.5 text-[var(--color-muted-2)] max-w-[140px] truncate text-[11px]">{a.verdict_label || '—'}</td>
              <td className="px-3 py-2.5 text-[var(--color-muted)]">{a.credits_charged}</td>
            </tr>
          ))}
        </AdminTable>
      )}
      <Pagination offset={offset} limit={LIMIT} hasMore={hasMore} onPrev={() => setOffset(o => Math.max(0, o - LIMIT))} onNext={() => setOffset(o => o + LIMIT)} />
    </div>
  );
}

// ─── 4. Credits ───────────────────────────────────────────────────────────────

function CreditsView() {
  const [items, setItems] = useState<CreditTx[]>([]);
  const [summary, setSummary] = useState<AdminCreditsSummary | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [kindFilter, setKindFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const LIMIT = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (kindFilter) params.set('kind', kindFilter);
      if (search) params.set('q', search);
      const data = await apiFetch<{ items: CreditTx[]; has_more: boolean; summary: AdminCreditsSummary }>(`/admin/credits?${params}`);
      setItems(data.items || []);
      setHasMore(data.has_more ?? false);
      if (data.summary) setSummary(data.summary);
    } catch { setItems([]); }
    setLoading(false);
  }, [offset, kindFilter, search]);

  useEffect(() => { load(); }, [load]);

  const sel = "h-8 px-2 text-[12px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none cursor-pointer";

  const kindColor = (k: string) => {
    if (k === 'charge') return '#ef4444';
    if (k === 'grant' || k === 'admin_adjust') return '#22d3ee';
    if (k === 'reset') return '#a78bfa';
    return 'var(--color-muted)';
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Credits & Transaktionen" onRefresh={load} />
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Credits verbraucht gesamt" value={summary.credits_spent_total} color="var(--color-danger)" />
          <KpiCard label="Verbraucht heute" value={summary.credits_spent_today} />
          <KpiCard label="Gewährt gesamt" value={summary.grants_total} color="#22d3ee" />
          <KpiCard label="Admin-Anpassungen" value={summary.admin_adjust_total} color="#a78bfa" />
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }}
            placeholder="E-Mail / Notiz"
            className="h-8 pl-7 pr-3 text-[12px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]" />
        </div>
        <select value={kindFilter} onChange={e => { setKindFilter(e.target.value); setOffset(0); }} className={sel}>
          <option value="">Alle Arten</option>
          <option value="charge">Charge</option>
          <option value="grant">Grant</option>
          <option value="admin_adjust">Admin-Adjust</option>
          <option value="reset">Reset</option>
        </select>
      </div>
      {loading ? <Loader /> : (
        <AdminTable headers={['ID', 'Nutzer', 'Art', 'Betrag', 'Notiz', 'Datum']} empty={items.length === 0}>
          {items.map(tx => (
            <tr key={tx.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]">
              <td className="px-3 py-2.5 text-[var(--color-muted-2)]">#{tx.id}</td>
              <td className="px-3 py-2.5 text-[var(--color-text)] max-w-[160px] truncate">{tx.email}</td>
              <td className="px-3 py-2.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: kindColor(tx.kind) + '20', color: kindColor(tx.kind) }}>{tx.kind}</span>
              </td>
              <td className="px-3 py-2.5 font-medium" style={{ color: tx.amount < 0 ? 'var(--color-danger)' : '#22d3ee' }}>
                {tx.amount > 0 ? '+' : ''}{tx.amount}
              </td>
              <td className="px-3 py-2.5 text-[var(--color-muted)] max-w-[160px] truncate">{tx.note || '—'}</td>
              <td className="px-3 py-2.5 text-[var(--color-muted)] whitespace-nowrap">{formatDate(tx.created_at)}</td>
            </tr>
          ))}
        </AdminTable>
      )}
      <Pagination offset={offset} limit={LIMIT} hasMore={hasMore} onPrev={() => setOffset(o => Math.max(0, o - LIMIT))} onNext={() => setOffset(o => o + LIMIT)} />
    </div>
  );
}

// ─── 5. Engines ───────────────────────────────────────────────────────────────

function EnginesView() {
  const [engines, setEngines] = useState<Engine[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ items: Engine[] }>('/admin/engines')
      .then(d => setEngines(d.items || []))
      .catch(() => setEngines([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <><SectionHeader title="Engines" /><Loader /></>;

  const active = engines.filter(e => e.status === 'active');
  const inactive = engines.filter(e => e.status !== 'active');

  return (
    <div className="space-y-5">
      <SectionHeader title="Engines" onRefresh={load} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
        <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="text-[22px] font-bold text-[var(--color-accent)]">{active.length}</div>
          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">Aktiv</div>
        </div>
        <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="text-[22px] font-bold text-[var(--color-muted)]">{inactive.length}</div>
          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">Inaktiv</div>
        </div>
        <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="text-[22px] font-bold text-[var(--color-text)]">{engines.length}</div>
          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">Gesamt</div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {engines.map(e => {
          const isActive = e.status === 'active';
          return (
            <div key={e.name} className="flex items-start gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)]">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${isActive ? 'bg-[var(--color-success)]' : 'bg-[var(--color-muted-2)]'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[var(--color-text)]">{e.name}</div>
                <div className="text-[11px] text-[var(--color-muted-2)] mt-0.5 space-x-2">
                  {e.calls_total != null && <span>Aufrufe: {e.calls_total}</span>}
                  {e.calls_recent != null && <span>({e.calls_recent} in 24h)</span>}
                </div>
                {e.last_used && <div className="text-[11px] text-[var(--color-muted-2)] mt-0.5">Zuletzt: {formatDate(e.last_used)}</div>}
              </div>
              <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]' : 'bg-[var(--color-surface-3)] text-[var(--color-muted-2)]'}`}>
                {isActive ? 'Aktiv' : 'Inaktiv'}
              </span>
            </div>
          );
        })}
        {engines.length === 0 && <div className="col-span-2 py-8 text-center text-[var(--color-muted)]">Keine Engines.</div>}
      </div>
    </div>
  );
}

// ─── 6. Cost Monitor ─────────────────────────────────────────────────────────

function CostMonitorView() {
  const [summary, setSummary] = useState<AdminCreditsSummary | null>(null);
  const [breakdown, setBreakdown] = useState<CreditTx[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: CreditTx[]; summary: AdminCreditsSummary }>('/admin/credits?kind=charge&limit=10');
      setSummary(data.summary || null);
      setBreakdown(data.items || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <><SectionHeader title="Kostenmonitor" /><Loader /></>;

  return (
    <div className="space-y-5">
      <SectionHeader title="Kostenmonitor" onRefresh={load} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Credits verbraucht gesamt" value={summary?.credits_spent_total ?? '—'} color="var(--color-danger)" />
        <KpiCard label="Verbraucht heute" value={summary?.credits_spent_today ?? '—'} />
        <KpiCard label="Gewährt gesamt" value={summary?.grants_total ?? '—'} color="#22d3ee" />
        <KpiCard label="Transaktionen gesamt" value={summary?.transactions_total ?? '—'} />
      </div>

      <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)] text-[13px] font-semibold text-[var(--color-text)]">Letzte Verbrauchsbuchungen</div>
        <AdminTable headers={['Nutzer', 'Betrag', 'Datum']} empty={breakdown.length === 0}>
          {breakdown.map(tx => (
            <tr key={tx.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]">
              <td className="px-3 py-2.5 text-[var(--color-text)] max-w-[200px] truncate">{tx.email}</td>
              <td className="px-3 py-2.5 font-medium text-[var(--color-danger)]">{tx.amount}</td>
              <td className="px-3 py-2.5 text-[var(--color-muted)] whitespace-nowrap">{formatDate(tx.created_at)}</td>
            </tr>
          ))}
        </AdminTable>
      </div>

      <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5 text-[13px] text-[var(--color-muted)]">
        Detaillierte Kostenanalyse (Zeitreihen, Prognosen) folgt in einem kommenden Update.
      </div>
    </div>
  );
}

// ─── 7. Error Logs ────────────────────────────────────────────────────────────

function LogsView() {
  const [items, setItems] = useState<LogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [level, setLevel] = useState('error');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (level) params.set('level', level);
      if (search) params.set('q', search);
      const data = await apiFetch<{ items: LogEntry[]; has_more: boolean }>(`/admin/logs?${params}`);
      setItems(data.items || []);
      setHasMore(data.has_more ?? false);
    } catch { setItems([]); }
    setLoading(false);
  }, [offset, level, search]);

  useEffect(() => { load(); }, [load]);

  const sel = "h-8 px-2 text-[12px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none cursor-pointer";

  return (
    <div className="space-y-4">
      <SectionHeader title="Fehler-Log" onRefresh={load} />
      <div className="flex gap-2 flex-wrap">
        <select value={level} onChange={e => { setLevel(e.target.value); setOffset(0); }} className={sel}>
          <option value="error">Fehler</option>
          <option value="warning">Warnungen</option>
          <option value="">Alle Level</option>
        </select>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }}
            placeholder="Suche Event / Text"
            className="h-8 pl-7 pr-3 text-[12px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]" />
        </div>
      </div>
      {loading ? <Loader /> : (
        <div className="space-y-1.5">
          {items.map(log => (
            <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[12px]">
              <LevelBadge level={log.level} />
              <span className="flex-1 text-[var(--color-text)] break-all">{log.event}</span>
              <span className="text-[var(--color-muted-2)] whitespace-nowrap flex-shrink-0">{formatDate(log.ts)}</span>
            </div>
          ))}
          {items.length === 0 && <div className="py-8 text-center text-[var(--color-muted)]">Keine Einträge.</div>}
        </div>
      )}
      <Pagination offset={offset} limit={LIMIT} hasMore={hasMore} onPrev={() => setOffset(o => Math.max(0, o - LIMIT))} onNext={() => setOffset(o => o + LIMIT)} />
    </div>
  );
}

// ─── 8. System Health ─────────────────────────────────────────────────────────

function SystemView() {
  const [status, setStatus] = useState<AdminSystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ ok: boolean; status: AdminSystemStatus }>('/admin/system');
      setStatus(data.status || null);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <><SectionHeader title="System" /><Loader /></>;

  const Flag = ({ label, value }: { label: string; value: boolean }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)] last:border-0">
      <span className="text-[13px] text-[var(--color-text)]">{label}</span>
      <span className={`text-[12px] font-semibold ${value ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)]'}`}>
        {value ? 'Aktiv' : 'Inaktiv'}
      </span>
    </div>
  );

  return (
    <div className="space-y-5">
      <SectionHeader title="System" onRefresh={load} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Environment */}
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[13px] font-semibold text-[var(--color-text)]">
            <Globe size={15} /> Umgebung
          </div>
          <div className="space-y-0">
            <div className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)]">
              <span className="text-[13px] text-[var(--color-text)]">Modus</span>
              <span className="text-[12px] font-semibold px-2 py-0.5 rounded bg-[var(--color-surface-3)] text-[var(--color-muted)] capitalize">{status?.environment ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)]">
              <span className="text-[13px] text-[var(--color-text)]">Admin-Zugang</span>
              <span className={`text-[12px] font-semibold ${status?.admin_enabled ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                {status?.admin_enabled ? 'Aktiviert' : 'Deaktiviert'}
              </span>
            </div>
          </div>
        </div>

        {/* Database */}
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[13px] font-semibold text-[var(--color-text)]">
            <Database size={15} /> Datenbank
          </div>
          <div className="space-y-0">
            <div className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)]">
              <span className="text-[13px] text-[var(--color-text)]">Engine</span>
              <span className="text-[12px] font-semibold text-[var(--color-text)] uppercase">{status?.database?.engine ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[13px] text-[var(--color-text)]">SQLite-Modus</span>
              <span className={`text-[12px] font-semibold ${status?.database?.using_sqlite ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}`}>
                {status?.database?.using_sqlite ? 'Ja (Dev)' : 'Nein'}
              </span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[13px] font-semibold text-[var(--color-text)]">
            <Zap size={15} /> Feature-Flags
          </div>
          {status?.features ? (
            <div>
              <Flag label="Gäste-Analyse" value={status.features.guest_analyze} />
              <Flag label="Paid APIs" value={status.features.paid_apis} />
              <Flag label="Local ML" value={status.features.local_ml} />
              <Flag label="Image Fallback" value={status.features.image_fallback} />
            </div>
          ) : <div className="text-[13px] text-[var(--color-muted)]">—</div>}
        </div>

        {/* Email */}
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[13px] font-semibold text-[var(--color-text)]">
            <Mail size={15} /> E-Mail
          </div>
          {status?.email ? (
            <div className="space-y-2">
              {Object.entries(status.email).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)] last:border-0">
                  <span className="text-[12px] text-[var(--color-text)] capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-[12px] text-[var(--color-muted)] max-w-[150px] truncate text-right">{String(v)}</span>
                </div>
              ))}
            </div>
          ) : <div className="text-[13px] text-[var(--color-muted)]">—</div>}
        </div>
      </div>
    </div>
  );
}

// ─── 9. Feedback Inbox ────────────────────────────────────────────────────────

function FeedbackView() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Feedback-Inbox" />
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--color-accent-muted)] flex items-center justify-center mx-auto mb-4">
          <MessageSquare size={22} className="text-[var(--color-accent)]" />
        </div>
        <div className="text-[15px] font-semibold text-[var(--color-text)] mb-2">Feedback-Backend in Entwicklung</div>
        <p className="text-[13px] text-[var(--color-muted)] max-w-md mx-auto leading-relaxed">
          Nutzer-Feedback (Feature-Wünsche, Bugs, allgemeine Rückmeldungen) wird aktuell
          per E-Mail empfangen. Die strukturierte Inbox mit Triage, Labels und Status-Tracking
          folgt in einem späteren Release.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <a href={`mailto:${CONTACT_EMAIL}`}
            className="h-9 px-4 text-[13px] font-medium rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-3)] transition-colors flex items-center gap-2">
            <Mail size={14} /> {CONTACT_EMAIL}
          </a>
        </div>
      </div>
      <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
        <div className="text-[12px] font-semibold text-[var(--color-muted-2)] uppercase tracking-widest mb-3">Geplante Features</div>
        <ul className="space-y-2 text-[13px] text-[var(--color-muted)]">
          {['Eingehende Feedback-Einträge (Feature / Bug / Allgemein)', 'Label- & Status-System (neu / in Bearbeitung / gelöst)', 'Antwort direkt aus der Inbox', 'Statistiken & NPS-Auswertung'].map(f => (
            <li key={f} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-muted-2)] flex-shrink-0 mt-1.5" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── 10. Audit Log ────────────────────────────────────────────────────────────

function AuditView() {
  const [items, setItems] = useState<AdminLogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (search) params.set('q', search);
      const data = await apiFetch<{ items: AdminLogEntry[]; has_more: boolean }>(`/admin/logs?${params}`);
      setItems(data.items || []);
      setHasMore(data.has_more ?? false);
    } catch { setItems([]); }
    setLoading(false);
  }, [offset, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <SectionHeader title="Audit-Log" onRefresh={load} />
      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
        <input value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }}
          placeholder="Suche Event / Meta…"
          className="w-full h-8 pl-7 pr-3 text-[12px] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]" />
      </div>
      {loading ? <Loader /> : (
        <div className="space-y-1.5">
          {items.map(log => (
            <div key={log.id} className="rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-[12px] hover:bg-[var(--color-surface-2)] transition-colors text-left"
              >
                <LevelBadge level={log.level} />
                <span className="flex-1 text-[var(--color-text)] truncate">{log.event}</span>
                <span className="text-[var(--color-muted-2)] whitespace-nowrap flex-shrink-0">{formatDate(log.ts)}</span>
                <ChevronDown size={12} className={`text-[var(--color-muted)] transition-transform flex-shrink-0 ${expandedId === log.id ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {expandedId === log.id && log.meta != null && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.15 }}>
                    <div className="px-3 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
                      <pre className="text-[11px] text-[var(--color-muted)] whitespace-pre-wrap break-all font-mono">
                        {typeof log.meta === 'string' ? log.meta : JSON.stringify(log.meta, null, 2)}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          {items.length === 0 && <div className="py-8 text-center text-[var(--color-muted)]">Keine Einträge.</div>}
        </div>
      )}
      <Pagination offset={offset} limit={LIMIT} hasMore={hasMore} onPrev={() => setOffset(o => Math.max(0, o - LIMIT))} onNext={() => setOffset(o => o + LIMIT)} />
    </div>
  );
}

// ─── Main AdminPage ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { isAdmin, user, loading } = useAuth();
  const [view, setView] = useState<AdminView>('overview');

  useEffect(() => {
    if (!loading && !isAdmin) router.replace('/dashboard');
  }, [isAdmin, loading, router]);

  if (loading || !isAdmin) return null;

  return (
    <div className="flex h-full min-h-0">
      {/* Desktop sidenav */}
      <aside className="hidden md:flex flex-col w-52 flex-shrink-0 bg-[var(--color-surface-2)] border-r border-[var(--color-border)] py-4">
        <div className="px-4 mb-5">
          <div className="text-[13px] font-bold text-[var(--color-text)]">Admin Panel</div>
          <div className="text-[11px] text-[var(--color-muted-2)] mt-0.5">AIRealCheck</div>
        </div>
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setView(id)}
              className={`flex items-center gap-2.5 h-8 w-full px-2 rounded-[var(--radius-sm)] text-[13px] transition-colors ${
                view === id
                  ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary)] font-medium'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)]'
              }`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>
        <div className="px-4 pt-4 border-t border-[var(--color-border)]">
          <div className="text-[11px] text-[var(--color-muted-2)] truncate">{user?.email}</div>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden flex gap-1 overflow-x-auto px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] flex-shrink-0 scrollbar-none">
        {NAV_ITEMS.map(({ id, label }) => (
          <button key={id} onClick={() => setView(id)}
            className={`flex-shrink-0 h-7 px-3 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${
              view === id ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-3)] text-[var(--color-muted)]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-5 py-6 max-w-5xl">
          <motion.div key={view} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
            {view === 'overview'  && <OverviewView />}
            {view === 'users'     && <UsersView />}
            {view === 'analyses'  && <AnalysesView />}
            {view === 'credits'   && <CreditsView />}
            {view === 'engines'   && <EnginesView />}
            {view === 'costs'     && <CostMonitorView />}
            {view === 'logs'      && <LogsView />}
            {view === 'system'    && <SystemView />}
            {view === 'feedback'  && <FeedbackView />}
            {view === 'audit'     && <AuditView />}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
