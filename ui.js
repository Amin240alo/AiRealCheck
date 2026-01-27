const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const pages = {
  start: $('#page-start'),
  history: $('#page-history'),
  details: $('#page-details'),
  profile: $('#page-profile'),
  settings: $('#page-settings'),
  premium: $('#page-premium'),
  affiliate: $('#page-affiliate'),
  rate: $('#page-rate'),
  legal: $('#page-legal'),
  admin: $('#page-admin'),
};

const creditsLabel = $('#creditsText');
const profileAvatar = $('#profileAvatar');
const profileGuestCard = $('#profileGuestCard');
const profileDataCard = $('#profileDataCard');
const profileEmail = $('#profileEmail');
const profilePlan = $('#profilePlan');
const profileCredits = $('#profileCredits');
const profileReset = $('#profileReset');
const profilePremium = $('#profilePremium');
const profileCreated = $('#profileCreated');
const profileBadge = $('#profileBadge');
const profileDropdown = $('#profileDropdown');
const profileHistoryBtn = $('#profileHistory');
const profileLogoutBtn = $('#profileLogout');
const profileGuestAction = $('#profileGuestAction');
const profileTrigger = $('#profileTrigger');
const profileAdminBtn = $('#profileAdmin');
const sidebar = $('#sidebar');
const sidebarOverlay = $('#overlay');
const hamburger = $('#hamburger');
const navStart = $('#navStart');
const navHistory = $('#navHistory');
const sideAdmin = $('#sideAdmin');
const brandHome = $('#brandHome');
const menuList = $('#menuList');

let currentAnalyzing = false;
let expertToggleBound = false;

export function showPage(name) {
  Object.values(pages).forEach((p) => p && p.classList.add('ac-hide'));
  const target = pages[name] || pages.start;
  if (target) target.classList.remove('ac-hide');
  navStart?.classList.toggle('ac-active', name === 'start');
  navHistory?.classList.toggle('ac-active', name === 'history');
}

const getGuestCredits = (auth) =>
  (typeof auth?.getGuestCredits === 'function' ? auth.getGuestCredits() : null);
const ANALYSIS_COSTS = { image: 10, video: 15, audio: 20 };
const getAnalysisCost = (kind = 'image') => ANALYSIS_COSTS[kind] || 10;

function clampPercent(value) {
  const v = Number(value);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function verdictFromAi(aiLikelihood) {
  const ai = clampPercent(aiLikelihood);
  if (ai <= 30) {
    return { verdict: 'likely_real', traffic: 'green', label: 'Ueberwiegend echt' };
  }
  if (ai <= 69) {
    return { verdict: 'uncertain', traffic: 'yellow', label: 'Unsicher' };
  }
  return { verdict: 'likely_ai', traffic: 'red', label: 'Ueberwiegend KI' };
}

function computeConflict(engineResults) {
  const values = (engineResults || [])
    .filter((e) => e && e.available)
    .map((e) => Number(e.ai_likelihood))
    .filter((v) => Number.isFinite(v));
  if (values.length < 2) return false;
  return (Math.max(...values) - Math.min(...values)) >= 40;
}

function normalizeResult(data) {
  const aiLikelihood = (typeof data?.ai_likelihood === 'number')
    ? data.ai_likelihood
    : (typeof data?.fake === 'number' ? data.fake : 0);
  const realLikelihood = (typeof data?.real_likelihood === 'number')
    ? data.real_likelihood
    : (typeof data?.real === 'number' ? data.real : (100 - aiLikelihood));

  const verdictInfo = data?.verdict && data?.traffic_light && data?.label_de
    ? { verdict: data.verdict, traffic: data.traffic_light, label: data.label_de }
    : verdictFromAi(aiLikelihood);

  const engineResults = Array.isArray(data?.engine_results) ? data.engine_results : [];
  const conflict = typeof data?.conflict === 'boolean' ? data.conflict : computeConflict(engineResults);
  const reasons = Array.isArray(data?.reasons) ? data.reasons : [];

  return {
    ai_likelihood: clampPercent(aiLikelihood),
    real_likelihood: clampPercent(realLikelihood),
    verdict: verdictInfo.verdict,
    traffic_light: verdictInfo.traffic,
    label_de: verdictInfo.label,
    conflict,
    reasons,
    confidence: typeof data?.confidence === 'number' ? data.confidence : null,
    engine_results: engineResults,
  };
}

export function renderAnalysisResult(resultJson, { expertMode = false } = {}) {
  const r = normalizeResult(resultJson || {});
  const showAi = r.verdict === 'likely_ai' || (r.verdict === 'uncertain' && r.ai_likelihood >= 50);
  const headlinePercent = showAi ? r.ai_likelihood : r.real_likelihood;
  const headlineText = showAi ? 'wahrscheinlich KI' : 'wahrscheinlich echt';
  const badgeClass = r.traffic_light === 'green'
    ? 'badge-green'
    : (r.traffic_light === 'red' ? 'badge-red' : 'badge-yellow');

  const reasonsList = (r.reasons && r.reasons.length)
    ? r.reasons.slice(0, 3).map((reason) => `<li>${String(reason)}</li>`).join('')
    : '<li>Keine weiteren Hinweise.</li>';

  const conflictHtml = r.conflict
    ? `
      <div class="ac-conflict">
        <div class="ac-conflict-title">Modelle uneinig</div>
        <div class="ac-conflict-sub">Empfehlung: zweiten Check machen.</div>
      </div>
    `
    : '';

  const enginesHtml = (r.engine_results || []).map((engine) => {
    const name = String(engine?.engine || 'engine');
    const available = engine?.available !== false;
    const score = available ? `${clampPercent(engine?.ai_likelihood)}% KI` : 'nicht verfuegbar';
    const notes = String(engine?.notes || '');
    const signals = Array.isArray(engine?.signals) ? engine.signals : [];
    const signalsHtml = signals.length
      ? `<ul class="ac-engine-signals">${signals.map((s) => `<li>${String(s)}</li>`).join('')}</ul>`
      : '<div class="ac-engine-notes ac-subtle">Keine Signale.</div>';
    const confText = typeof engine?.confidence === 'number'
      ? `Sicherheit: ${Math.round(engine.confidence * 100)}%`
      : '';
    return `
      <div class="ac-engine-item">
        <div class="ac-engine-head">
          <div class="ac-engine-name">${name}</div>
          <div class="ac-engine-score">${score}</div>
        </div>
        ${confText ? `<div class="ac-engine-meta">${confText}</div>` : ''}
        ${notes ? `<div class="ac-engine-notes">${notes}</div>` : ''}
        ${signalsHtml}
      </div>
    `;
  }).join('');

  return `
    <div class="ac-card ac-result-card" role="status" aria-live="polite">
      <div class="ac-result-hero">
        <div class="ac-result-percent">${headlinePercent}%</div>
        <div class="ac-result-headline">${headlineText}</div>
      </div>
      <div class="ac-result-row">
        <span class="ac-traffic-badge ${badgeClass}">${r.label_de}</span>
        <span class="ac-result-sub">Status</span>
      </div>
      ${conflictHtml}
      <div class="ac-result-reasons">
        <div class="ac-subtle"><b>Warum?</b></div>
        <ul class="ac-compare-list">${reasonsList}</ul>
      </div>
      <button id="resultDetailsToggle" class="ac-secondary ac-details-btn" type="button">Details anzeigen</button>
      <div id="resultDetails" class="ac-result-details" style="display:none">
        <div class="ac-subtle"><b>Modelle &amp; Signale</b></div>
        <div class="ac-engine-list">${enginesHtml || '<div class="ac-subtle">Keine Engines verfuegbar.</div>'}</div>
      </div>
    </div>
  `;
}

export function updateCreditsUI(auth) {
  if (!creditsLabel) return;
  if (!auth || !auth.token) {
    const guest = getGuestCredits(auth);
    creditsLabel.textContent = typeof guest === 'number' ? `${guest} Credits` : '\u2014';
    return;
  }
  if (auth.isPremium()) {
    creditsLabel.textContent = 'Premium';
    return;
  }
  if (auth.balance && typeof auth.balance.credits === 'number') {
    creditsLabel.textContent = `${auth.balance.credits} Credits`;
  } else {
    creditsLabel.textContent = '...';
  }
}

export function updateAnalyzeButtons(auth, isAnalyzing = currentAnalyzing) {
  currentAnalyzing = !!isAnalyzing;
  const buttons = $$('.ac-primary[data-kind]');
  buttons.forEach((btn) => {
    const kind = btn.dataset.kind || 'image';
    const cost = getAnalysisCost(kind);
    const guestCredits = getGuestCredits(auth) ?? 0;
    const hasToken = !!auth?.token;
    const balanceCredits = typeof auth?.balance?.credits === 'number'
      ? auth.balance.credits
      : (typeof auth?.user?.credits === 'number' ? auth.user.credits : null);
    const hasUserCredits = auth?.isPremium()
      ? true
      : (typeof balanceCredits === 'number' ? balanceCredits >= cost : false);
    const hasGuestCredits = guestCredits >= cost;
    const hasCredits = hasToken ? hasUserCredits : hasGuestCredits;
    let tooltip = '';
    if (!hasCredits) {
      tooltip = hasToken ? 'Nicht genug Credits.' : 'Keine Credits mehr - bitte registrieren oder einloggen.';
    }
    if (currentAnalyzing) tooltip = 'Analyse laeuft...';
    if (currentAnalyzing) {
      btn.setAttribute('disabled', 'disabled');
      btn.classList.add('ac-btn-disabled');
    } else {
      btn.removeAttribute('disabled');
      btn.classList.remove('ac-btn-disabled');
    }
    if (tooltip) {
      btn.classList.add('has-tooltip');
      btn.setAttribute('data-tooltip', tooltip);
    } else {
      btn.classList.remove('has-tooltip');
      btn.removeAttribute('data-tooltip');
    }
    btn.dataset.state = hasCredits ? 'ready' : 'no-credits';
  });
}

export function updateProfileView(auth) {
  const isLoggedIn = auth?.isLoggedIn?.() === true;
  const email = auth?.user?.email ?? null;

  if (profileAvatar) {
    if (isLoggedIn && email) {
      profileTrigger?.classList.remove('login-mode');
      profileAvatar.textContent = email.charAt(0).toUpperCase();
    } else {
      profileTrigger?.classList.add('login-mode');
      profileAvatar.textContent = 'Login';
    }
    profileTrigger?.setAttribute('aria-expanded', 'false');
  }

  if (!profileGuestCard || !profileDataCard) return;

  if (!isLoggedIn) {
    profileGuestCard.hidden = false;
    profileDataCard.hidden = true;
    closeProfileDropdown();
    return;
  }

  // Wenn eingeloggt:
  profileGuestCard.hidden = true;
  profileDataCard.hidden = false;

  profileEmail.textContent = email ?? '-';
  profilePlan.textContent = auth.isPremium() ? 'Premium' : 'Free';

  if (profileBadge) {
    profileBadge.textContent = (email ?? 'A').charAt(0).toUpperCase();
  }

  const creditsValue = auth.isPremium()
    ? '∞'
    : (
        (typeof auth?.balance?.credits === 'number')
        ? auth.balance.credits
        : (auth.user?.credits ?? '0')
      );

  profileCredits.textContent = creditsValue;

  const resetAt = auth.balance?.reset_at || auth.user?.credits_reset_at || null;
  profileReset.textContent = resetAt ? new Date(resetAt).toLocaleString() : '—';

  profilePremium.textContent = auth.isPremium() ? 'Ja' : 'Nein';

  const createdAt = auth.user?.created_at
    ? new Date(auth.user.created_at).toLocaleDateString()
    : '—';

  profileCreated.textContent = createdAt;
}


function closeProfileDropdown() {
  if (!profileDropdown) return;
  profileDropdown.classList.remove('open');
  profileDropdown.setAttribute('aria-hidden', 'true');
  profileTrigger?.setAttribute('aria-expanded', 'false');
}

function toggleProfileDropdown() {
  if (!profileDropdown) return;
  const isOpen = profileDropdown.classList.toggle('open');
  profileDropdown.setAttribute('aria-hidden', String(!isOpen));
  profileTrigger?.setAttribute('aria-expanded', String(isOpen));
}

export function showProfilePage(auth, promptLogin = false) {
  if (!auth?.isLoggedIn() && promptLogin) {
    auth.open('login');
    auth.setError('Bitte zuerst einloggen.', 'info');
    return;
  }
  updateProfileView(auth);
  showPage('profile');
}

export function renderHistory() {
  const h = $('#historyList');
  if (h) h.innerHTML = '<div class="ac-subtle">Noch keine Eintraege.</div>';
}

function updateAdminVisibility(auth) {
  const isAdmin = auth?.isAdmin?.() === true;
  if (sideAdmin) sideAdmin.hidden = !isAdmin;
  if (profileAdminBtn) profileAdminBtn.hidden = !isAdmin;
}

export function showLegal(section) {
  const c = $('#legalContent');
  if (!c) return;
  if (section === 'impressum') c.innerHTML = '<h3>Impressum</h3><p>Folgt.</p>';
  else if (section === 'privacy') c.innerHTML = '<h3>Datenschutz</h3><p>Folgt.</p>';
  else if (section === 'tac') c.innerHTML = '<h3>AGB</h3><p>Folgt.</p>';
}

export function initUI(auth, extras = {}) {
  const onOpenAdmin = extras?.onOpenAdmin;
  navStart?.addEventListener('click', (e) => { e.preventDefault(); showPage('start'); });

  navHistory?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!auth.requireSession()) return;
    renderHistory();
    showPage('history');
  });

  brandHome?.addEventListener('click', (e) => { e.preventDefault(); showPage('start'); });

  hamburger?.addEventListener('click', (e) => {
    e.preventDefault();
    const open = sidebar?.classList.toggle('open');
    sidebarOverlay?.classList.toggle('show', !!open);
  });

  sidebarOverlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('show');
  });

  menuList?.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const [type, page, sub] = (el.dataset.action || '').split(':');
    if (type !== 'open') return;
    if (['video', 'image', 'audio'].includes(page)) {
      showPage('start');
    } else if (page === 'history') {
      if (!auth.requireSession()) return;
      renderHistory();
      showPage('history');
    } else if (page === 'legal') {
      showPage('legal');
      showLegal(sub || 'impressum');
    } else if (page === 'profile') {
      showProfilePage(auth, true);
    } else if (page === 'settings') {
      showPage('settings');
    } else if (page === 'admin') {
      if (typeof onOpenAdmin === 'function') onOpenAdmin();
      else showPage('admin');
    } else {
      showPage(page);
    }
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('show');
  });

  profileHistoryBtn?.addEventListener('click', () => {
    if (!auth.requireSession()) return;
    renderHistory();
    showPage('history');
  });

  profileLogoutBtn?.addEventListener('click', () => auth.logout());

  profileGuestAction?.addEventListener('click', () => {
    auth.open('login');
    auth.setError('');
  });

  profileTrigger?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!auth.isLoggedIn()) {
      auth.open('login');
      auth.setError('');
      return;
    }
    toggleProfileDropdown();
  });

  profileDropdown?.addEventListener('click', (e) => {
    const action = e.target.closest('button')?.dataset.menu;
    if (!action) return;
    if (action === 'profile' || action === 'credits') {
      showProfilePage(auth);
    } else if (action === 'settings') {
      showPage('settings');
    } else if (action === 'admin') {
      if (typeof onOpenAdmin === 'function') onOpenAdmin();
      else showPage('admin');
    } else if (action === 'logout') {
      auth.logout();
    }
    closeProfileDropdown();
  });

  document.addEventListener('click', (e) => {
    if (!profileDropdown || !profileTrigger) return;
    if (profileDropdown.contains(e.target) || profileTrigger.contains(e.target)) return;
    closeProfileDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProfileDropdown();
  });

  auth.subscribe(() => {
    updateCreditsUI(auth);
    updateProfileView(auth);
    updateAnalyzeButtons(auth);
    updateAdminVisibility(auth);
  });

  setupExpertModeToggle();
  updateCreditsUI(auth);
  updateProfileView(auth);
  updateAnalyzeButtons(auth, false);
  updateAdminVisibility(auth);
  showPage('start');
}

function setupExpertModeToggle() {
  if (expertToggleBound) return;
  const settingsPage = pages.settings;
  if (!settingsPage) return;
  const card = settingsPage.querySelector('.placeholder-card') || settingsPage.querySelector('.ac-card');
  if (!card || card.querySelector('#expertModeToggle')) return;

  const wrap = document.createElement('div');
  wrap.className = 'ac-setting ac-setting-row';
  wrap.innerHTML = `
    <input type="checkbox" id="expertModeToggle" />
    <label for="expertModeToggle">Expert Mode (Details fuer Profis)</label>
  `;
  card.appendChild(wrap);
  const input = wrap.querySelector('#expertModeToggle');
  try {
    input.checked = localStorage.getItem('ac_expert_mode') === '1';
  } catch (e) {
    input.checked = false;
  }
  input.addEventListener('change', () => {
    try {
      localStorage.setItem('ac_expert_mode', input.checked ? '1' : '0');
    } catch (e) {
      // ignore storage errors
    }
  });
  expertToggleBound = true;
}
