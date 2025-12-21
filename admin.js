import { showPage } from './ui.js';

const $ = (sel) => document.querySelector(sel);
const DEFAULT_API_BASE = 'http://127.0.0.1:5001';

export function initAdminPanel(auth, apiBaseInput) {
  const apiBase = (apiBaseInput || DEFAULT_API_BASE).replace(/\/+$/, '') || DEFAULT_API_BASE;
  const listEl = $('#adminUserList');
  const detailEmail = $('#adminDetailEmail');
  const detailMeta = $('#adminDetailMeta');
  const detailBadges = $('#adminDetailBadges');
  const detailBox = $('#adminUserDetail');
  const statusBox = $('#adminStatus');
  const alertBox = $('#adminUserAlert');
  const refreshBtn = $('#adminRefresh');
  const pwForm = $('#adminPasswordForm');
  const pwInput = $('#adminNewPassword');
  const creditsForm = $('#adminCreditsForm');
  const creditsInput = $('#adminCreditsInput');
  const planForm = $('#adminPlanForm');
  const planSelect = $('#adminPlanSelect');
  const profileAdminBtn = $('#profileAdmin');
  const sideAdminBtn = $('#sideAdmin');

  const state = {
    users: [],
    selectedId: null,
    selectedUser: null,
    loading: false,
  };

  function setStatus(msg, tone = 'info') {
    if (!statusBox) return;
    if (!msg) {
      statusBox.hidden = true;
      statusBox.textContent = '';
      statusBox.dataset.tone = 'info';
    } else {
      statusBox.hidden = false;
      statusBox.textContent = msg;
      statusBox.dataset.tone = tone;
    }
  }

  function setAlert(msg, tone = 'info') {
    if (!alertBox) return;
    if (!msg) {
      alertBox.hidden = true;
      alertBox.textContent = '';
      alertBox.dataset.tone = 'info';
    } else {
      alertBox.hidden = false;
      alertBox.textContent = msg;
      alertBox.dataset.tone = tone;
    }
  }

  function badgeMarkup(user) {
    const pills = [];
    if (user.is_admin) pills.push('<span class="admin-pill admin-pill-accent">Admin</span>');
    if (user.is_premium) pills.push('<span class="admin-pill">Premium</span>');
    else pills.push('<span class="admin-pill admin-pill-muted">Free</span>');
    return pills.join('');
  }

  function renderList() {
    if (!listEl) return;
    if (!auth.isAdmin()) {
      listEl.innerHTML = '<div class="ac-subtle">Keine Adminrechte.</div>';
      return;
    }
    if (!state.users.length) {
      listEl.innerHTML = '<div class="ac-subtle">Keine Nutzer gefunden.</div>';
      return;
    }
    listEl.innerHTML = state.users
      .map((u) => `
        <button class="admin-user-row${state.selectedId === u.id ? ' is-active' : ''}" data-user-id="${u.id}">
          <div class="admin-user-main">
            <div class="admin-user-email">${u.email}</div>
            <div class="admin-user-meta">ID ${u.id} • ${u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</div>
          </div>
          <div class="admin-user-tags">${badgeMarkup(u)}</div>
        </button>`)
      .join('');
  }

  function fillDetail(user) {
    if (!detailBox || !detailEmail || !detailMeta || !detailBadges) return;
    if (!user) {
      detailEmail.textContent = 'Kein Nutzer ausgewaehlt';
      detailMeta.textContent = 'Bitte einen Nutzer in der Liste waehlen.';
      detailBadges.innerHTML = '';
      [pwInput, creditsInput, planSelect].forEach((el) => el && (el.disabled = true));
      if (pwInput) pwInput.value = '';
      if (creditsInput) creditsInput.value = '';
      if (planSelect) planSelect.value = 'free';
      setAlert('');
      return;
    }
    detailEmail.textContent = user.email;
    const created = user.created_at ? new Date(user.created_at).toLocaleString() : '-';
    detailMeta.textContent = `ID ${user.id} • Credits: ${user.credits} • Erstellt: ${created}`;
    detailBadges.innerHTML = badgeMarkup(user);
    if (creditsInput) creditsInput.value = user.credits ?? 0;
    if (planSelect) planSelect.value = user.is_premium ? 'premium' : 'free';
    [pwInput, creditsInput, planSelect].forEach((el) => el && (el.disabled = false));
    setAlert('');
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
      throw new Error('auth_required');
    }
    if (resp.status === 403) {
      throw new Error('forbidden');
    }
    if (!resp.ok) {
      const error = new Error((data && data.error) || 'request_failed');
      error.status = resp.status;
      error.response = data;
      throw error;
    }
    return data;
  }

  async function loadUsers() {
    if (!auth.isAdmin()) return;
    setStatus('Lade Nutzer...', 'info');
    try {
      const data = await adminRequest('/admin/users');
      state.users = Array.isArray(data.users) ? data.users : [];
      if (state.selectedId) {
        const match = state.users.find((u) => u.id === state.selectedId);
        if (match) {
          state.selectedUser = Object.assign({}, state.selectedUser || {}, match);
          fillDetail(state.selectedUser);
        } else {
          state.selectedId = null;
          state.selectedUser = null;
          fillDetail(null);
        }
      }
      renderList();
      setStatus('');
    } catch (err) {
      setStatus('Konnte Nutzer nicht laden.', 'error');
    }
  }

  async function selectUser(userId) {
    state.selectedId = userId;
    const cached = state.users.find((u) => u.id === userId);
    if (cached) {
      state.selectedUser = cached;
      fillDetail(cached);
      renderList();
    }
    try {
      const data = await adminRequest(`/admin/users/${userId}`);
      if (data?.user) {
        state.selectedUser = data.user;
        fillDetail(data.user);
        renderList();
      }
    } catch (err) {
      setAlert('Nutzer konnte nicht geladen werden.', 'error');
    }
  }

  async function handlePasswordReset(e) {
    e.preventDefault();
    if (!state.selectedUser) return;
    const newPassword = (pwInput?.value || '').trim();
    if (!newPassword || newPassword.length < 8) {
      setAlert('Passwort muss mindestens 8 Zeichen haben.', 'error');
      return;
    }
    try {
      await adminRequest(`/admin/users/${state.selectedUser.id}/reset_password`, {
        method: 'POST',
        body: { new_password: newPassword },
      });
      setAlert('Passwort gesetzt.', 'success');
      if (pwInput) pwInput.value = '';
    } catch (err) {
      setAlert('Passwort konnte nicht gesetzt werden.', 'error');
    }
  }

  async function handleCreditsUpdate(e) {
    e.preventDefault();
    if (!state.selectedUser) return;
    const credits = parseInt(creditsInput?.value, 10);
    if (Number.isNaN(credits)) {
      setAlert('Bitte eine gueltige Zahl eintragen.', 'error');
      return;
    }
    try {
      const data = await adminRequest(`/admin/users/${state.selectedUser.id}/update_credits`, {
        method: 'POST',
        body: { credits },
      });
      state.selectedUser.credits = data.credits;
      const listUser = state.users.find((u) => u.id === state.selectedUser.id);
      if (listUser) listUser.credits = data.credits;
      fillDetail(state.selectedUser);
      renderList();
      setAlert('Credits aktualisiert.', 'success');
    } catch (err) {
      setAlert('Credits konnten nicht aktualisiert werden.', 'error');
    }
  }

  async function handlePlanUpdate(e) {
    e.preventDefault();
    if (!state.selectedUser) return;
    const plan = planSelect?.value || 'free';
    try {
      const data = await adminRequest(`/admin/users/${state.selectedUser.id}/set_plan`, {
        method: 'POST',
        body: { plan },
      });
      state.selectedUser.is_premium = !!data.is_premium;
      const listUser = state.users.find((u) => u.id === state.selectedUser.id);
      if (listUser) listUser.is_premium = !!data.is_premium;
      fillDetail(state.selectedUser);
      renderList();
      setAlert('Plan gespeichert.', 'success');
    } catch (err) {
      setAlert('Plan konnte nicht gespeichert werden.', 'error');
    }
  }

  function bindEvents() {
    listEl?.addEventListener('click', (e) => {
      const row = e.target.closest('[data-user-id]');
      if (!row) return;
      const id = parseInt(row.dataset.userId, 10);
      if (!Number.isFinite(id)) return;
      selectUser(id);
    });
    refreshBtn?.addEventListener('click', () => loadUsers());
    pwForm?.addEventListener('submit', handlePasswordReset);
    creditsForm?.addEventListener('submit', handleCreditsUpdate);
    planForm?.addEventListener('submit', handlePlanUpdate);
  }

  function setAdminVisibility() {
    const isAdmin = auth.isAdmin();
    if (sideAdminBtn) sideAdminBtn.hidden = !isAdmin;
    if (profileAdminBtn) profileAdminBtn.hidden = !isAdmin;
    if (!isAdmin) {
      state.users = [];
      state.selectedId = null;
      state.selectedUser = null;
      renderList();
      fillDetail(null);
    }
  }

  function openAdminPanel() {
    if (!auth.requireSession()) return;
    if (!auth.isAdmin()) {
      window.alert('Adminrechte erforderlich.');
      return;
    }
    showPage('admin');
    if (!state.users.length) {
      loadUsers();
    } else {
      renderList();
      fillDetail(state.selectedUser);
    }
  }

  function bootstrap() {
    bindEvents();
    setAdminVisibility();
    auth.subscribe(() => {
      setAdminVisibility();
    });
    fillDetail(null);
    setStatus('');
  }

  bootstrap();

  return {
    openAdminPanel,
  };
}
