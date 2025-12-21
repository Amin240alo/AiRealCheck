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

  updateCreditsUI(auth);
  updateProfileView(auth);
  updateAnalyzeButtons(auth, false);
  updateAdminVisibility(auth);
  showPage('start');
}


