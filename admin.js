import { showPage } from './ui.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const DEFAULT_API_BASE = 'http://127.0.0.1:5001';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value) {
  if (!value) return '--';
  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString('de-DE');
  } catch (err) {
    return String(value);
  }
}

function formatDate(value) {
  if (!value) return '--';
  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('de-DE');
  } catch (err) {
    return String(value);
  }
}

function resolveAdminError(err) {
  const code = err?.response?.error || err?.message;
  if (code === 'forbidden' || err?.status === 403) return 'Kein Zugriff.';
  if (code === 'admin_disabled') return 'Adminzugriff ist deaktiviert.';
  if (code === 'credits_below_used') return 'Credits dürfen nicht unter verbrauchten liegen.';
  if (code === 'analysis_not_found') return 'Analyse nicht gefunden.';
  if (code === 'user_not_found') return 'Nutzer nicht gefunden.';
  if (err?.status === 400) return 'Ungültige Eingabe.';
  if (err?.status >= 500) return 'Serverfehler. Bitte später erneut versuchen.';
  return 'Aktion fehlgeschlagen.';
}

function formatScore(value) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return Math.round(num);
}

function badge(label, tone) {
  return `<span class="admin-badge admin-badge-${tone}">${escapeHtml(label)}</span>`;
}

function flagBadge(value, trueLabel = 'Aktiv', falseLabel = 'Inaktiv') {
  return badge(value ? trueLabel : falseLabel, value ? 'success' : 'muted');
}

function roleBadge(role) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin') return badge('Admin', 'info');
  return badge('Nutzer', 'muted');
}

function statusBadge(isBanned) {
  return isBanned ? badge('Gesperrt', 'danger') : badge('Aktiv', 'success');
}

function verifiedBadge(isVerified) {
  return isVerified ? badge('Verifiziert', 'success') : badge('Unverifiziert', 'warning');
}

function analysisStatusBadge(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'success') return badge('Erfolgreich', 'success');
  if (normalized === 'failed') return badge('Fehlgeschlagen', 'danger');
  if (normalized === 'pending') return badge('In Prüfung', 'warning');
  return badge(normalized || '--', 'muted');
}

function logLevelBadge(level) {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'error') return badge('Fehler', 'danger');
  if (normalized === 'warning') return badge('Warnung', 'warning');
  return badge(normalized || 'Info', 'info');
}

function creditKindBadge(kind) {
  const normalized = String(kind || '').toLowerCase();
  if (normalized === 'charge') return badge('Verbrauch', 'danger');
  if (normalized === 'grant') return badge('Gutschrift', 'success');
  if (normalized === 'admin_adjust') return badge('Admin-Anpassung', 'info');
  if (normalized === 'reset') return badge('Reset', 'warning');
  return badge(normalized || '--', 'muted');
}

function formatAmount(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return { label: '--', tone: 'muted' };
  if (num > 0) return { label: `+${num}`, tone: 'success' };
  if (num < 0) return { label: `${num}`, tone: 'danger' };
  return { label: String(num), tone: 'muted' };
}

function summarizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return '';
  const parts = [];
  if (meta.user_id) parts.push(`user ${meta.user_id}`);
  if (meta.admin_id) parts.push(`admin ${meta.admin_id}`);
  if (meta.amount !== undefined) parts.push(`amount ${meta.amount}`);
  if (meta.delta !== undefined) parts.push(`delta ${meta.delta}`);
  if (meta.mode) parts.push(String(meta.mode));
  return parts.join(' - ');
}

function jsonPretty(value) {
  if (value === null || value === undefined) return '--';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
}

export function initAdminPanel(auth, apiBaseInput) {
  const apiBase = (apiBaseInput || DEFAULT_API_BASE).replace(/\/+$/, '') || DEFAULT_API_BASE;
  const navItems = $$('[data-admin-view]');
  const views = {
    dashboard: $('#adminViewDashboard'),
    users: $('#adminViewUsers'),
    analyses: $('#adminViewAnalyses'),
    logs: $('#adminViewLogs'),
    credits: $('#adminViewCredits'),
    engines: $('#adminViewEngines'),
    moderation: $('#adminViewModeration'),
    system: $('#adminViewSystem'),
  };
  const viewMeta = {
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Systemstatus und KPIs',
    },
    users: {
      title: 'Nutzer',
      subtitle: 'Konten, Rollen und Credits',
    },
    analyses: {
      title: 'Analysen',
      subtitle: 'Prüfungen, Scores und Engine-Status',
    },
    logs: {
      title: 'Logs',
      subtitle: 'Admin-Events und Systemfehler',
    },
    credits: {
      title: 'Credits',
      subtitle: 'Buchungen, Anpassungen und Verlauf',
    },
    engines: {
      title: 'Engines',
      subtitle: 'Status, Nutzung und Gesundheit',
    },
    moderation: {
      title: 'Moderation',
      subtitle: 'Sperren und Auffälligkeiten',
    },
    system: {
      title: 'System',
      subtitle: 'Konfiguration und Infrastruktur',
    },
  };
  const notice = $('#adminNotice');
  const pageTitle = $('#adminPageTitle');
  const pageSubtitle = $('#adminPageSubtitle');
  const globalRefresh = $('#adminGlobalRefresh');
  const sidebarRefresh = $('#adminSidebarRefresh');
  const adminIdentity = $('#adminIdentity');
  const envBadge = $('#adminEnvBadge');

  const statTotalUsers = $('#adminStatTotalUsers');
  const statNewUsers = $('#adminStatNewUsers');
  const statAnalysesTotal = $('#adminStatAnalysesTotal');
  const statAnalysesToday = $('#adminStatAnalysesToday');
  const statCreditsTotal = $('#adminStatCreditsTotal');
  const statCreditsToday = $('#adminStatCreditsToday');
  const statErrorsToday = $('#adminStatErrorsToday');
  const statEnginesActive = $('#adminStatEnginesActive');
  const enginesList = $('#adminEnginesList');
  const recentAnalysesBody = $('#adminRecentAnalysesBody');
  const recentAnalysesEmpty = $('#adminRecentAnalysesEmpty');
  const topUsersList = $('#adminTopUsersList');
  const adminEventsList = $('#adminAdminEventsList');
  const errorEventsList = $('#adminErrorEventsList');

  const userSearchInput = $('#adminUserSearch');
  const userRoleSelect = $('#adminUserRole');
  const userStatusSelect = $('#adminUserStatus');
  const userVerifiedSelect = $('#adminUserVerified');
  const userSearchBtn = $('#adminUserSearchBtn');
  const userResetBtn = $('#adminUserResetBtn');
  const usersRefreshBtn = $('#adminUsersRefresh');
  const usersBody = $('#adminUsersBody');
  const usersEmpty = $('#adminUsersEmpty');
  const usersPrev = $('#adminUsersPrev');
  const usersNext = $('#adminUsersNext');
  const usersPage = $('#adminUsersPage');

  const analysesUserInput = $('#adminAnalysesUser');
  const analysesStatusInput = $('#adminAnalysesStatus');
  const analysesTypeInput = $('#adminAnalysesType');
  const analysesScoreMin = $('#adminAnalysesScoreMin');
  const analysesScoreMax = $('#adminAnalysesScoreMax');
  const analysesFrom = $('#adminAnalysesFrom');
  const analysesTo = $('#adminAnalysesTo');
  const analysesEngine = $('#adminAnalysesEngine');
  const analysesApplyBtn = $('#adminAnalysesApply');
  const analysesResetBtn = $('#adminAnalysesReset');
  const analysesRefreshBtn = $('#adminAnalysesRefresh');
  const analysesBody = $('#adminAnalysesBody');
  const analysesEmpty = $('#adminAnalysesEmpty');
  const analysesPrev = $('#adminAnalysesPrev');
  const analysesNext = $('#adminAnalysesNext');
  const analysesPage = $('#adminAnalysesPage');

  const logsLevelInput = $('#adminLogsLevel');
  const logsEventInput = $('#adminLogsEvent');
  const logsQueryInput = $('#adminLogsQuery');
  const logsFrom = $('#adminLogsFrom');
  const logsTo = $('#adminLogsTo');
  const logsApplyBtn = $('#adminLogsApply');
  const logsResetBtn = $('#adminLogsReset');
  const logsRefreshBtn = $('#adminLogsRefresh');
  const logsBody = $('#adminLogsBody');
  const logsEmpty = $('#adminLogsEmpty');
  const logsPrev = $('#adminLogsPrev');
  const logsNext = $('#adminLogsNext');
  const logsPage = $('#adminLogsPage');

  const creditsSummaryTotal = $('#adminCreditsSummaryTotal');
  const creditsSummaryToday = $('#adminCreditsSummaryToday');
  const creditsSpentTotal = $('#adminCreditsSpentTotal');
  const creditsSpentToday = $('#adminCreditsSpentToday');
  const creditsAdjustTotal = $('#adminCreditsAdjustTotal');
  const creditsAdjustToday = $('#adminCreditsAdjustToday');
  const creditsUserInput = $('#adminCreditsUser');
  const creditsKindInput = $('#adminCreditsKind');
  const creditsQueryInput = $('#adminCreditsQuery');
  const creditsFromInput = $('#adminCreditsFrom');
  const creditsToInput = $('#adminCreditsTo');
  const creditsApplyBtn = $('#adminCreditsApply');
  const creditsResetBtn = $('#adminCreditsReset');
  const creditsRefreshBtn = $('#adminCreditsRefresh');
  const creditsBody = $('#adminCreditsBody');
  const creditsEmpty = $('#adminCreditsEmpty');
  const creditsPrev = $('#adminCreditsPrev');
  const creditsNext = $('#adminCreditsNext');
  const creditsPage = $('#adminCreditsPage');

  const enginesOverview = $('#adminEnginesOverview');
  const enginesOverviewEmpty = $('#adminEnginesOverviewEmpty');
  const enginesOverviewMeta = $('#adminEnginesOverviewMeta');
  const enginesRefreshBtn = $('#adminEnginesRefresh');

  const moderationUsersBody = $('#adminModerationUsersBody');
  const moderationUsersEmpty = $('#adminModerationUsersEmpty');
  const moderationPrev = $('#adminModerationPrev');
  const moderationNext = $('#adminModerationNext');
  const moderationPage = $('#adminModerationPage');
  const moderationRefreshBtn = $('#adminModerationRefresh');
  const moderationEventsList = $('#adminModerationEventsList');

  const systemBody = $('#adminSystemBody');
  const systemRefreshBtn = $('#adminSystemRefresh');

  const userSegments = $$('[data-user-segment]');
  const analysesSegments = $$('[data-analyses-segment]');
  const logsSegments = $$('[data-logs-segment]');

  const drawerBackdrop = $('#adminDrawerBackdrop');
  const drawer = $('#adminDrawer');
  const drawerTitle = $('#adminDrawerTitle');
  const drawerSubtitle = $('#adminDrawerSubtitle');
  const drawerBody = $('#adminDrawerBody');
  const drawerActions = $('#adminDrawerActions');
  const drawerClose = $('#adminDrawerClose');

  const modalBackdrop = $('#adminModalBackdrop');
  const modal = $('#adminModal');
  const modalTitle = $('#adminModalTitle');
  const modalBody = $('#adminModalBody');
  const modalActions = $('#adminModalActions');
  const modalClose = $('#adminModalClose');

  const state = {
    activeView: 'dashboard',
    statsLoaded: false,
    users: {
      items: [],
      limit: 50,
      offset: 0,
      query: '',
      role: '',
      status: '',
      verified: '',
      sort: '',
      hasMore: false,
    },
    analyses: {
      items: [],
      limit: 50,
      offset: 0,
      hasMore: false,
    },
    logs: {
      items: [],
      limit: 100,
      offset: 0,
      hasMore: false,
    },
    credits: {
      items: [],
      limit: 50,
      offset: 0,
      query: '',
      userId: '',
      kind: '',
      from: '',
      to: '',
      hasMore: false,
    },
    engines: {
      items: [],
      loaded: false,
    },
    moderation: {
      items: [],
      limit: 20,
      offset: 0,
      hasMore: false,
    },
    system: {
      data: null,
      loaded: false,
    },
  };

  function setNotice(msg, tone = 'info') {
    if (!notice) return;
    if (!msg) {
      notice.hidden = true;
      notice.textContent = '';
      notice.dataset.tone = 'info';
      return;
    }
    notice.hidden = false;
    notice.textContent = msg;
    notice.dataset.tone = tone;
  }

  function setPageMeta(viewName) {
    const meta = viewMeta[viewName] || viewMeta.dashboard;
    if (pageTitle) pageTitle.textContent = meta.title;
    if (pageSubtitle) pageSubtitle.textContent = meta.subtitle;
  }

  function openModal({ title, body, actions } = {}) {
    if (!modal || !modalBody || !modalTitle || !modalActions || !modalBackdrop) return;
    modalTitle.textContent = title || 'Admin';
    modalBody.innerHTML = body || '';
    modalActions.innerHTML = '';
    (actions || []).forEach((action) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = action.className || 'ac-secondary';
      btn.textContent = action.label || 'OK';
      btn.addEventListener('click', () => {
        if (action.onClick) action.onClick();
      });
      modalActions.appendChild(btn);
    });
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modalBackdrop.hidden = false;
  }

  function closeModal() {
    if (!modal || !modalBackdrop) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modalBackdrop.hidden = true;
  }

  function openDrawer({ title, subtitle, body, actions } = {}) {
    if (!drawer || !drawerBody || !drawerTitle || !drawerActions || !drawerBackdrop) return;
    drawerTitle.textContent = title || 'Details';
    drawerSubtitle.textContent = subtitle || '';
    drawerBody.innerHTML = body || '';
    drawerActions.innerHTML = '';
    (actions || []).forEach((action) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = action.className || 'ac-secondary';
      btn.textContent = action.label || 'OK';
      btn.addEventListener('click', () => {
        if (action.onClick) action.onClick();
      });
      drawerActions.appendChild(btn);
    });
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    drawerBackdrop.hidden = false;
  }

  function closeDrawer() {
    if (!drawer || !drawerBackdrop) return;
    drawer.hidden = true;
    drawer.setAttribute('aria-hidden', 'true');
    drawerBackdrop.hidden = true;
  }

  async function adminRequest(path, { method = 'GET', body = null } = {}) {
    const headers = Object.assign({ Accept: 'application/json' }, auth.authHeaders());
    const opts = { method, headers };
    if (body !== null) {
      opts.body = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
    }
    const resp = await fetch(`${apiBase}${path}`, opts);
    let data = null;
    try {
      data = await resp.clone().json();
    } catch (err) {
      data = null;
    }
    if (resp.status === 401 && auth.token) {
      await auth.logout('Session abgelaufen. Bitte erneut anmelden.');
      const error = new Error('auth_required');
      error.status = resp.status;
      error.response = data;
      throw error;
    }
    if (resp.status === 403) {
      const error = new Error('forbidden');
      error.status = resp.status;
      error.response = data;
      throw error;
    }
    if (!resp.ok) {
      const error = new Error((data && data.error) || 'request_failed');
      error.status = resp.status;
      error.response = data;
      throw error;
    }
    return data;
  }

  function setView(viewName, force = false) {
    if (!viewName || (!force && state.activeView === viewName)) return;
    state.activeView = viewName;
    navItems.forEach((btn) => {
      const active = btn.dataset.adminView === viewName;
      btn.classList.toggle('is-active', active);
    });
    Object.entries(views).forEach(([name, el]) => {
      if (!el) return;
      el.classList.toggle('ac-hide', name !== viewName);
    });
    setPageMeta(viewName);
    loadActiveView();
  }

  function closeAllMenus() {
    document.querySelectorAll('.admin-action-menu.is-open').forEach((menu) => {
      menu.classList.remove('is-open');
    });
  }

  function formatCredits(user) {
    const total = Number(user?.credits_total ?? 0);
    const used = Number(user?.credits_used ?? 0);
    const available = Number(user?.credits_available ?? Math.max(0, total - used));
    return `${used}/${total} (verfügbar ${available})`;
  }

  function renderEngines(list) {
    if (!enginesList) return;
    const items = Array.isArray(list) ? list : [];
    if (!items.length) {
      enginesList.innerHTML = '<div class="admin-subtle">Keine aktiven Engines.</div>';
      return;
    }
    enginesList.innerHTML = items
      .map((name) => `
        <div class="admin-engine-item">
          <div class="admin-engine-name">${escapeHtml(name)}</div>
          <div class="admin-engine-status">${badge('Aktiv', 'success')}</div>
        </div>
      `)
      .join('');
  }

  function renderRecentAnalyses(items) {
    if (!recentAnalysesBody) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      recentAnalysesBody.innerHTML = '';
      if (recentAnalysesEmpty) recentAnalysesEmpty.hidden = false;
      return;
    }
    if (recentAnalysesEmpty) recentAnalysesEmpty.hidden = true;
    recentAnalysesBody.innerHTML = list
      .map((row) => `
        <tr>
          <td>${escapeHtml(row.id)}</td>
          <td>${row.user_id ?? '--'}</td>
          <td>${formatDate(row.created_at)}</td>
          <td>${escapeHtml(row.media_type || '--')}</td>
          <td>${analysisStatusBadge(row.status)}</td>
          <td>${formatScore(row.final_score)}</td>
          <td>${row.credits_charged ?? 0}</td>
        </tr>
      `)
      .join('');
  }

  function renderTopUsers(items) {
    if (!topUsersList) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      topUsersList.innerHTML = '<div class="admin-subtle">Keine Daten.</div>';
      return;
    }
    topUsersList.innerHTML = list
      .map((row) => `
        <div class="admin-list-item">
          <div class="admin-list-title">${escapeHtml(row.email || `Nutzer ${row.id}`)}</div>
          <div class="admin-list-meta">Analysen: ${row.analyses_count ?? 0}</div>
        </div>
      `)
      .join('');
  }

  function renderAdminEvents(items) {
    if (!adminEventsList) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      adminEventsList.innerHTML = '<div class="admin-subtle">Keine Events.</div>';
      return;
    }
    adminEventsList.innerHTML = list
      .map((row) => `
        <div class="admin-list-item">
          <div class="admin-list-title">${escapeHtml(row.event || '--')}</div>
          <div class="admin-list-meta">${formatDateTime(row.ts)}${summarizeMeta(row.meta) ? ' - ' + escapeHtml(summarizeMeta(row.meta)) : ''}</div>
        </div>
      `)
      .join('');
  }

  function renderErrorEvents(items) {
    if (!errorEventsList) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      errorEventsList.innerHTML = '<div class="admin-subtle">Keine Fehler.</div>';
      return;
    }
    errorEventsList.innerHTML = list
      .map((row) => `
        <div class="admin-list-item">
          <div class="admin-list-title">${escapeHtml(row.event || '--')}</div>
          <div class="admin-list-meta">${formatDateTime(row.ts)}${summarizeMeta(row.meta) ? ' - ' + escapeHtml(summarizeMeta(row.meta)) : ''}</div>
        </div>
      `)
      .join('');
  }

  function setSegmentActive(buttons, key, attr) {
    if (!buttons?.length) return;
    buttons.forEach((btn) => {
      const value = btn.dataset[attr];
      btn.classList.toggle('is-active', value === key);
    });
  }

  function renderCreditSummary(summary) {
    if (!summary) return;
    if (creditsSummaryTotal) creditsSummaryTotal.textContent = summary.transactions_total ?? '--';
    if (creditsSummaryToday) creditsSummaryToday.textContent = summary.transactions_today ?? '--';
    if (creditsSpentTotal) creditsSpentTotal.textContent = summary.credits_spent_total ?? '--';
    if (creditsSpentToday) creditsSpentToday.textContent = summary.credits_spent_today ?? '--';
    if (creditsAdjustTotal) creditsAdjustTotal.textContent = summary.admin_adjust_total ?? '--';
    if (creditsAdjustToday) creditsAdjustToday.textContent = summary.admin_adjust_today ?? '--';
  }

  function renderCredits(items) {
    if (!creditsBody) return;
    state.credits.items = items;
    if (!items.length) {
      creditsBody.innerHTML = '';
      if (creditsEmpty) creditsEmpty.hidden = false;
      return;
    }
    if (creditsEmpty) creditsEmpty.hidden = true;
    creditsBody.innerHTML = items
      .map((row) => {
        const userLabel = row.email ? escapeHtml(row.email) : `Nutzer ${row.user_id ?? '--'}`;
        const amountInfo = formatAmount(row.amount);
        return `
          <tr>
            <td>${formatDateTime(row.created_at)}</td>
            <td>
              <div class="admin-cell-stack">
                <div class="admin-cell-title">${userLabel}</div>
                <div class="admin-cell-sub">ID ${row.user_id ?? '--'}</div>
              </div>
            </td>
            <td>${creditKindBadge(row.kind)}</td>
            <td>${badge(amountInfo.label, amountInfo.tone)}</td>
            <td>${escapeHtml(row.note || '--')}</td>
            <td>${escapeHtml(row.analysis_id || '--')}</td>
            <td>${escapeHtml(row.media_type || '--')}</td>
          </tr>`;
      })
      .join('');
  }

  function updateCreditsPagination() {
    const page = Math.floor(state.credits.offset / state.credits.limit) + 1;
    if (creditsPage) creditsPage.textContent = `Seite ${page}`;
    if (creditsPrev) creditsPrev.disabled = state.credits.offset <= 0;
    if (creditsNext) creditsNext.disabled = !state.credits.hasMore;
  }

  async function loadCredits() {
    if (!auth.isAdmin()) return;
    if (creditsBody) {
      creditsBody.innerHTML = '<tr><td colspan="7" class="admin-table-loading">Lade...</td></tr>';
    }
    if (creditsEmpty) creditsEmpty.hidden = true;
    try {
      const params = new URLSearchParams();
      params.set('limit', String(state.credits.limit));
      params.set('offset', String(state.credits.offset));
      if (state.credits.userId) params.set('user_id', state.credits.userId);
      if (state.credits.kind) params.set('kind', state.credits.kind);
      if (state.credits.query) params.set('q', state.credits.query);
      if (state.credits.from) params.set('from', state.credits.from);
      if (state.credits.to) params.set('to', state.credits.to);
      const data = await adminRequest(`/admin/credits?${params.toString()}`);
      state.credits.hasMore = !!data.has_more;
      renderCredits(Array.isArray(data.items) ? data.items : []);
      renderCreditSummary(data.summary || {});
      updateCreditsPagination();
    } catch (err) {
      setNotice(resolveAdminError(err), 'error');
      if (creditsBody) creditsBody.innerHTML = '';
      if (creditsEmpty) creditsEmpty.hidden = false;
    }
  }

  function renderEnginesOverview(items, meta) {
    if (!enginesOverview) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      enginesOverview.innerHTML = '';
      if (enginesOverviewEmpty) enginesOverviewEmpty.hidden = false;
      if (enginesOverviewMeta) enginesOverviewMeta.textContent = '';
      return;
    }
    if (enginesOverviewEmpty) enginesOverviewEmpty.hidden = true;
    if (enginesOverviewMeta) {
      const windowValue = meta?.window ?? '--';
      const hoursValue = meta?.recent_hours ?? '--';
      enginesOverviewMeta.textContent = `Basis: letzte ${windowValue} Analysen, ${hoursValue}h Nutzung`;
    }
    enginesOverview.innerHTML = list
      .map((engine) => `
        <div class="admin-engine-card">
          <div class="admin-engine-card-head">
            <div class="admin-engine-card-title">${escapeHtml(engine.name || '--')}</div>
            ${engine.status === 'active' ? badge('Aktiv', 'success') : badge('Inaktiv', 'muted')}
          </div>
          <div class="admin-engine-card-meta">
            <div>
              <div class="admin-detail-label">Zuletzt genutzt</div>
              <div class="admin-detail-value">${formatDateTime(engine.last_used)}</div>
            </div>
            <div>
              <div class="admin-detail-label">Calls 24h</div>
              <div class="admin-detail-value">${engine.calls_recent ?? 0}</div>
            </div>
            <div>
              <div class="admin-detail-label">Calls gesamt</div>
              <div class="admin-detail-value">${engine.calls_total ?? 0}</div>
            </div>
          </div>
        </div>
      `)
      .join('');
  }

  async function loadEnginesOverview() {
    if (!auth.isAdmin()) return;
    if (enginesOverview) {
      enginesOverview.innerHTML = '<div class="admin-subtle">Lade...</div>';
    }
    if (enginesOverviewEmpty) enginesOverviewEmpty.hidden = true;
    try {
      const data = await adminRequest('/admin/engines');
      state.engines.items = Array.isArray(data.items) ? data.items : [];
      state.engines.loaded = true;
      renderEnginesOverview(state.engines.items, data);
    } catch (err) {
      setNotice(resolveAdminError(err), 'error');
      if (enginesOverview) enginesOverview.innerHTML = '';
      if (enginesOverviewEmpty) enginesOverviewEmpty.hidden = false;
    }
  }

  function renderModerationUsers(items) {
    if (!moderationUsersBody) return;
    state.moderation.items = items;
    if (!items.length) {
      moderationUsersBody.innerHTML = '';
      if (moderationUsersEmpty) moderationUsersEmpty.hidden = false;
      return;
    }
    if (moderationUsersEmpty) moderationUsersEmpty.hidden = true;
    moderationUsersBody.innerHTML = items
      .map((user) => {
        const menuId = `moderation-${user.id}`;
        return `
          <tr>
            <td>${user.id}</td>
            <td>${escapeHtml(user.email || '--')}</td>
            <td>${statusBadge(!!user.is_banned)}</td>
            <td>${formatDateTime(user.last_login)}</td>
            <td>
              <div class="admin-action">
                <button class="admin-action-trigger" type="button" data-menu-trigger="moderation" data-menu-id="${menuId}">
                  <span class="admin-action-dots"></span>
                </button>
                <div class="admin-action-menu" data-menu="moderation" data-menu-id="${menuId}">
                  <button type="button" data-user-action="detail" data-user-id="${user.id}">Details</button>
                  <button type="button" data-user-action="ban" data-user-id="${user.id}">${user.is_banned ? 'Entsperren' : 'Sperren'}</button>
                </div>
              </div>
            </td>
          </tr>`;
      })
      .join('');
  }

  function renderModerationEvents(items) {
    if (!moderationEventsList) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      moderationEventsList.innerHTML = '<div class="admin-subtle">Keine Moderations-Events.</div>';
      return;
    }
    moderationEventsList.innerHTML = list
      .map((row) => `
        <div class="admin-list-item">
          <div class="admin-list-title">${escapeHtml(row.event || '--')}</div>
          <div class="admin-list-meta">${formatDateTime(row.ts)}${summarizeMeta(row.meta) ? ' - ' + escapeHtml(summarizeMeta(row.meta)) : ''}</div>
        </div>
      `)
      .join('');
  }

  function updateModerationPagination() {
    const page = Math.floor(state.moderation.offset / state.moderation.limit) + 1;
    if (moderationPage) moderationPage.textContent = `Seite ${page}`;
    if (moderationPrev) moderationPrev.disabled = state.moderation.offset <= 0;
    if (moderationNext) moderationNext.disabled = !state.moderation.hasMore;
  }

  async function loadModeration() {
    if (!auth.isAdmin()) return;
    if (moderationUsersBody) {
      moderationUsersBody.innerHTML = '<tr><td colspan="5" class="admin-table-loading">Lade...</td></tr>';
    }
    if (moderationUsersEmpty) moderationUsersEmpty.hidden = true;
    if (moderationEventsList) moderationEventsList.innerHTML = '<div class="admin-subtle">Lade...</div>';
    try {
      const params = new URLSearchParams();
      params.set('limit', String(state.moderation.limit));
      params.set('offset', String(state.moderation.offset));
      params.set('banned', 'true');
      const [usersData, logsData] = await Promise.all([
        adminRequest(`/admin/users?${params.toString()}`),
        adminRequest('/admin/logs?event=ADMIN_USER_&limit=8'),
      ]);
      state.moderation.hasMore = !!usersData.has_more;
      renderModerationUsers(Array.isArray(usersData.users) ? usersData.users : []);
      renderModerationEvents(Array.isArray(logsData.items) ? logsData.items : []);
      updateModerationPagination();
    } catch (err) {
      setNotice(resolveAdminError(err), 'error');
      if (moderationUsersBody) moderationUsersBody.innerHTML = '';
      if (moderationUsersEmpty) moderationUsersEmpty.hidden = false;
    }
  }

  function renderSystem(status) {
    if (!systemBody) return;
    const payload = status || {};
    const email = payload.email || {};
    const database = payload.database || {};
    const features = payload.features || {};
    systemBody.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-head">
          <div>
            <div class="admin-card-title">Umgebung</div>
            <div class="admin-card-sub">Laufzeit und Admin-Zugriff</div>
          </div>
        </div>
        <div class="admin-detail-grid">
          <div>
            <div class="admin-detail-label">Environment</div>
            <div class="admin-detail-value">${escapeHtml(payload.environment || '--')}</div>
          </div>
          <div>
            <div class="admin-detail-label">Admin-Zugriff</div>
            <div class="admin-detail-value">${flagBadge(!!payload.admin_enabled, 'Aktiv', 'Deaktiviert')}</div>
          </div>
        </div>
      </div>
      <div class="admin-card">
        <div class="admin-card-head">
          <div>
            <div class="admin-card-title">Datenbank</div>
            <div class="admin-card-sub">Backend-Storage</div>
          </div>
        </div>
        <div class="admin-detail-grid">
          <div>
            <div class="admin-detail-label">Engine</div>
            <div class="admin-detail-value">${escapeHtml(database.engine || '--')}</div>
          </div>
          <div>
            <div class="admin-detail-label">SQLite aktiv</div>
            <div class="admin-detail-value">${flagBadge(!!database.using_sqlite, 'Ja', 'Nein')}</div>
          </div>
        </div>
      </div>
      <div class="admin-card">
        <div class="admin-card-head">
          <div>
            <div class="admin-card-title">E-Mail</div>
            <div class="admin-card-sub">Versand & Provider</div>
          </div>
        </div>
        <div class="admin-detail-grid">
          <div>
            <div class="admin-detail-label">Provider</div>
            <div class="admin-detail-value">${escapeHtml(email.provider || '--')}</div>
          </div>
          <div>
            <div class="admin-detail-label">SMTP konfiguriert</div>
            <div class="admin-detail-value">${flagBadge(!!email.smtp_configured, 'Ja', 'Nein')}</div>
          </div>
          <div>
            <div class="admin-detail-label">Dev-Console</div>
            <div class="admin-detail-value">${flagBadge(!!email.dev_console, 'Aktiv', 'Aus')}</div>
          </div>
          <div>
            <div class="admin-detail-label">TLS</div>
            <div class="admin-detail-value">${flagBadge(!!email.use_tls, 'An', 'Aus')}</div>
          </div>
        </div>
      </div>
      <div class="admin-card">
        <div class="admin-card-head">
          <div>
            <div class="admin-card-title">Features</div>
            <div class="admin-card-sub">Aktive Schalter</div>
          </div>
        </div>
        <div class="admin-detail-grid">
          <div>
            <div class="admin-detail-label">Guest Analyze</div>
            <div class="admin-detail-value">${flagBadge(!!features.guest_analyze, 'Aktiv', 'Aus')}</div>
          </div>
          <div>
            <div class="admin-detail-label">Paid APIs</div>
            <div class="admin-detail-value">${flagBadge(!!features.paid_apis, 'Aktiv', 'Aus')}</div>
          </div>
          <div>
            <div class="admin-detail-label">Local ML</div>
            <div class="admin-detail-value">${flagBadge(!!features.local_ml, 'Aktiv', 'Aus')}</div>
          </div>
          <div>
            <div class="admin-detail-label">Image Fallback</div>
            <div class="admin-detail-value">${flagBadge(!!features.image_fallback, 'Aktiv', 'Aus')}</div>
          </div>
        </div>
      </div>
    `;
  }

  async function loadSystem() {
    if (!auth.isAdmin()) return;
    if (systemBody) systemBody.innerHTML = '<div class="admin-subtle">Lade...</div>';
    try {
      const data = await adminRequest('/admin/system');
      state.system.data = data.status || null;
      state.system.loaded = true;
      renderSystem(state.system.data);
    } catch (err) {
      setNotice(resolveAdminError(err), 'error');
      if (systemBody) systemBody.innerHTML = '<div class="admin-subtle">Keine Systemdaten verfügbar.</div>';
    }
  }

  async function loadStats() {
    if (!auth.isAdmin()) return;
    setNotice('');
    try {
      const data = await adminRequest('/admin/stats');
      if (statTotalUsers) statTotalUsers.textContent = data.total_users ?? '--';
      if (statNewUsers) statNewUsers.textContent = data.new_users_today ?? '--';
      if (statAnalysesTotal) statAnalysesTotal.textContent = data.analyses_total ?? '--';
      if (statAnalysesToday) statAnalysesToday.textContent = data.analyses_today ?? '--';
      if (statCreditsTotal) statCreditsTotal.textContent = data.credits_spent_total ?? '--';
      if (statCreditsToday) statCreditsToday.textContent = data.credits_spent_today ?? '--';
      if (statErrorsToday) statErrorsToday.textContent = data.errors_today ?? 0;
      if (statEnginesActive) {
        const count = Array.isArray(data.engines_active) ? data.engines_active.length : 0;
        statEnginesActive.textContent = count;
      }
      renderEngines(data.engines_active);
      renderRecentAnalyses(data.recent_analyses || []);
      renderTopUsers(data.top_users || []);
      renderAdminEvents(data.recent_admin_events || []);
      renderErrorEvents(data.recent_error_logs || []);
      state.statsLoaded = true;
    } catch (err) {
      setNotice(resolveAdminError(err), 'error');
    }
  }

  function renderUsers(users) {
    if (!usersBody) return;
    state.users.items = users;
    if (!users.length) {
      usersBody.innerHTML = '';
      if (usersEmpty) usersEmpty.hidden = false;
      return;
    }
    if (usersEmpty) usersEmpty.hidden = true;
    usersBody.innerHTML = users
      .map((user) => {
        const role = user.role || (user.is_admin ? 'admin' : 'user');
        const menuId = `user-${user.id}`;
        return `
          <tr>
            <td>${user.id}</td>
            <td>${escapeHtml(user.email || '--')}</td>
            <td>${roleBadge(role)}</td>
            <td>${statusBadge(!!user.is_banned)}</td>
            <td>${verifiedBadge(!!user.email_verified)}</td>
            <td>${escapeHtml(formatCredits(user))}</td>
            <td>${user.analyses_count ?? 0}</td>
            <td>${formatDate(user.created_at)}</td>
            <td>${formatDateTime(user.last_login)}</td>
            <td>
              <div class="admin-action">
                <button class="admin-action-trigger" type="button" data-menu-trigger="user" data-menu-id="${menuId}">
                  <span class="admin-action-dots"></span>
                </button>
                <div class="admin-action-menu" data-menu="user" data-menu-id="${menuId}">
                  <button type="button" data-user-action="detail" data-user-id="${user.id}">Details</button>
                  <button type="button" data-user-action="credits" data-user-id="${user.id}">Credits anpassen</button>
                  <button type="button" data-user-action="ban" data-user-id="${user.id}">${user.is_banned ? 'Entsperren' : 'Sperren'}</button>
                  <button type="button" data-user-action="reset" data-user-id="${user.id}">Passwort zurücksetzen</button>
                </div>
              </div>
            </td>
          </tr>`;
      })
      .join('');
  }

  function updateUsersPagination() {
    const page = Math.floor(state.users.offset / state.users.limit) + 1;
    if (usersPage) usersPage.textContent = `Seite ${page}`;
    if (usersPrev) usersPrev.disabled = state.users.offset <= 0;
    if (usersNext) usersNext.disabled = !state.users.hasMore;
  }

  async function loadUsers() {
    if (!auth.isAdmin()) return;
    if (usersBody) {
      usersBody.innerHTML = '<tr><td colspan="10" class="admin-table-loading">Lade...</td></tr>';
    }
    if (usersEmpty) usersEmpty.hidden = true;
    try {
      const params = new URLSearchParams();
      params.set('limit', String(state.users.limit));
      params.set('offset', String(state.users.offset));
      if (state.users.query) params.set('q', state.users.query);
      if (state.users.role) params.set('role', state.users.role);
      if (state.users.status) params.set('status', state.users.status);
      if (state.users.verified !== '') params.set('verified', state.users.verified);
      if (state.users.sort) params.set('sort', state.users.sort);
      const data = await adminRequest(`/admin/users?${params.toString()}`);
      state.users.hasMore = !!data.has_more;
      renderUsers(Array.isArray(data.users) ? data.users : []);
      updateUsersPagination();
    } catch (err) {
      setNotice(resolveAdminError(err), 'error');
      if (usersBody) usersBody.innerHTML = '';
      if (usersEmpty) usersEmpty.hidden = false;
    }
  }

  function renderAnalyses(items) {
    if (!analysesBody) return;
    state.analyses.items = items;
    if (!items.length) {
      analysesBody.innerHTML = '';
      if (analysesEmpty) analysesEmpty.hidden = false;
      return;
    }
    if (analysesEmpty) analysesEmpty.hidden = true;
    analysesBody.innerHTML = items
      .map((row) => {
        const menuId = `analysis-${row.id}`;
        return `
          <tr>
            <td>${escapeHtml(row.id)}</td>
            <td>${row.user_id ?? '--'}</td>
            <td>${formatDate(row.created_at)}</td>
            <td>${escapeHtml(row.media_type || '--')}</td>
            <td>${analysisStatusBadge(row.status)}</td>
            <td>${formatScore(row.final_score)}</td>
            <td>${row.credits_charged ?? 0}</td>
            <td>${escapeHtml(row.engines_summary || '--')}</td>
            <td>
              <div class="admin-action">
                <button class="admin-action-trigger" type="button" data-menu-trigger="analysis" data-menu-id="${menuId}">
                  <span class="admin-action-dots"></span>
                </button>
                <div class="admin-action-menu" data-menu="analysis" data-menu-id="${menuId}">
                  <button type="button" data-analysis-action="detail" data-analysis-id="${escapeHtml(row.id)}">Details</button>
                </div>
              </div>
            </td>
          </tr>`;
      })
      .join('');
  }

  function updateAnalysesPagination() {
    const page = Math.floor(state.analyses.offset / state.analyses.limit) + 1;
    if (analysesPage) analysesPage.textContent = `Seite ${page}`;
    if (analysesPrev) analysesPrev.disabled = state.analyses.offset <= 0;
    if (analysesNext) analysesNext.disabled = !state.analyses.hasMore;
  }

  async function loadAnalyses() {
    if (!auth.isAdmin()) return;
    if (analysesBody) {
      analysesBody.innerHTML = '<tr><td colspan="9" class="admin-table-loading">Lade...</td></tr>';
    }
    if (analysesEmpty) analysesEmpty.hidden = true;
    try {
      const params = new URLSearchParams();
      params.set('limit', String(state.analyses.limit));
      params.set('offset', String(state.analyses.offset));
      const userId = (analysesUserInput?.value || '').trim();
      const status = (analysesStatusInput?.value || '').trim();
      const mediaType = (analysesTypeInput?.value || '').trim();
      const scoreMin = (analysesScoreMin?.value || '').trim();
      const scoreMax = (analysesScoreMax?.value || '').trim();
      const dateFrom = (analysesFrom?.value || '').trim();
      const dateTo = (analysesTo?.value || '').trim();
      const engine = (analysesEngine?.value || '').trim();
      if (userId) params.set('user_id', userId);
      if (status) params.set('status', status);
      if (mediaType) params.set('type', mediaType);
      if (scoreMin) params.set('score_min', scoreMin);
      if (scoreMax) params.set('score_max', scoreMax);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (engine) params.set('engine', engine);
      const data = await adminRequest(`/admin/analyses?${params.toString()}`);
      state.analyses.hasMore = !!data.has_more;
      renderAnalyses(Array.isArray(data.items) ? data.items : []);
      updateAnalysesPagination();
    } catch (err) {
      setNotice(resolveAdminError(err), 'error');
      if (analysesBody) analysesBody.innerHTML = '';
      if (analysesEmpty) analysesEmpty.hidden = false;
    }
  }

  function renderLogs(items) {
    if (!logsBody) return;
    state.logs.items = items;
    if (!items.length) {
      logsBody.innerHTML = '';
      if (logsEmpty) logsEmpty.hidden = false;
      return;
    }
    if (logsEmpty) logsEmpty.hidden = true;
    logsBody.innerHTML = items
      .map((row) => {
        const meta = row.meta ? JSON.stringify(row.meta) : '--';
        const shortMeta = meta.length > 120 ? `${meta.slice(0, 117)}...` : meta;
        const menuId = `log-${row.id}`;
        return `
          <tr>
            <td>${formatDateTime(row.ts)}</td>
            <td>${logLevelBadge(row.level)}</td>
            <td>${escapeHtml(row.event || '--')}</td>
            <td title="${escapeHtml(meta)}">${escapeHtml(shortMeta)}</td>
            <td>
              <div class="admin-action">
                <button class="admin-action-trigger" type="button" data-menu-trigger="log" data-menu-id="${menuId}">
                  <span class="admin-action-dots"></span>
                </button>
                <div class="admin-action-menu" data-menu="log" data-menu-id="${menuId}">
                  <button type="button" data-log-action="detail" data-log-id="${row.id}">Details</button>
                </div>
              </div>
            </td>
          </tr>`;
      })
      .join('');
  }

  function updateLogsPagination() {
    const page = Math.floor(state.logs.offset / state.logs.limit) + 1;
    if (logsPage) logsPage.textContent = `Seite ${page}`;
    if (logsPrev) logsPrev.disabled = state.logs.offset <= 0;
    if (logsNext) logsNext.disabled = !state.logs.hasMore;
  }

  async function loadLogs() {
    if (!auth.isAdmin()) return;
    if (logsBody) {
      logsBody.innerHTML = '<tr><td colspan="5" class="admin-table-loading">Lade...</td></tr>';
    }
    if (logsEmpty) logsEmpty.hidden = true;
    try {
      const params = new URLSearchParams();
      params.set('limit', String(state.logs.limit));
      params.set('offset', String(state.logs.offset));
      const level = (logsLevelInput?.value || '').trim();
      const event = (logsEventInput?.value || '').trim();
      const query = (logsQueryInput?.value || '').trim();
      const dateFrom = (logsFrom?.value || '').trim();
      const dateTo = (logsTo?.value || '').trim();
      if (level) params.set('level', level);
      if (event) params.set('event', event);
      if (query) params.set('q', query);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const data = await adminRequest(`/admin/logs?${params.toString()}`);
      state.logs.hasMore = !!data.has_more;
      renderLogs(Array.isArray(data.items) ? data.items : []);
      updateLogsPagination();
    } catch (err) {
      setNotice(resolveAdminError(err), 'error');
      if (logsBody) logsBody.innerHTML = '';
      if (logsEmpty) logsEmpty.hidden = false;
    }
  }

  async function openUserDetail(userId) {
    if (!userId) return;
    openDrawer({
      title: `Nutzer ${userId}`,
      subtitle: 'Lädt...',
      body: '<div class="admin-modal-loading">Lade Nutzer...</div>',
      actions: [{ label: 'Schließen', className: 'ac-ghost', onClick: closeDrawer }],
    });
    try {
      const data = await adminRequest(`/admin/users/${userId}`);
      const user = data.user || {};
      const creditsAvailable = Number(user.credits_available ?? Math.max(0, (user.credits_total || 0) - (user.credits_used || 0)));
      const creditRows = Array.isArray(user.credit_history) ? user.credit_history : [];
      const analyses = Array.isArray(user.last_analyses) ? user.last_analyses : [];
      const creditTable = creditRows.length
        ? creditRows.map((row) => {
          const amountInfo = formatAmount(row.amount);
          return `
            <tr>
              <td>${formatDateTime(row.created_at)}</td>
              <td>${creditKindBadge(row.kind)}</td>
              <td>${badge(amountInfo.label, amountInfo.tone)}</td>
              <td>${escapeHtml(row.note || '--')}</td>
            </tr>
          `;
        }).join('')
        : '<tr><td colspan="4" class="admin-table-empty">Keine Änderungen.</td></tr>';
      const analysesRows = analyses.length
        ? analyses.map((row) => `
            <tr>
              <td>${escapeHtml(row.id)}</td>
              <td>${formatDate(row.created_at)}</td>
              <td>${escapeHtml(row.media_type || '--')}</td>
              <td>${analysisStatusBadge(row.status)}</td>
              <td>${formatScore(row.final_score)}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="5" class="admin-table-empty">Keine Analysen vorhanden.</td></tr>';
      const body = `
        <div class="admin-drawer-section">
          <div class="admin-section-title">Profil</div>
          <div class="admin-detail-grid">
            <div>
              <div class="admin-detail-label">Nutzer-ID</div>
              <div class="admin-detail-value">${user.id ?? '--'}</div>
            </div>
            <div>
              <div class="admin-detail-label">Email</div>
              <div class="admin-detail-value">${escapeHtml(user.email || '--')}</div>
            </div>
            <div>
              <div class="admin-detail-label">Name</div>
              <div class="admin-detail-value">${escapeHtml(user.display_name || '--')}</div>
            </div>
            <div>
              <div class="admin-detail-label">Rolle</div>
              <div class="admin-detail-value">${roleBadge(user.role)}</div>
            </div>
            <div>
              <div class="admin-detail-label">Status</div>
              <div class="admin-detail-value">${statusBadge(!!user.is_banned)}</div>
            </div>
            <div>
              <div class="admin-detail-label">Verifiziert</div>
              <div class="admin-detail-value">${verifiedBadge(!!user.email_verified)}</div>
            </div>
            <div>
              <div class="admin-detail-label">Registriert</div>
              <div class="admin-detail-value">${formatDateTime(user.created_at)}</div>
            </div>
            <div>
              <div class="admin-detail-label">Letzter Login</div>
              <div class="admin-detail-value">${formatDateTime(user.last_login)}</div>
            </div>
            <div>
              <div class="admin-detail-label">Letzte IP</div>
              <div class="admin-detail-value">${escapeHtml(user.last_login_ip || '--')}</div>
            </div>
          </div>
        </div>
        <div class="admin-drawer-section">
          <div class="admin-section-title">Technik</div>
          <div class="admin-detail-grid">
            <div>
              <div class="admin-detail-label">User-Agent</div>
              <div class="admin-detail-value">${escapeHtml(user.last_login_user_agent || '--')}</div>
            </div>
          </div>
        </div>
        <div class="admin-drawer-section">
          <div class="admin-section-title">Credits</div>
          <div class="admin-detail-grid">
            <div>
              <div class="admin-detail-label">Credits gesamt</div>
              <div class="admin-detail-value">${user.credits_total ?? 0}</div>
            </div>
            <div>
              <div class="admin-detail-label">Credits verbraucht</div>
              <div class="admin-detail-value">${user.credits_used ?? 0}</div>
            </div>
            <div>
              <div class="admin-detail-label">Credits verfügbar</div>
              <div class="admin-detail-value">${creditsAvailable}</div>
            </div>
          </div>
          <div class="admin-subtitle">Letzte Credit-Änderungen</div>
          <div class="admin-table-wrap admin-table-compact">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Typ</th>
                  <th>Betrag</th>
                  <th>Notiz</th>
                </tr>
              </thead>
              <tbody>
                ${creditTable}
              </tbody>
            </table>
          </div>
        </div>
        <div class="admin-drawer-section">
          <div class="admin-section-title">Aktivität</div>
          <div class="admin-subtitle">Letzte Analysen</div>
          <div class="admin-table-wrap admin-table-compact">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Datum</th>
                  <th>Typ</th>
                  <th>Status</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                ${analysesRows}
              </tbody>
            </table>
          </div>
        </div>
      `;
      openDrawer({
        title: `Nutzer ${user.id}`,
        subtitle: escapeHtml(user.email || ''),
        body,
        actions: [
          { label: 'Credits anpassen', className: 'ac-secondary', onClick: () => openCreditsModal(user) },
          { label: user.is_banned ? 'Entsperren' : 'Sperren', className: 'ac-ghost', onClick: () => openBanModal(user) },
          { label: 'Passwort zurücksetzen', className: 'ac-ghost', onClick: () => openResetPasswordModal(user) },
          { label: 'Schließen', className: 'ac-ghost', onClick: closeDrawer },
        ],
      });
    } catch (err) {
      openDrawer({
        title: `Nutzer ${userId}`,
        subtitle: 'Fehler',
        body: `<div class="admin-modal-alert" data-tone="error">${escapeHtml(resolveAdminError(err))}</div>`,
        actions: [{ label: 'Schließen', className: 'ac-ghost', onClick: closeDrawer }],
      });
    }
  }

  async function openAnalysisDetail(analysisId) {
    if (!analysisId) return;
    openDrawer({
      title: `Analyse ${analysisId}`,
      subtitle: 'Lädt...',
      body: '<div class="admin-modal-loading">Lade Analyse...</div>',
      actions: [{ label: 'Schließen', className: 'ac-ghost', onClick: closeDrawer }],
    });
    try {
      const data = await adminRequest(`/admin/analyses/${analysisId}`);
      const item = data.item || {};
      const engineContent = jsonPretty(item.engine_breakdown);
      const resultContent = jsonPretty(item.result_payload);
      const body = `
        <div class="admin-drawer-section">
          <div class="admin-section-title">Analyse</div>
          <div class="admin-detail-grid">
            <div>
              <div class="admin-detail-label">Analyse ID</div>
              <div class="admin-detail-value">${escapeHtml(item.id || '--')}</div>
            </div>
            <div>
              <div class="admin-detail-label">Nutzer</div>
              <div class="admin-detail-value">${item.user_id ?? '--'}</div>
            </div>
            <div>
              <div class="admin-detail-label">Status</div>
              <div class="admin-detail-value">${analysisStatusBadge(item.status)}</div>
            </div>
            <div>
              <div class="admin-detail-label">Typ</div>
              <div class="admin-detail-value">${escapeHtml(item.media_type || '--')}</div>
            </div>
            <div>
              <div class="admin-detail-label">Score</div>
              <div class="admin-detail-value admin-score">${formatScore(item.final_score)}</div>
            </div>
            <div>
              <div class="admin-detail-label">Credits</div>
              <div class="admin-detail-value">${item.credits_charged ?? 0}</div>
            </div>
            <div>
              <div class="admin-detail-label">Ergebnis</div>
              <div class="admin-detail-value">${escapeHtml(item.verdict_label || '--')}</div>
            </div>
            <div>
              <div class="admin-detail-label">Erstellt</div>
              <div class="admin-detail-value">${formatDateTime(item.created_at)}</div>
            </div>
          </div>
        </div>
        <div class="admin-drawer-section">
          <div class="admin-section-title">Engine-Details</div>
          <pre class="admin-code">${escapeHtml(engineContent)}</pre>
        </div>
        <div class="admin-drawer-section">
          <details class="admin-details">
            <summary>Technische Details</summary>
            <pre class="admin-code">${escapeHtml(resultContent)}</pre>
          </details>
        </div>
      `;
      openDrawer({
        title: `Analyse ${item.id}`,
        subtitle: `Nutzer ${item.user_id ?? '--'}`,
        body,
        actions: [{ label: 'Schließen', className: 'ac-ghost', onClick: closeDrawer }],
      });
    } catch (err) {
      openDrawer({
        title: `Analyse ${analysisId}`,
        subtitle: 'Fehler',
        body: `<div class="admin-modal-alert" data-tone="error">${escapeHtml(resolveAdminError(err))}</div>`,
        actions: [{ label: 'Schließen', className: 'ac-ghost', onClick: closeDrawer }],
      });
    }
  }

  function openLogDetail(logId) {
    const log = state.logs.items.find((row) => String(row.id) === String(logId));
    if (!log) return;
    const metaContent = jsonPretty(log.meta);
    const body = `
      <div class="admin-drawer-section">
        <div class="admin-section-title">Log-Details</div>
        <div class="admin-detail-grid">
          <div>
            <div class="admin-detail-label">Zeit</div>
            <div class="admin-detail-value">${formatDateTime(log.ts)}</div>
          </div>
          <div>
            <div class="admin-detail-label">Level</div>
            <div class="admin-detail-value">${logLevelBadge(log.level)}</div>
          </div>
          <div>
            <div class="admin-detail-label">Event</div>
            <div class="admin-detail-value">${escapeHtml(log.event || '--')}</div>
          </div>
        </div>
      </div>
      <div class="admin-drawer-section">
        <div class="admin-section-title">Meta</div>
        <pre class="admin-code">${escapeHtml(metaContent)}</pre>
      </div>
    `;
    openDrawer({
      title: `Log ${log.id}`,
      subtitle: escapeHtml(log.event || ''),
      body,
      actions: [{ label: 'Schließen', className: 'ac-ghost', onClick: closeDrawer }],
    });
  }

  function openCreditsModal(user) {
    if (!user?.id) return;
    const creditsAvailable = Number(user.credits_available ?? Math.max(0, (user.credits_total || 0) - (user.credits_used || 0)));
    const body = `
      <div class="admin-modal-stack">
        <div class="admin-modal-context">Aktuell: ${user.credits_used ?? 0}/${user.credits_total ?? 0} (verfügbar ${creditsAvailable})</div>
        <label class="admin-field">
          <span>Modus</span>
          <select id="adminCreditsMode" class="ac-input">
            <option value="set_total">Gesamt setzen</option>
            <option value="add">Hinzufügen</option>
            <option value="subtract">Abziehen</option>
          </select>
        </label>
        <label class="admin-field">
          <span>Betrag</span>
          <input id="adminCreditsAmount" class="ac-input" type="number" min="0" value="0" />
        </label>
        <label class="admin-field">
          <span>Grund (optional)</span>
          <input id="adminCreditsReason" class="ac-input" type="text" placeholder="Admin-Notiz" />
        </label>
        <div id="adminCreditsAlert" class="admin-modal-alert" hidden></div>
      </div>
    `;
    openModal({
      title: `Credits anpassen: Nutzer ${user.id}`,
      body,
      actions: [
        { label: 'Abbrechen', className: 'ac-ghost', onClick: closeModal },
        {
          label: 'Speichern',
          className: 'ac-primary',
          onClick: async () => {
            const mode = $('#adminCreditsMode')?.value || 'set_total';
            const amountValue = parseInt($('#adminCreditsAmount')?.value || '0', 10);
            const reason = ($('#adminCreditsReason')?.value || '').trim();
            const alertBox = $('#adminCreditsAlert');
            if (!Number.isFinite(amountValue) || amountValue < 0) {
              if (alertBox) {
                alertBox.hidden = false;
                alertBox.textContent = 'Bitte eine gültige Zahl eingeben.';
                alertBox.dataset.tone = 'error';
              }
              return;
            }
            try {
              await adminRequest(`/admin/users/${user.id}/credits`, {
                method: 'POST',
                body: { mode, amount: amountValue, reason },
              });
              closeModal();
              await loadUsers();
              if (state.activeView === 'dashboard') await loadStats();
              if (state.activeView === 'credits') await loadCredits();
            } catch (err) {
              if (alertBox) {
                alertBox.hidden = false;
                alertBox.textContent = resolveAdminError(err);
                alertBox.dataset.tone = 'error';
              }
            }
          },
        },
      ],
    });
  }

  function openBanModal(user) {
    if (!user?.id) return;
    const body = `
      <div class="admin-modal-stack">
        <div class="admin-modal-context">Status: ${user.is_banned ? 'Gesperrt' : 'Aktiv'}</div>
        <label class="admin-field admin-field-inline">
          <input id="adminBanToggle" type="checkbox" ${user.is_banned ? 'checked' : ''} />
          <span>Nutzer sperren</span>
        </label>
        <label class="admin-field">
          <span>Grund (optional)</span>
          <input id="adminBanReason" class="ac-input" type="text" placeholder="Admin-Notiz" />
        </label>
        <div id="adminBanAlert" class="admin-modal-alert" hidden></div>
      </div>
    `;
    openModal({
      title: `Nutzerstatus: ${user.id}`,
      body,
      actions: [
        { label: 'Abbrechen', className: 'ac-ghost', onClick: closeModal },
        {
          label: 'Speichern',
          className: 'ac-primary',
          onClick: async () => {
            const banned = !!$('#adminBanToggle')?.checked;
            const reason = ($('#adminBanReason')?.value || '').trim();
            const alertBox = $('#adminBanAlert');
            try {
              await adminRequest(`/admin/users/${user.id}/ban`, {
                method: 'POST',
                body: { banned, reason },
              });
              closeModal();
              await loadUsers();
              if (state.activeView === 'moderation') await loadModeration();
            } catch (err) {
              if (alertBox) {
                alertBox.hidden = false;
                alertBox.textContent = resolveAdminError(err);
                alertBox.dataset.tone = 'error';
              }
            }
          },
        },
      ],
    });
  }

  function loadActiveView() {
    if (state.activeView === 'dashboard') loadStats();
    if (state.activeView === 'users') loadUsers();
    if (state.activeView === 'analyses') loadAnalyses();
    if (state.activeView === 'logs') loadLogs();
    if (state.activeView === 'credits') loadCredits();
    if (state.activeView === 'engines') loadEnginesOverview();
    if (state.activeView === 'moderation') loadModeration();
    if (state.activeView === 'system') loadSystem();
  }

  function bindEvents() {
    navItems.forEach((btn) => {
      btn.addEventListener('click', () => setView(btn.dataset.adminView));
    });
    globalRefresh?.addEventListener('click', () => loadActiveView());
    sidebarRefresh?.addEventListener('click', () => loadActiveView());

    const syncUserSegment = () => {
      let active = 'all';
      if (state.users.sort === 'top') active = 'top';
      else if (state.users.status === 'banned') active = 'banned';
      setSegmentActive(userSegments, active, 'userSegment');
    };
    const syncAnalysesSegment = () => {
      const active = (analysesStatusInput?.value || '') === 'failed' ? 'failed' : 'all';
      setSegmentActive(analysesSegments, active, 'analysesSegment');
    };
    const syncLogsSegment = () => {
      const level = (logsLevelInput?.value || '').trim().toLowerCase();
      const event = (logsEventInput?.value || '').trim().toUpperCase();
      let active = 'all';
      if (level === 'error') active = 'error';
      else if (event.startsWith('ADMIN_')) active = 'admin';
      else if (event.startsWith('SYSTEM_')) active = 'system';
      setSegmentActive(logsSegments, active, 'logsSegment');
    };

    const applyUserFilters = () => {
      state.users.query = (userSearchInput?.value || '').trim();
      state.users.role = (userRoleSelect?.value || '').trim();
      state.users.status = (userStatusSelect?.value || '').trim();
      state.users.verified = (userVerifiedSelect?.value || '').trim();
      state.users.offset = 0;
      syncUserSegment();
      loadUsers();
    };
    const resetUserFilters = () => {
      if (userSearchInput) userSearchInput.value = '';
      if (userRoleSelect) userRoleSelect.value = '';
      if (userStatusSelect) userStatusSelect.value = '';
      if (userVerifiedSelect) userVerifiedSelect.value = '';
      state.users.query = '';
      state.users.role = '';
      state.users.status = '';
      state.users.verified = '';
      state.users.sort = '';
      state.users.offset = 0;
      syncUserSegment();
      loadUsers();
    };

    userSearchBtn?.addEventListener('click', applyUserFilters);
    userResetBtn?.addEventListener('click', resetUserFilters);
    usersRefreshBtn?.addEventListener('click', () => loadUsers());
    userSegments.forEach((btn) => {
      btn.addEventListener('click', () => {
        const segment = btn.dataset.userSegment;
        if (segment === 'banned') {
          if (userSearchInput) userSearchInput.value = '';
          if (userRoleSelect) userRoleSelect.value = '';
          if (userVerifiedSelect) userVerifiedSelect.value = '';
          if (userStatusSelect) userStatusSelect.value = 'banned';
          state.users.query = '';
          state.users.role = '';
          state.users.status = 'banned';
          state.users.verified = '';
          state.users.sort = '';
        } else if (segment === 'top') {
          if (userSearchInput) userSearchInput.value = '';
          if (userRoleSelect) userRoleSelect.value = '';
          if (userStatusSelect) userStatusSelect.value = '';
          if (userVerifiedSelect) userVerifiedSelect.value = '';
          state.users.query = '';
          state.users.role = '';
          state.users.status = '';
          state.users.verified = '';
          state.users.sort = 'top';
        } else {
          if (userSearchInput) userSearchInput.value = '';
          if (userRoleSelect) userRoleSelect.value = '';
          if (userStatusSelect) userStatusSelect.value = '';
          if (userVerifiedSelect) userVerifiedSelect.value = '';
          state.users.query = '';
          state.users.role = '';
          state.users.status = '';
          state.users.verified = '';
          state.users.sort = '';
        }
        state.users.offset = 0;
        syncUserSegment();
        loadUsers();
      });
    });
    userSearchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyUserFilters();
      }
    });
    usersPrev?.addEventListener('click', () => {
      state.users.offset = Math.max(0, state.users.offset - state.users.limit);
      loadUsers();
    });
    usersNext?.addEventListener('click', () => {
      if (!state.users.hasMore) return;
      state.users.offset += state.users.limit;
      loadUsers();
    });

    usersBody?.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-user-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.userAction;
        const userId = parseInt(actionBtn.dataset.userId || '0', 10);
        const user = state.users.items.find((u) => u.id === userId) || { id: userId };
        closeAllMenus();
        if (action === 'detail') openUserDetail(userId);
        if (action === 'credits') openCreditsModal(user);
        if (action === 'ban') openBanModal(user);
        if (action === 'reset') openResetPasswordModal(user);
        return;
      }
      const trigger = e.target.closest('[data-menu-trigger="user"]');
      if (trigger) {
        e.preventDefault();
        const menuId = trigger.dataset.menuId;
        const menu = document.querySelector(`.admin-action-menu[data-menu="user"][data-menu-id="${menuId}"]`);
        if (!menu) return;
        const isOpen = menu.classList.contains('is-open');
        closeAllMenus();
        if (!isOpen) menu.classList.add('is-open');
      }
    });

    analysesApplyBtn?.addEventListener('click', () => {
      state.analyses.offset = 0;
      syncAnalysesSegment();
      loadAnalyses();
    });
    analysesResetBtn?.addEventListener('click', () => {
      if (analysesUserInput) analysesUserInput.value = '';
      if (analysesStatusInput) analysesStatusInput.value = '';
      if (analysesTypeInput) analysesTypeInput.value = '';
      if (analysesScoreMin) analysesScoreMin.value = '';
      if (analysesScoreMax) analysesScoreMax.value = '';
      if (analysesFrom) analysesFrom.value = '';
      if (analysesTo) analysesTo.value = '';
      if (analysesEngine) analysesEngine.value = '';
      state.analyses.offset = 0;
      syncAnalysesSegment();
      loadAnalyses();
    });
    analysesRefreshBtn?.addEventListener('click', () => loadAnalyses());
    analysesSegments.forEach((btn) => {
      btn.addEventListener('click', () => {
        const segment = btn.dataset.analysesSegment;
        if (segment === 'failed') {
          if (analysesStatusInput) analysesStatusInput.value = 'failed';
        } else {
          if (analysesStatusInput) analysesStatusInput.value = '';
        }
        state.analyses.offset = 0;
        syncAnalysesSegment();
        loadAnalyses();
      });
    });
    analysesPrev?.addEventListener('click', () => {
      state.analyses.offset = Math.max(0, state.analyses.offset - state.analyses.limit);
      loadAnalyses();
    });
    analysesNext?.addEventListener('click', () => {
      if (!state.analyses.hasMore) return;
      state.analyses.offset += state.analyses.limit;
      loadAnalyses();
    });

    analysesBody?.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-analysis-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.analysisAction;
        const analysisId = actionBtn.dataset.analysisId;
        closeAllMenus();
        if (action === 'detail') openAnalysisDetail(analysisId);
        return;
      }
      const trigger = e.target.closest('[data-menu-trigger="analysis"]');
      if (trigger) {
        e.preventDefault();
        const menuId = trigger.dataset.menuId;
        const menu = document.querySelector(`.admin-action-menu[data-menu="analysis"][data-menu-id="${menuId}"]`);
        if (!menu) return;
        const isOpen = menu.classList.contains('is-open');
        closeAllMenus();
        if (!isOpen) menu.classList.add('is-open');
      }
    });

    logsApplyBtn?.addEventListener('click', () => {
      state.logs.offset = 0;
      syncLogsSegment();
      loadLogs();
    });
    logsResetBtn?.addEventListener('click', () => {
      if (logsLevelInput) logsLevelInput.value = '';
      if (logsEventInput) logsEventInput.value = '';
      if (logsQueryInput) logsQueryInput.value = '';
      if (logsFrom) logsFrom.value = '';
      if (logsTo) logsTo.value = '';
      state.logs.offset = 0;
      syncLogsSegment();
      loadLogs();
    });
    logsRefreshBtn?.addEventListener('click', () => loadLogs());
    logsSegments.forEach((btn) => {
      btn.addEventListener('click', () => {
        const segment = btn.dataset.logsSegment;
        if (segment === 'admin') {
          if (logsEventInput) logsEventInput.value = 'ADMIN_';
          if (logsLevelInput) logsLevelInput.value = '';
        } else if (segment === 'error') {
          if (logsLevelInput) logsLevelInput.value = 'error';
          if (logsEventInput) logsEventInput.value = '';
        } else if (segment === 'system') {
          if (logsEventInput) logsEventInput.value = 'SYSTEM_';
          if (logsLevelInput) logsLevelInput.value = '';
        } else {
          if (logsLevelInput) logsLevelInput.value = '';
          if (logsEventInput) logsEventInput.value = '';
          if (logsQueryInput) logsQueryInput.value = '';
        }
        state.logs.offset = 0;
        syncLogsSegment();
        loadLogs();
      });
    });
    logsPrev?.addEventListener('click', () => {
      state.logs.offset = Math.max(0, state.logs.offset - state.logs.limit);
      loadLogs();
    });
    logsNext?.addEventListener('click', () => {
      if (!state.logs.hasMore) return;
      state.logs.offset += state.logs.limit;
      loadLogs();
    });

    logsBody?.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-log-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.logAction;
        const logId = actionBtn.dataset.logId;
        closeAllMenus();
        if (action === 'detail') openLogDetail(logId);
        return;
      }
      const trigger = e.target.closest('[data-menu-trigger="log"]');
      if (trigger) {
        e.preventDefault();
        const menuId = trigger.dataset.menuId;
        const menu = document.querySelector(`.admin-action-menu[data-menu="log"][data-menu-id="${menuId}"]`);
        if (!menu) return;
        const isOpen = menu.classList.contains('is-open');
        closeAllMenus();
        if (!isOpen) menu.classList.add('is-open');
      }
    });

    creditsApplyBtn?.addEventListener('click', () => {
      state.credits.userId = (creditsUserInput?.value || '').trim();
      state.credits.kind = (creditsKindInput?.value || '').trim();
      state.credits.query = (creditsQueryInput?.value || '').trim();
      state.credits.from = (creditsFromInput?.value || '').trim();
      state.credits.to = (creditsToInput?.value || '').trim();
      state.credits.offset = 0;
      loadCredits();
    });
    creditsResetBtn?.addEventListener('click', () => {
      if (creditsUserInput) creditsUserInput.value = '';
      if (creditsKindInput) creditsKindInput.value = '';
      if (creditsQueryInput) creditsQueryInput.value = '';
      if (creditsFromInput) creditsFromInput.value = '';
      if (creditsToInput) creditsToInput.value = '';
      state.credits.userId = '';
      state.credits.kind = '';
      state.credits.query = '';
      state.credits.from = '';
      state.credits.to = '';
      state.credits.offset = 0;
      loadCredits();
    });
    creditsRefreshBtn?.addEventListener('click', () => loadCredits());
    creditsPrev?.addEventListener('click', () => {
      state.credits.offset = Math.max(0, state.credits.offset - state.credits.limit);
      loadCredits();
    });
    creditsNext?.addEventListener('click', () => {
      if (!state.credits.hasMore) return;
      state.credits.offset += state.credits.limit;
      loadCredits();
    });

    enginesRefreshBtn?.addEventListener('click', () => loadEnginesOverview());

    moderationRefreshBtn?.addEventListener('click', () => loadModeration());
    moderationPrev?.addEventListener('click', () => {
      state.moderation.offset = Math.max(0, state.moderation.offset - state.moderation.limit);
      loadModeration();
    });
    moderationNext?.addEventListener('click', () => {
      if (!state.moderation.hasMore) return;
      state.moderation.offset += state.moderation.limit;
      loadModeration();
    });
    moderationUsersBody?.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-user-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.userAction;
        const userId = parseInt(actionBtn.dataset.userId || '0', 10);
        const user = state.moderation.items.find((u) => u.id === userId) || { id: userId };
        closeAllMenus();
        if (action === 'detail') openUserDetail(userId);
        if (action === 'ban') openBanModal(user);
        return;
      }
      const trigger = e.target.closest('[data-menu-trigger="moderation"]');
      if (trigger) {
        e.preventDefault();
        const menuId = trigger.dataset.menuId;
        const menu = document.querySelector(`.admin-action-menu[data-menu="moderation"][data-menu-id="${menuId}"]`);
        if (!menu) return;
        const isOpen = menu.classList.contains('is-open');
        closeAllMenus();
        if (!isOpen) menu.classList.add('is-open');
      }
    });

    systemRefreshBtn?.addEventListener('click', () => loadSystem());

    modalClose?.addEventListener('click', () => closeModal());
    modalBackdrop?.addEventListener('click', () => closeModal());
    drawerClose?.addEventListener('click', () => closeDrawer());
    drawerBackdrop?.addEventListener('click', () => closeDrawer());

    document.addEventListener('click', (e) => {
      if (e.target.closest('.admin-action')) return;
      closeAllMenus();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        closeDrawer();
        closeAllMenus();
      }
    });

    syncUserSegment();
    syncAnalysesSegment();
    syncLogsSegment();
  }

  function openResetPasswordModal(user) {
    if (!user?.id) return;
    const body = `
      <div class="admin-modal-stack">
        <div class="admin-modal-context">Nutzer ${user.id}${user.email ? ` · ${escapeHtml(user.email)}` : ''}</div>
        <label class="admin-field">
          <span>Neues Passwort</span>
          <input id="adminResetPasswordInput" class="ac-input" type="password" placeholder="Mindestens 8 Zeichen" />
        </label>
        <div id="adminResetAlert" class="admin-modal-alert" hidden></div>
      </div>
    `;
    openModal({
      title: 'Passwort zurücksetzen',
      body,
      actions: [
        { label: 'Abbrechen', className: 'ac-ghost', onClick: closeModal },
        {
          label: 'Speichern',
          className: 'ac-primary',
          onClick: async () => {
            const nextPassword = ($('#adminResetPasswordInput')?.value || '').trim();
            const alertBox = $('#adminResetAlert');
            if (nextPassword.length < 8) {
              if (alertBox) {
                alertBox.hidden = false;
                alertBox.textContent = 'Das Passwort muss mindestens 8 Zeichen haben.';
                alertBox.dataset.tone = 'error';
              }
              return;
            }
            try {
              await adminRequest(`/admin/users/${user.id}/reset_password`, {
                method: 'POST',
                body: { new_password: nextPassword },
              });
              closeModal();
              setNotice('Passwort wurde zurückgesetzt.', 'info');
            } catch (err) {
              if (alertBox) {
                alertBox.hidden = false;
                alertBox.textContent = resolveAdminError(err);
                alertBox.dataset.tone = 'error';
              }
            }
          },
        },
      ],
    });
  }

  function updateIdentity() {
    if (adminIdentity) {
      adminIdentity.textContent = auth?.user?.email || 'Admin';
    }
    if (envBadge) {
      envBadge.textContent = auth?.isAdmin?.() ? 'Admin' : 'Intern';
    }
  }

  function openAdminPanel() {
    if (!auth.requireSession()) return;
    if (!auth.isAdmin()) {
      window.alert('Adminrechte erforderlich.');
      return;
    }
    showPage('admin');
    setView(state.activeView || 'dashboard', true);
  }

  function bootstrap() {
    bindEvents();
    setNotice('');
    updateIdentity();
    auth.subscribe(() => {
      updateIdentity();
      if (!auth.isAdmin()) {
        setNotice('Kein Zugriff.', 'error');
      } else {
        setNotice('');
      }
    });
  }

  bootstrap();

  return {
    openAdminPanel,
  };
}
