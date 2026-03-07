const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

console.log('UI VERSION:', '20260307_2');

const DEBUG_PROGRESS_RENDER = window?.AIREALCHECK_DEBUG_PROGRESS === true;

const pages = {
  start: $('#page-start'),
  dashboard: $('#page-dashboard'),
  history: $('#page-history'),
  login: $('#page-login'),
  authCallback: $('#page-auth-callback'),
  register: $('#page-register'),
  verify: $('#page-verify'),
  forgot: $('#page-forgot'),
  reset: $('#page-reset'),
  profile: $('#page-profile'),
  settings: $('#page-settings'),
  support: $('#page-support'),
  feedback: $('#page-feedback'),
  premium: $('#page-premium'),
  affiliate: $('#page-affiliate'),
  rate: $('#page-rate'),
  legal: $('#page-legal'),
  admin: $('#page-admin'),
};

const header = $('#mainHeader');
const headerAuth = $('#headerAuth');
const headerBack = $('#headerBack');
const adminContext = $('#adminContext');
const pageIndicator = $('#pageIndicator');
const creditsBox = $('#creditsBox');
const creditsLabel = $('#creditsText');
const creditsValue = $('#creditsValue');
const profileAvatar = $('#profileAvatar');
const profileGuestCard = $('#profileGuestCard');
const profileDataCard = $('#profileDataCard');
const profileName = $('#profileName');
const profileEmail = $('#profileEmail');
const profilePlan = $('#profilePlan');
const profileCredits = $('#profileCredits');
const profileReset = $('#profileReset');
const profilePremium = $('#profilePremium');
const profileVerified = $('#profileVerified');
const profileCreated = $('#profileCreated');
const profileBadge = $('#profileBadge');
const profileDropdown = $('#profileDropdown');
const profileLogoutBtn = $('#profileLogout');
const profileTrigger = $('#profileTrigger');
const profileAdminBtn = $('#profileAdmin');
const sidebar = $('#sidebar');
const sidebarOverlay = $('#overlay');
const hamburger = $('#hamburger');
const sidebarNav = $('#sidebarNav');
const bottomNav = $('#bottomNav');
const emailVerifyBanner = $('#emailVerifyBanner');
const analysisGateNotice = $('#analysisGateNotice');
const analysisTool = $('#analysisTool');
let analysisStatus = $('#analysisStatus');
let analysisArea = $('#analysisArea');
const resendVerifyBtn = $('#resendVerifyBtn');
const resendVerifyStatus = $('#resendVerifyStatus');
const profileVerifyBanner = $('#profileVerifyBanner');
const profileResendVerifyBtn = $('#profileResendVerifyBtn');
const profileResendVerifyStatus = $('#profileResendVerifyStatus');
const historyDrawer = $('#historyDrawer');
const historyDrawerBackdrop = $('#historyDrawerBackdrop');
const historyDetailBody = $('#historyDetailBody');
const historyDetailTitle = $('#historyDetailTitle');
const historyDetailMeta = $('#historyDetailMeta');
const historyDetailBadge = $('#historyDetailBadge');
const historyDetailClose = $('#historyDetailClose');
const historyDetailCopy = $('#historyDetailCopy');
const historyStatsTotal = $('#historyStatTotal');
const historyStatsAi = $('#historyStatAi');
const historyFilterBar = $('#historyFilter');

let currentAnalyzing = false;
let expertToggleBound = false;
let resendVerifyBound = false;
let currentRoute = window.location.pathname || '/';
let historyLoading = false;
let historyDetailLoading = false;
let historyCache = [];
let activeHistoryId = null;
let activeHistoryPayload = null;
let historyFilterValue = 'all';
let historyFilterBound = false;
let canCopyDetails = false;
let analyzeUiBound = false;
const analyzePreviewUrls = new Map();
let activeAnalyzeButton = null;
let reportCopyBound = false;
const lastResultsByKind = { image: null, video: null, audio: null };
let currentAnalyzeKind = null;
const lastPreviewByKind = { image: null, video: null, audio: null };

const RETURN_TO_KEY = 'airealcheck_return_to';
const fmtDT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDate = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });

const ICONS = {
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.8L19 10l-5.2 2.2L12 17l-1.8-4.8L5 10l5.2-2.2L12 3z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 10-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 008.6 15a1.65 1.65 0 00-1.82-.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0015.4 9a1.65 1.65 0 001.82.33l.06-.06A2 2 0 0120 12a2 2 0 01-.6 3z"/></svg>',
  diamond: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3l1 6 1-6"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 10-7.07-7.07L10 5"/><path d="M14 11a5 5 0 01-7.07 0L4.1 8.17a5 5 0 017.07-7.07L14 3"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15 8.5 22 9 17 13.8 18.5 21 12 17.8 5.5 21 7 13.8 2 9 9 8.5 12 2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>',
  // Neue Icons für die überarbeitete Navigation
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><polyline points="9 11 11 13 15 9"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
};

const ROUTES = [
  // --- Arbeitsbereich ---
  {
    key: 'dashboard',
    path: '/dashboard',
    page: 'dashboard',
    label: 'Dashboard',
    icon: 'grid',
    access: 'public',
    nav: { sidebar: true, bottom: false, section: 'workspace' },
  },
  {
    key: 'start',
    path: '/',
    page: 'start',
    label: 'Analyse',
    icon: 'search',
    access: 'public',
    nav: { sidebar: true, bottom: true, section: 'workspace', primary: true },
  },
  {
    key: 'history',
    path: '/history',
    page: 'history',
    label: 'Verlauf',
    icon: 'clock',
    access: 'auth',
    nav: { sidebar: true, bottom: true, section: 'workspace' },
  },
  // --- Konto ---
  {
    key: 'profile',
    path: '/profile',
    page: 'profile',
    label: 'Profil',
    icon: 'user',
    access: 'auth',
    nav: { sidebar: true, bottom: true, section: 'account' },
  },
  {
    key: 'settings',
    path: '/settings',
    page: 'settings',
    label: 'Einstellungen',
    icon: 'settings',
    access: 'auth',
    nav: { sidebar: true, bottom: false, section: 'account' },
  },
  // --- Tools & Support ---
  {
    key: 'support',
    path: '/support',
    page: 'support',
    label: 'Support & Hilfe',
    icon: 'help',
    access: 'public',
    nav: { sidebar: true, bottom: false, section: 'support' },
  },
  {
    key: 'feedback',
    path: '/feedback',
    page: 'feedback',
    label: 'Feedback',
    icon: 'chat',
    access: 'public',
    nav: { sidebar: true, bottom: false, section: 'support' },
  },
  {
    key: 'api',
    path: '/api',
    page: 'start',
    label: 'API-Zugang',
    icon: 'code',
    access: 'public',
    nav: { sidebar: true, bottom: false, section: 'support', disabled: true, badge: 'Bald' },
  },
  // --- Nicht in Nav (aber weiterhin erreichbar) ---
  {
    key: 'premium',
    path: '/premium',
    page: 'premium',
    label: 'Upgrade',
    icon: 'diamond',
    access: 'public',
  },
  {
    key: 'affiliate',
    path: '/affiliate',
    page: 'affiliate',
    label: 'Affiliate',
    icon: 'link',
    access: 'auth',
  },
  {
    key: 'rate',
    path: '/rate',
    page: 'rate',
    label: 'App bewerten',
    icon: 'star',
    access: 'public',
  },
  {
    key: 'legal',
    path: '/legal',
    page: 'legal',
    label: 'Rechtliches',
    access: 'public',
  },
  {
    key: 'admin',
    path: '/admin',
    page: 'admin',
    label: 'Admin',
    icon: 'shield',
    access: 'admin',
    nav: { sidebar: true, bottom: false, section: 'admin' },
  },
  {
    key: 'login',
    path: '/login',
    page: 'login',
    label: 'Anmelden',
    access: 'public',
    authPage: true,
  },
  {
    key: 'authCallback',
    path: '/auth/callback',
    page: 'authCallback',
    label: 'Anmeldung',
    access: 'public',
    authPage: true,
  },
  {
    key: 'register',
    path: '/register',
    page: 'register',
    label: 'Registrieren',
    access: 'public',
    authPage: true,
  },
  {
    key: 'verify',
    path: '/verify-email',
    page: 'verify',
    label: 'E-Mail bestätigen',
    access: 'public',
    authPage: true,
  },
  {
    key: 'forgot',
    path: '/forgot-password',
    page: 'forgot',
    label: 'Passwort vergessen',
    access: 'public',
    authPage: true,
  },
  {
    key: 'reset',
    path: '/reset-password',
    page: 'reset',
    label: 'Passwort zurücksetzen',
    access: 'public',
    authPage: true,
  },
];

const NAV_SECTIONS = [
  { key: 'workspace', title: 'Arbeitsbereich' },
  { key: 'account', title: 'Konto' },
  { key: 'support', title: 'Tools & Support' },
  { key: 'admin', title: 'Admin', adminOnly: true },
];

const QUICK_ACTIONS = [
  { key: 'image', label: 'Bild', action: 'open:image', media: 'image' },
  { key: 'video', label: 'Video', action: 'open:video', media: 'video' },
  { key: 'audio', label: 'Audio', action: 'open:audio', media: 'audio' },
];

const LEGAL_LINKS = [
  { key: 'impressum', label: 'Impressum' },
  { key: 'privacy', label: 'Datenschutz' },
  { key: 'tac', label: 'AGB' },
];

const ROUTE_BY_PATH = new Map(ROUTES.map((route) => [route.path, route]));
const ROUTE_BY_PAGE = new Map(ROUTES.map((route) => [route.page, route]));
const AUTH_ROUTE_PATHS = new Set(ROUTES.filter((route) => route.authPage).map((route) => route.path));

function normalizePath(value) {
  return String(value || '').split('?')[0];
}

function renderIcon(name, className = '') {
  const svg = ICONS[name] || '';
  if (!svg) return '';
  if (!className) return svg;
  return svg.replace('<svg ', `<svg class="${className}" `);
}

function resolveRoute(pathname) {
  const safePath = normalizePath(pathname);
  return ROUTE_BY_PATH.get(safePath) || ROUTE_BY_PATH.get('/') || ROUTES[0];
}

function routeForPage(pageName) {
  return ROUTE_BY_PAGE.get(pageName) || ROUTE_BY_PATH.get('/') || ROUTES[0];
}

function canAccessRoute(route, { loggedIn, isAdmin }) {
  if (!route) return false;
  if (route.access === 'admin') return !!isAdmin;
  if (route.access === 'auth') return !!loggedIn;
  return true;
}

function getLegalSection() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    return (params.get('section') || params.get('tab') || 'impressum').toLowerCase();
  } catch (err) {
    return 'impressum';
  }
}

function getActiveMediaKind() {
  if ($('#btnVideo')?.classList.contains('ac-active')) return 'video';
  if ($('#btnAudio')?.classList.contains('ac-active')) return 'audio';
  if ($('#btnImage')?.classList.contains('ac-active')) return 'image';
  return null;
}

function setPageIndicator(route) {
  if (!pageIndicator) return;
  pageIndicator.textContent = route?.label || 'Analyse';
}

function setActiveNav(routeKey) {
  const activeKey = routeKey || 'start';
  const legalSection = activeKey === 'legal' ? getLegalSection() : null;
  document.querySelectorAll('[data-nav-key]').forEach((el) => {
    let isActive = el.dataset.navKey === activeKey;
    if (activeKey === 'legal' && el.dataset.legalSection) {
      isActive = el.dataset.legalSection === legalSection;
    }
    if (el.classList.contains('ac-nav-btn')) {
      el.classList.toggle('ac-active', isActive);
    } else {
      el.classList.toggle('is-active', isActive);
    }
    if (isActive) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}

function hasGuestSidebarItems() {
  return ROUTES.some((route) => route?.nav?.sidebar && canAccessRoute(route, { loggedIn: false, isAdmin: false }));
}

function renderSidebarItem(route) {
  const classes = ['ac-side-item'];
  if (route?.nav?.disabled) classes.push('ac-side-disabled');
  const iconHtml = route?.icon ? `<span class="ac-icon">${renderIcon(route.icon)}</span>` : '<span class="ac-icon"></span>';
  const badgeHtml = route?.nav?.badge ? `<span class="ac-side-badge">${escapeHtml(route.nav.badge)}</span>` : '';
  const tooltip = escapeHtml(route.label);
  const linkAttr = route?.nav?.disabled ? '' : `data-link="${route.path}"`;
  return `
    <button type="button" class="${classes.join(' ')}" ${linkAttr} data-nav-key="${route.key}" data-tooltip="${tooltip}">
      ${iconHtml}
      <span class="ac-side-label">${escapeHtml(route.label)}</span>
      ${badgeHtml}
    </button>
  `;
}

function renderQuickActions() {
  const actions = QUICK_ACTIONS.map((action) => (
    `<button class="ac-quick-btn" type="button" data-action="${action.action}" data-media="${action.media}">${action.label}</button>`
  )).join('');
  if (!actions) return '';
  return `<div class="ac-nav-quick">${actions}</div>`;
}

function buildSidebarNav(auth) {
  if (!sidebarNav) return;
  const loggedIn = auth?.isLoggedIn?.() === true;
  const isAdmin = auth?.isAdmin?.() === true;
  const context = { loggedIn, isAdmin };
  let html = '';
  NAV_SECTIONS.forEach((section) => {
    if (section.adminOnly && !isAdmin) return;
    // Disabled-Elemente werden immer angezeigt (unabhängig von canAccessRoute)
    const items = ROUTES.filter(
      (route) => route?.nav?.sidebar && route.nav.section === section.key
        && (route.nav.disabled || canAccessRoute(route, context))
    );
    if (!items.length) return;
    html += `<div class="ac-nav-section">`;
    if (section.title) html += `<div class="ac-nav-title">${section.title}</div>`;
    items.forEach((route) => {
      html += renderSidebarItem(route);
      if (section.key === 'workspace' && route.key === 'start') {
        html += renderQuickActions();
      }
    });
    html += `</div>`;
  });
  sidebarNav.innerHTML = html;

  // Upgrade-CTA anzeigen wenn eingeloggt
  const upgradeEl = document.getElementById('sidebarUpgrade');
  if (upgradeEl) upgradeEl.hidden = !loggedIn;

  updateQuickMediaButtons();
}

function buildBottomNav(auth) {
  if (!bottomNav) return;
  const loggedIn = auth?.isLoggedIn?.() === true;
  const isAdmin = auth?.isAdmin?.() === true;
  const context = { loggedIn, isAdmin };
  const items = ROUTES.filter((route) => route?.nav?.bottom && canAccessRoute(route, context));
  bottomNav.hidden = !loggedIn || !items.length;
  if (!loggedIn || !items.length) {
    bottomNav.innerHTML = '';
    return;
  }
  bottomNav.innerHTML = items.map((route) => {
    const label = route.nav?.shortLabel || route.label;
    return `
      <button type="button" class="ac-nav-btn" data-link="${route.path}" data-nav-key="${route.key}" aria-label="${label}">
        ${renderIcon(route.icon, 'ac-nav-ic')}
        <span>${label}</span>
      </button>
    `;
  }).join('');
}

function handleNavAction(action, navigateFn) {
  const [type, target] = String(action || '').split(':');
  if (type !== 'open') return;
  if (['video', 'image', 'audio'].includes(target)) {
    if (navigateFn) navigateFn('/');
    else showPage('start', routeForPage('start'));
    setTimeout(() => activateMediaType(target), 0);
  }
}

function refreshNavigation(auth) {
  buildSidebarNav(auth);
  buildBottomNav(auth);
  const activeRoute = resolveRoute(currentRoute);
  setActiveNav(activeRoute?.key);
  setPageIndicator(activeRoute);
}

function updateQuickMediaButtons(kind = null) {
  const active = kind || getActiveMediaKind();
  document.querySelectorAll('.ac-quick-btn[data-media]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.media === active);
  });
}

function activateMediaType(kind) {
  if (!kind) return;
  const map = {
    image: '#btnImage',
    video: '#btnVideo',
    audio: '#btnAudio',
  };
  const btn = document.querySelector(map[kind]);
  if (btn) btn.click();
  updateQuickMediaButtons(kind);
}

function analysisAreaHasResult() {
  if (!analysisArea) analysisArea = document.querySelector('#analysisArea');
  if (!analysisArea) return false;
  return !!analysisArea.querySelector('.ac-report-surface, .ac-result-card, .ac-result-error, .ac-card');
}

function isAuthRoute(path) {
  return AUTH_ROUTE_PATHS.has(normalizePath(path));
}

function isPublicRoute(path) {
  const route = resolveRoute(path);
  return route?.access === 'public' || route?.authPage === true;
}

function setRouteClasses(path) {
  const safePath = normalizePath(path);
  const root = document.documentElement;
  const authRoute = isAuthRoute(safePath);
  root.classList.toggle('ac-route-auth', authRoute);
  root.classList.toggle('ac-route-login', safePath === '/login');
  root.classList.toggle('ac-route-register', safePath === '/register');
  root.classList.toggle('ac-route-reset', safePath === '/reset-password');
  root.classList.toggle('ac-route-forgot', safePath === '/forgot-password');
  root.classList.toggle('ac-route-verify', safePath === '/verify-email');
  root.classList.toggle('ac-route-auth-callback', safePath === '/auth/callback');
}

export function showPage(name, route = null) {
  Object.values(pages).forEach((p) => p && p.classList.add('ac-hide'));
  const target = pages[name] || pages.start;
  if (target) target.classList.remove('ac-hide');
  const resolved = route || routeForPage(name);
  setActiveNav(resolved?.key);
  setPageIndicator(resolved);
  document.documentElement.classList.toggle('ac-admin-mode', resolved?.key === 'admin');
  if (resolved?.key === 'start') updateQuickMediaButtons();
  if (resolved?.key !== 'history') closeHistoryDrawer();
}

function updateHeaderUI(auth, path = currentRoute) {
  const loggedIn = auth?.isLoggedIn?.() === true;
  const isAdmin = auth?.isAdmin?.() === true;
  const route = resolveRoute(path);
  const authRoute = isAuthRoute(path);
  const adminRoute = route?.key === 'admin';
  const canShowSidebar = !authRoute && (loggedIn || hasGuestSidebarItems());

  document.documentElement.classList.toggle('ac-shell', loggedIn && !authRoute);
  document.documentElement.classList.toggle('ac-guest', !loggedIn);

  if (header) header.classList.toggle('ac-header-simple', authRoute);

  // Zurück-Button nur auf Auth-Seiten
  if (headerBack) {
    headerBack.hidden = !authRoute;
    if (authRoute) {
      let backTarget = '/';
      try {
        const saved = sessionStorage.getItem(RETURN_TO_KEY);
        if (saved && !isAuthRoute(normalizePath(saved))) backTarget = saved;
      } catch (err) {
        // Speicher-Fehler ignorieren
      }
      headerBack.dataset.link = backTarget;
    }
  }

  // Hamburger-Button (für Mobile-Drawer)
  if (hamburger) hamburger.hidden = !canShowSidebar;

  // Auth-Buttons (Gäste)
  if (headerAuth) headerAuth.hidden = loggedIn || authRoute;

  // User-Pill: Credits + Avatar (eingeloggte Nutzer, keine Auth-Seite)
  const userPillEl = document.getElementById('userPill');
  if (userPillEl) userPillEl.hidden = !loggedIn || authRoute;

  // Credits-Badge innerhalb der Pill
  if (creditsBox) creditsBox.hidden = !loggedIn || authRoute;

  // Avatar-Button
  if (profileTrigger) {
    profileTrigger.hidden = !loggedIn || authRoute;
    if (loggedIn && !authRoute) profileTrigger.removeAttribute('data-link');
    else profileTrigger.setAttribute('data-link', '/login');
  }

  // Breadcrumb (Seitenname links) — nur auf normalen Seiten
  if (pageIndicator) pageIndicator.hidden = authRoute;

  // Admin-Kontext in der Mitte
  if (adminContext) adminContext.hidden = !adminRoute;

  // Profil-Dropdown
  if (profileDropdown) {
    profileDropdown.hidden = !loggedIn || authRoute;
    if (!loggedIn || authRoute) closeProfileDropdown();
  }

  if (!loggedIn) {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('show');
  }
}

function updateAnalysisVisibility(auth) {
  const loggedIn = auth?.isLoggedIn?.() === true;
  const guestAllowed = auth?.canUseGuest?.() === true;
  const canAnalyze = loggedIn || guestAllowed;
  if (analysisTool) analysisTool.classList.toggle('ac-hide', !canAnalyze);
}

function enforceAuthGuard(auth, path = currentRoute, navigate) {
  const route = resolveRoute(path);
  const loggedIn = auth?.isLoggedIn?.() === true;
  const isAdmin = auth?.isAdmin?.() === true;
  const safePath = normalizePath(path);
  const needsAuth = route?.access === 'auth' || route?.access === 'admin';
  if (needsAuth && !loggedIn) {
    try {
      const returnTarget = `${window.location.pathname}${window.location.search}`;
      if (returnTarget && !isAuthRoute(normalizePath(returnTarget))) {
        sessionStorage.setItem(RETURN_TO_KEY, returnTarget);
      }
    } catch (err) {
      // ignore storage errors
    }
    auth?.setNotice?.('Bitte zuerst einloggen.', 'info');
    const target = '/login';
    currentRoute = target;
    if (typeof navigate === 'function' && safePath !== target) {
      navigate(target);
      return true;
    }
    if (!navigate) {
      window.location.replace(target);
      return true;
    }
  }
  if (route?.access === 'admin' && loggedIn && !isAdmin) {
    if (typeof navigate === 'function') navigate('/');
    else window.location.replace('/');
    return true;
  }
  return false;
}

export function initRouter(auth) {
  const listeners = new Set();

  function render(pathname = window.location.pathname) {
    const safePath = normalizePath(pathname);
    const route = resolveRoute(safePath);
    setRouteClasses(safePath);
    if (enforceAuthGuard(auth, safePath, navigate)) {
      return;
    }
    showPage(route.page, route);
    if (route.key === 'legal') {
      showLegal(getLegalSection());
    }
    listeners.forEach((cb) => {
      try {
        cb(safePath, route);
      } catch (err) {
        console.error('router listener error', err);
      }
    });
  }

  function navigate(path) {
    if (!path) return;
    const target = String(path);
    if (`${window.location.pathname}${window.location.search}` === target) {
      render(window.location.pathname);
      return;
    }
    history.pushState({}, '', target);
    render(window.location.pathname);
  }

  function subscribe(fn) {
    if (typeof fn === 'function') listeners.add(fn);
    return () => listeners.delete(fn);
  }

  window.addEventListener('popstate', () => render());
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('[data-link]');
    if (!link) return;
    const target = link.getAttribute('data-link') || link.getAttribute('href');
    if (!target || target.startsWith('http')) return;
    e.preventDefault();
    navigate(target);
  });

  return { navigate, render, subscribe };
}

const ANALYSIS_COSTS = { image: 10, video: 25, audio: 15 };
const getAnalysisCost = (kind = 'image') => ANALYSIS_COSTS[kind] || 10;

function clampPercent(value) {
  const v = Number(value);
  if (Number.isNaN(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function percentFromValue(value) {
  if (value === null || value === undefined) return null;
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  if (v <= 1) return clampPercent(v * 100);
  return clampPercent(v);
}

function clamp01Value(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(1, v));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truthySignal(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  const v = String(value).toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return fmtDT.format(parsed);
  } catch (err) {
    return String(value);
  }
}

function formatDate(value) {
  if (!value) return '—';
  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return fmtDate.format(parsed);
  } catch (err) {
    return String(value);
  }
}

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return `${Math.round(num)}%`;
}

function formatConfidenceLabel(value) {
  const label = String(value || '').toLowerCase();
  if (label === 'high') return 'Sehr zuverlässige Bewertung';
  if (label === 'medium') return 'Ausreichende Signale';
  if (label === 'low') return 'Eingeschränkte Datengrundlage';
  return label ? label : 'Unbekannt';
}

function formatMediaLabel(value) {
  const raw = String(value || '').toLowerCase();
  if (raw === 'image') return 'Bild';
  if (raw === 'video') return 'Video';
  if (raw === 'audio') return 'Audio';
  if (raw === 'text') return 'Text';
  if (raw === 'unknown' || !raw) return 'Unbekannt';
  return raw;
}

function mediaIconSvg(kind) {
  const media = String(kind || '').toLowerCase();
  if (media === 'video') {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 10l6-3v10l-6-3"/></svg>';
  }
  if (media === 'audio') {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10v4"/><path d="M6 6v12"/><path d="M10 3v18"/><path d="M14 8v8"/><path d="M18 5v14"/><path d="M22 10v4"/></svg>';
  }
  if (media === 'text') {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-3.5-3.5a2.121 2.121 0 00-3 0L6 21"/></svg>';
}

function verdictFromPercent(aiPercent) {
  if (aiPercent === null || aiPercent === undefined) return { key: 'uncertain', label: 'Unsicher' };
  if (aiPercent >= 90) return { key: 'ai', label: 'Sehr wahrscheinlich KI' };
  if (aiPercent >= 65) return { key: 'ai', label: 'Eher KI' };
  if (aiPercent >= 35) return { key: 'uncertain', label: 'Unsicher' };
  if (aiPercent >= 11) return { key: 'real', label: 'Eher echt' };
  return { key: 'real', label: 'Sehr wahrscheinlich echt' };
}

function extractSignalValue(signals, key) {
  const wanted = String(key || '').toLowerCase();
  const items = Array.isArray(signals) ? signals : [];
  for (const entry of items) {
    if (entry && typeof entry === 'object') {
      const name = String(entry.name || '').toLowerCase();
      if (name === wanted) {
        return entry.value;
      }
    }
    const raw = String(entry || '');
    const prefixMatch = raw.match(new RegExp(`^\\s*${escapeRegExp(key)}\\s*[:=]\\s*(.+)$`, 'i'));
    if (prefixMatch && prefixMatch[1]) {
      return prefixMatch[1].trim();
    }
    const nameMatch = raw.match(/name'\\s*:\\s*'([^']+)'/i) || raw.match(/\"name\"\\s*:\\s*\"([^\"]+)\"/i);
    if (nameMatch && String(nameMatch[1]).toLowerCase() === wanted) {
      const valueMatch = raw.match(/value'\\s*:\\s*([^,}]+)/i) || raw.match(/\"value\"\\s*:\\s*([^,}]+)/i);
      if (valueMatch && valueMatch[1]) {
        return String(valueMatch[1]).replace(/^['"]|['"]$/g, '').trim();
      }
    }
  }
  return null;
}

function normalizeEngineResults(engineResults) {
  return (Array.isArray(engineResults) ? engineResults : [])
    .filter((e) => e && typeof e === 'object')
    .map((e) => ({
      engine: String(e.engine || 'engine'),
      ai_likelihood: e.ai_likelihood,
      confidence: e.confidence,
      signals: Array.isArray(e.signals) ? e.signals : [],
      notes: e.notes,
      status: e.status,
      available: e.available !== false,
      samples: e.samples,
      stddev: e.stddev,
      range: e.range,
      warning: e.warning,
    }));
}

const ENGINE_LABELS = {
  sightengine: 'Sightengine',
  sightengine_video: 'Sightengine (Video)',
  reality_defender: 'Reality Defender',
  reality_defender_video: 'Reality Defender (Video)',
  reality_defender_audio: 'Reality Defender (Audio)',
  hive: 'Hive',
  hive_video: 'Hive (Video)',
  sensity_image: 'Sensity',
  sensity_video: 'Sensity (Video)',
  xception: 'Xception (Local ML)',
  clip_detector: 'CLIP Detector',
  c2pa: 'C2PA',
  watermark: 'Watermark/Metadata',
  forensics: 'Forensik',
  video_forensics: 'Video-Forensik',
  video_frame_detectors: 'Frame-Detektoren',
  video_temporal: 'Video Temporal',
  video_temporal_cnn: 'Video Temporal CNN',
  audio_aasist: 'AASIST (Audio)',
  audio_forensics: 'Audio-Forensik',
  audio_prosody: 'Audio Prosodie',
};

const ENGINE_DESCRIPTIONS = {
  sightengine: 'API-Detector für AI-Content.',
  reality_defender: 'API-Detector für Deepfakes.',
  hive: 'API-Detector für KI-Generierung.',
  xception: 'Lokales ML-Modell (Xception).',
  audio_aasist: 'Lokaler Audio-Spoofing-Detector.',
};

function normalizeResult(data) {
  const engineResults = normalizeEngineResults(data?.engine_results);
  const finalAi = (typeof data?.final_ai === 'number') ? data.final_ai : null;
  const finalReal = (typeof data?.final_real === 'number') ? data.final_real : null;
  const aiLikelihood = (typeof data?.ai_likelihood === 'number') ? data.ai_likelihood : null;
  const reasons = Array.isArray(data?.reasons) ? data.reasons : [];
  const conflict = (typeof data?.conflict === 'boolean') ? data.conflict : null;
  const confidenceLabel = typeof data?.confidence_label === 'string'
    ? data.confidence_label.toLowerCase()
    : null;
  const ensembleSignals = Array.isArray(data?.ensemble_signals) ? data.ensemble_signals : [];

  return {
    media_type: typeof data?.media_type === 'string' ? data.media_type.toLowerCase() : 'image',
    final_ai: finalAi,
    final_real: finalReal,
    ai_likelihood: aiLikelihood,
    confidence_label: confidenceLabel,
    reasons,
    conflict,
    engine_results: engineResults,
    ensemble_signals: ensembleSignals,
  };
}

function renderAnalysisResultLegacy(resultJson, { expertMode = false } = {}) {
  const r = normalizeResult(resultJson || {});
  const mediaType = r.media_type || 'image';
  const videoForensics = r.engine_results.find((e) => e.engine === 'video_forensics');
  const frameDetectors = r.engine_results.find((e) => e.engine === 'video_frame_detectors');
  const ffmpegMissing = mediaType === 'video'
    && videoForensics
    && String(videoForensics.notes || '').includes('ffmpeg_not_installed');
  const aiValue = (r.final_ai !== null ? r.final_ai : r.ai_likelihood);
  const finalAiPercent = percentFromValue(aiValue);
  const verdict = verdictFromPercent(finalAiPercent);
  const ensembleSignals = r.ensemble_signals || [];
  const forcedUncertain = truthySignal(extractSignalValue(ensembleSignals, 'forced_uncertain'));
  const audioProsodyAi = clamp01Value(extractSignalValue(ensembleSignals, 'prosody_ai'));
  const audioProsodyPercent = audioProsodyAi !== null
    ? clampPercent(Math.round(audioProsodyAi * 100))
    : null;
  const audioProsodyStrong = audioProsodyPercent !== null && audioProsodyPercent >= 70;
  const displayVerdict = forcedUncertain ? { key: 'uncertain', label: 'Unsicher' } : verdict;
  const displayAiPercent = forcedUncertain ? null : finalAiPercent;

  const confidenceMap = {
    high: { label: 'Hoch', badge: 'badge-green' },
    medium: { label: 'Mittel', badge: 'badge-yellow' },
    low: { label: 'Niedrig', badge: 'badge-red' },
  };
  const confidenceInfo = confidenceMap[r.confidence_label] || { label: 'Unbekannt', badge: 'badge-yellow' };

  const detectorEngines = mediaType === 'video'
    ? new Set(['video_frame_detectors', 'reality_defender_video'])
    : (mediaType === 'audio'
      ? new Set(['audio_aasist'])
      : new Set(['sightengine', 'reality_defender', 'hive', 'xception']));
  const detectors = r.engine_results.filter((e) => detectorEngines.has(e.engine));
  const availableDetectorCount = detectors.filter(
    (engine) => engine.available !== false && typeof engine.ai_likelihood === 'number'
  ).length;
  const detectorsAligned = availableDetectorCount >= 2 && r.conflict === false;
  const detectorsHtml = detectors.length
    ? detectors.map((engine) => {
      const available = engine.available !== false;
      const label = ENGINE_LABELS[engine.engine] || engine.engine;
      const desc = ENGINE_DESCRIPTIONS[engine.engine] || '';
      let score = available
        ? (percentFromValue(engine.ai_likelihood) !== null ? `${percentFromValue(engine.ai_likelihood)}% KI` : '--')
        : 'nicht verfügbar';
      if (
        mediaType === 'audio'
        && engine.engine === 'audio_aasist'
        && audioProsodyStrong
        && String(score).startsWith('0%')
      ) {
        score = '<=5% KI';
      }
      const notes = String(engine?.notes || '');
      let xceptionExtras = '';
      if (engine.engine === 'xception') {
        const extras = [];
        if (typeof engine.samples === 'number') extras.push(`Samples: ${engine.samples}`);
        if (typeof engine.stddev === 'number') extras.push(`Stddev: ${engine.stddev.toFixed(6)}`);
        if (typeof engine.range === 'number') extras.push(`Range: ${engine.range.toFixed(6)}`);
        if (engine.warning) extras.push(`Warning: ${engine.warning}`);
        if (extras.length) {
          xceptionExtras = `<div class="ac-engine-notes">${extras.join(' • ')}</div>`;
        }
      }
      return `
        <div class="ac-engine-item ${available ? '' : 'is-disabled'}">
          <div class="ac-engine-head">
            <div class="ac-engine-name">${label}</div>
            <div class="ac-engine-score">${score}</div>
          </div>
          <div class="ac-engine-meta">Status: ${available ? 'verfügbar' : 'nicht verfügbar'}</div>
          ${desc ? `<div class="ac-engine-desc">${desc}</div>` : ''}
          ${notes ? `<div class="ac-engine-notes">${notes}</div>` : ''}
          ${xceptionExtras}
        </div>
      `;
    }).join('')
    : '<div class="ac-subtle">Keine Detector-Engines verfügbar.</div>';

  const c2pa = r.engine_results.find((e) => e.engine === 'c2pa');
  let c2paStatus = 'kein Nachweis';
  if (c2pa && c2pa.available === false) {
    c2paStatus = 'nicht verfügbar';
  } else if (c2pa) {
    const signals = (c2pa.signals || []).map((s) => String(s).toLowerCase());
    if (signals.includes('signature_verified')) {
      c2paStatus = 'verifiziert';
    } else if (signals.includes('content_credentials_present')) {
      c2paStatus = 'vorhanden (nicht verifiziert)';
    } else if (signals.includes('no_content_credentials')) {
      c2paStatus = 'kein Nachweis';
    }
  }
  const c2paNotes = c2pa ? String(c2pa.notes || '') : '';

  const watermark = r.engine_results.find((e) => e.engine === 'watermark');
  let watermarkStatus = 'kein Nachweis (neutral)';
  if (watermark && watermark.available === false) {
    watermarkStatus = 'nicht verfügbar';
  } else if (watermark) {
    const signals = (watermark.signals || []).map((s) => String(s).toLowerCase());
    const hint = signals.find((s) => s.startsWith('metadata_ai_hint'));
    if (hint) {
      watermarkStatus = 'Hinweise gefunden';
    } else if (signals.includes('no_watermark_detected')) {
      watermarkStatus = 'kein Nachweis (neutral)';
    }
  }
  const watermarkNotes = watermark ? String(watermark.notes || '') : '';

  const forensicsEngine = mediaType === 'video'
    ? 'video_forensics'
    : (mediaType === 'audio' ? 'audio_forensics' : 'forensics');
  const forensics = r.engine_results.find((e) => e.engine === forensicsEngine);
  const technicalSignals = (forensics?.signals || []).map((s) => String(s));
  const formatSignal = (signal) => {
    const match = signal.match(/^frames_analyzed\\s*:\\s*(\\d+)/i);
    if (match) {
      return `Frames analysiert: ${match[1]}`;
    }
    const sampling = signal.match(/^sampling_breakdown\\s*:\\s*(.+)$/i);
    if (sampling) {
      return `Sampling: ${sampling[1]}`;
    }
    return signal;
  };
  const signalsHtml = technicalSignals.length
    ? `<ul class="ac-compare-list">${technicalSignals.map((s) => `<li>${formatSignal(s)}</li>`).join('')}</ul>`
    : '';
  const forensicsHtml = forensics
    ? (() => {
      const available = forensics.available !== false;
      const score = available
        ? (percentFromValue(forensics.ai_likelihood) !== null ? `${percentFromValue(forensics.ai_likelihood)}% KI` : '—')
        : 'nicht verfügbar';
      const notesRaw = String(forensics?.notes || '');
      let notes = notesRaw;
      if (mediaType === 'video') {
        const riskMatch = notesRaw.match(/risk_level\\s*[:=]\\s*(low|medium|high)/i);
        const riskLevel = riskMatch ? riskMatch[1].toLowerCase() : null;
        const riskLabel = riskLevel === 'high'
          ? 'Hoch'
          : (riskLevel === 'medium' ? 'Mittel' : (riskLevel === 'low' ? 'Niedrig' : null));
        const extraNotes = notesRaw
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter((t) => t && !t.toLowerCase().startsWith('risk_level'));
        const notesLines = [];
        if (riskLabel) notesLines.push(`Forensik-Risiko: ${riskLabel}`);
        if (extraNotes.length) notesLines.push(`Hinweis: ${extraNotes.slice(0, 2).join(', ')}`);
        notes = notesLines.join(' • ');
      }
      return `
        <div class="ac-engine-item ${available ? '' : 'is-disabled'}">
          <div class="ac-engine-head">
            <div class="ac-engine-name">${forensicsEngine}</div>
            <div class="ac-engine-score">${score}</div>
          </div>
          <div class="ac-engine-meta">Status: ${available ? 'verfügbar' : 'nicht verfügbar'}</div>
          ${notes ? `<div class="ac-engine-notes">${notes}</div>` : ''}
          ${signalsHtml || ''}
        </div>
      `;
    })()
    : '';

  const framesScored = frameDetectors
    ? Number(extractSignalValue(frameDetectors.signals || [], 'frames_scored'))
    : null;
  const enginesUsed = frameDetectors
    ? extractSignalValue(frameDetectors.signals || [], 'engines_used')
    : null;
  const medianAi = frameDetectors
    ? extractSignalValue(frameDetectors.signals || [], 'median_ai')
    : null;
  const variance = frameDetectors
    ? extractSignalValue(frameDetectors.signals || [], 'variance')
    : null;

  const frameDetailsHtml = frameDetectors
    ? `
      <div class="ac-engine-item ${frameDetectors.available !== false ? '' : 'is-disabled'}">
        <div class="ac-engine-head">
          <div class="ac-engine-name">video_frame_detectors</div>
          <div class="ac-engine-score">${finalAiPercent !== null ? `${finalAiPercent}% KI` : "--"}</div>
        </div>
        <div class="ac-engine-meta">Status: ${frameDetectors.available !== false ? 'verfügbar' : 'nicht verfügbar'}</div>
        <div class="ac-engine-notes">
          ${framesScored !== null ? `Frames bewertet: ${framesScored}` : "Frames bewertet: --"}<br/>
          ${enginesUsed ? `Engines: ${enginesUsed}` : "Engines: --"}<br/>
          ${medianAi ? `Median KI: ${medianAi}` : "Median KI: --"}<br/>
          ${variance ? `Varianz: ${variance}` : "Varianz: --"}
        </div>
      </div>
    `
    : '';

  let reasonLine = '';
  if (r.conflict === true) {
    reasonLine = 'Detektoren widersprechen sich.';
  } else if (verdict.key === 'uncertain' || r.final_ai === null) {
    reasonLine = 'Zu wenig verwertbare Signale.';
  } else if (detectorsAligned) {
    reasonLine = 'Mehrere Detektoren stimmen &uuml;berein.';
  } else if (r.reasons && r.reasons.length) {
    reasonLine = String(r.reasons[0]);
  } else {
    reasonLine = 'Ergebnis basiert auf den verf&uuml;gbaren Signalen.';
  }

  const audioWhyLines = [];
  if (mediaType === 'audio') {
    const aasist = r.engine_results.find((e) => e.engine === 'audio_aasist');
    const prosody = r.engine_results.find((e) => e.engine === 'audio_prosody');
    const toNumber = (value) => {
      const v = Number(value);
      return Number.isFinite(v) ? v : null;
    };

    const probSpoof = toNumber(extractSignalValue(aasist?.signals, 'prob_spoof'));
    const probPercent = percentFromValue(probSpoof);
    if (probPercent !== null) {
      audioWhyLines.push(`AASIST: ${probPercent}% KI`);
    }

    const prosodyPercent = audioProsodyPercent;
    const wValue = toNumber(extractSignalValue(ensembleSignals, 'ensemble_w_prosody'));
    const wText = wValue !== null ? ` (w=${wValue.toFixed(2)})` : '';
    const jitter = toNumber(extractSignalValue(prosody?.signals, 'jitter_approx'));
    const f0Std = toNumber(extractSignalValue(prosody?.signals, 'f0_std_hz'));
    const rmsCv = toNumber(extractSignalValue(prosody?.signals, 'rms_cv'));
    let prosodyHint = '';
    if (jitter !== null && f0Std !== null && rmsCv !== null) {
      const jAi = clamp01Value((0.6 - jitter) / 0.6);
      const fAi = clamp01Value((6.0 - f0Std) / 6.0);
      const rAi = clamp01Value((0.35 - rmsCv) / 0.35);
      if (jAi !== null && fAi !== null && rAi !== null) {
        const smooth = 0.45 * jAi + 0.35 * fAi + 0.2 * rAi;
        if (smooth >= 0.75) {
          prosodyHint = 'Stimme auff\u00e4llig glatt';
        } else if (smooth <= 0.35) {
          prosodyHint = 'Stimme sehr variabel';
        } else {
          prosodyHint = 'Stimme gemischt';
        }
      }
    }
    if (prosodyPercent !== null) {
      const hintText = prosodyHint ? ` - ${prosodyHint}` : '';
      audioWhyLines.push(`Prosody-AI: ${prosodyPercent}%${wText}${hintText}`);
    }
    if (audioProsodyAi !== null && audioProsodyAi >= 0.70) {
      audioWhyLines.push('Prosody deutet auf synthetische Stimmgl\u00e4tte hin');
    }

    const conflictSignals = extractSignalValue(ensembleSignals, 'conflict_signals');
    if (truthySignal(conflictSignals)) {
      audioWhyLines.push('Widersprüchliche Signale \u2192 Konfidenz reduziert');
    }

    const voicedRatio = toNumber(extractSignalValue(prosody?.signals, 'voiced_ratio'));
    if (voicedRatio !== null && voicedRatio < 0.2) {
      audioWhyLines.push('Prosody unsicher (wenig Stimme im Audio)');
    }
    const verdictIsEherEcht = String(verdict.label || '').toLowerCase().includes('eher echt');
    if (verdictIsEherEcht && audioProsodyAi !== null && audioProsodyAi >= 0.60) {
      audioWhyLines.push('\u26a0\ufe0f M\u00f6gliches KI-Audio trotz niedriger Gesamtwertung');
    }
  }
  const audioWhyHtml = audioWhyLines.length
    ? `
      <div class="ac-result-details">
        <div class="ac-result-sub">Warum?</div>
        <ul class="ac-compare-list">${audioWhyLines.map((line) => `<li>${line}</li>`).join('')}</ul>
      </div>
    `
    : '';

  return `
    ${ffmpegMissing ? `
      <div class="ac-card">
        <div class="ac-result-title" style="color:#b42318">FFmpeg fehlt – Video-Frames können nicht extrahiert werden. Installiere FFmpeg und starte den Server neu.</div>
      </div>
    ` : ''}
    <div class="ac-card ac-result-card" role="status" aria-live="polite">
      <div class="ac-result-headline">${displayVerdict.label}</div>
      <div class="ac-result-row">
        <span class="ac-traffic-badge ${confidenceInfo.badge}">Konfidenz: ${confidenceInfo.label}</span>
        ${mediaType === 'video' && framesScored !== null ? `<span class="ac-subtle">Basierend auf ${framesScored} Frames</span>` : ''}
      </div>
      <div class="ac-result-hero">
        <div class="ac-result-percent">KI-Wahrscheinlichkeit: ${displayAiPercent !== null ? `${displayAiPercent}%` : '—'}</div>
      </div>
      ${audioWhyHtml}
      <div class="ac-result-expl">${reasonLine}</div>
    </div>

    <div class="ac-card">
      <div class="ac-card-title">Detectors</div>
      <div class="ac-engine-list">${detectorsHtml}</div>
    </div>

    ${mediaType === 'video' && frameDetailsHtml ? `
      <div class="ac-card">
        <div class="ac-card-title">Frame-Detectors</div>
        <div class="ac-engine-list">${frameDetailsHtml}</div>
      </div>
    ` : ''}

    ${mediaType === 'video' ? '' : `
      <div class="ac-card">
        <div class="ac-card-title">Provenance (C2PA)</div>
        <div class="ac-engine-list">
          <div class="ac-engine-item ${c2pa && c2pa.available === false ? 'is-disabled' : ''}">
            <div class="ac-engine-head">
              <div class="ac-engine-name">c2pa</div>
              <div class="ac-engine-score">${c2paStatus}</div>
            </div>
            ${c2paNotes ? `<div class="ac-engine-notes">${c2paNotes}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="ac-card">
        <div class="ac-card-title">Watermarks &amp; Metadata</div>
        <div class="ac-engine-list">
          <div class="ac-engine-item ${watermark && watermark.available === false ? 'is-disabled' : ''}">
            <div class="ac-engine-head">
              <div class="ac-engine-name">watermark</div>
              <div class="ac-engine-score">${watermarkStatus}</div>
            </div>
            ${watermarkNotes ? `<div class="ac-engine-notes">${watermarkNotes}</div>` : ''}
          </div>
        </div>
      </div>
    `}

    ${forensicsHtml ? `
      <div class="ac-card">
        <div class="ac-card-title">Technische Hinweise</div>
        <div class="ac-engine-list">${forensicsHtml}</div>
      </div>
    ` : ''}
  `;
}

function pickPublicResult(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload?.meta?.schema_version === 'public_result_v1') return payload;
  if (payload?.result_json?.meta?.schema_version === 'public_result_v1') return payload.result_json;
  if (payload?.analysis?.result_json?.meta?.schema_version === 'public_result_v1') return payload.analysis.result_json;
  return null;
}

function normalizePublicResult(payload) {
  const result = pickPublicResult(payload);
  if (!result) return null;
  const meta = (result.meta && typeof result.meta === 'object') ? result.meta : {};
  const summary = (result.summary && typeof result.summary === 'object') ? result.summary : {};
  const details = (result.details && typeof result.details === 'object') ? result.details : {};
  const status = payload?.status || payload?.analysis?.status || null;
  return { meta, summary, details, status };
}

function verdictLabelFromSummary(summary) {
  const label = summary?.label_de;
  if (label) return label;
  const key = summary?.verdict_key;
  if (key === 'likely_ai') return 'Überwiegend KI';
  if (key === 'likely_real') return 'Überwiegend echt';
  return 'Unsicher';
}

function trafficClass(value) {
  const key = String(value || '').toLowerCase();
  if (key === 'red') return 'is-red';
  if (key === 'green') return 'is-green';
  return 'is-yellow';
}

function formatPercentValue(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return `${Math.round(value)}%`;
}

function formatTimingMs(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '--';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms)} ms`;
}

function formatStatusSummary(entry, fallback) {
  if (!entry || typeof entry !== 'object') return fallback;
  const status = entry.status || entry.c2pa_status;
  const summary = entry.summary || entry.c2pa_summary;
  if (status && summary) return `${status} – ${summary}`;
  if (summary) return summary;
  if (status) return status;
  return fallback;
}

function formatForensicsSummary(forensics) {
  if (!forensics || typeof forensics !== 'object') return 'Keine Auffälligkeiten erkannt';
  if (typeof forensics.ai_percent === 'number' && Number.isFinite(forensics.ai_percent)) {
    return `Forensik-Score: ${Math.round(forensics.ai_percent)}%`;
  }
  const summaryLines = Array.isArray(forensics.summary_lines) ? forensics.summary_lines : [];
  if (summaryLines.length) return summaryLines[0];
  return 'Keine Auffälligkeiten erkannt';
}

function renderRing(aiPercent, traffic) {
  const size = 160;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentValue = (typeof aiPercent === 'number' && Number.isFinite(aiPercent))
    ? Math.max(0, Math.min(100, aiPercent))
    : 0;
  const dash = `${circumference} ${circumference}`;
  const offset = circumference - (percentValue / 100) * circumference;
  const labelValue = (typeof aiPercent === 'number' && Number.isFinite(aiPercent)) ? `${Math.round(aiPercent)} %` : '--';
  const trafficKey = String(trafficClass(traffic)).replace('is-', '') || 'yellow';
  const gradientMap = {
    red: ['#b42318', '#d9534f'],
    yellow: ['#b54708', '#d97706'],
    green: ['#1f7a4d', '#34a36f'],
  };
  const [gradStart, gradEnd] = gradientMap[trafficKey] || gradientMap.yellow;
  const gradId = `ac-ring-grad-${Math.random().toString(36).slice(2, 8)}`;
  return `
    <div class="ac-ring ${trafficClass(traffic)}">
      <svg class="ac-ring-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${gradStart}" />
            <stop offset="100%" stop-color="${gradEnd}" />
          </linearGradient>
        </defs>
        <circle class="ac-ring-track" cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke-width="${stroke}" />
        <circle class="ac-ring-progress" cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke-width="${stroke}"
          stroke-dasharray="${dash}" stroke-dashoffset="${offset}" stroke="url(#${gradId})" />
      </svg>
      <div class="ac-ring-label">
        <div class="ac-ring-value">${labelValue}</div>
        <div class="ac-ring-unit">KI</div>
      </div>
    </div>
  `;
}

function renderMediaPreview(kind) {
  if (!kind) return '';
  const info = lastPreviewByKind[kind];
  if (!info) return '';
  if (info.mode === 'link') {
    const label = info.link ? truncateText(info.link, 46) : 'Link geprüft';
    return `
      <div class="ac-report-media-card ac-report-media-link">
        <div class="ac-report-media-inner">
          <div class="ac-preview-label">Link geprüft</div>
          ${info.link ? `<div class="ac-preview-note">${escapeHtml(label)}</div>` : ''}
        </div>
      </div>
    `;
  }
  if (!info.url) return '';
  if (kind === 'image' || info.type.startsWith('image/')) {
    return `
      <div class="ac-report-media-card">
        <div class="ac-report-media-inner">
          <img class="ac-report-media-asset" src="${info.url}" alt="Vorschau" />
        </div>
      </div>
    `;
  }
  if (kind === 'video' || info.type.startsWith('video/')) {
    return `
      <div class="ac-report-media-card">
        <div class="ac-report-media-inner">
          <video class="ac-report-media-asset" src="${info.url}" controls preload="metadata"></video>
        </div>
      </div>
    `;
  }
  if (kind === 'audio' || info.type.startsWith('audio/')) {
    return `
      <div class="ac-report-media-card ac-report-media-audio">
        <div class="ac-report-media-inner">
          <audio class="ac-report-audio-player" controls src="${info.url}"></audio>
        </div>
      </div>
    `;
  }
  return '';
}

function renderEngineTable(engines, expertMode) {
  if (!Array.isArray(engines) || !engines.length) {
    return '<div class="ac-empty">Keine Detektoren verfügbar.</div>';
  }
  const header = `
    <div class="ac-engine-row engine-row-head">
      <div>Engine</div>
      <div>Status</div>
      <div>KI%</div>
      <div>Konf.</div>
      <div>Laufzeit</div>
    </div>
  `;
  const rows = engines.map((engine) => {
    const name = ENGINE_LABELS[engine.engine] || engine.engine || 'engine';
    const desc = ENGINE_DESCRIPTIONS[engine.engine];
    const statusRaw = String(engine.status || '').toLowerCase();
    let statusLabel = 'Verfügbar';
    let statusClass = 'ac-badge-ok';
    if (engine.available === false) {
      statusLabel = 'Nicht verfügbar';
      statusClass = 'ac-badge-off';
    } else if (statusRaw && statusRaw !== 'ok') {
      statusLabel = 'Gestört';
      statusClass = 'ac-badge-warn';
    }
    let aiPercent = engine.ai_percent;
    if (typeof aiPercent !== 'number' && typeof engine.ai01 === 'number') {
      aiPercent = engine.ai01 * 100;
    }
    let confPercent = engine.confidence01;
    if (typeof confPercent === 'number') {
      confPercent = confPercent * 100;
    } else {
      confPercent = null;
    }
    const note = expertMode ? (engine.warning || engine.notes || '') : '';
    return `
      <div class="ac-engine-row">
        <div class="ac-engine-cell ac-engine-name" title="${escapeHtml(desc || '')}">
          <div class="ac-engine-title">${escapeHtml(name)}</div>
          ${note ? `<div class="ac-engine-note">${escapeHtml(note)}</div>` : ''}
        </div>
        <div class="ac-engine-cell"><span class="ac-badge ${statusClass}">${statusLabel}</span></div>
        <div class="ac-engine-cell">${formatPercentValue(aiPercent)}</div>
        <div class="ac-engine-cell">${formatPercentValue(confPercent)}</div>
        <div class="ac-engine-cell">${formatTimingMs(engine.timing_ms)}</div>
      </div>
    `;
  }).join('');
  return `<div class="ac-engine-table">${header}${rows}</div>`;
}

function renderProvenance(details) {
  const provenance = details?.provenance || {};
  const status = provenance.c2pa_status;
  const summary = provenance.c2pa_summary;
  if (!status && !summary) {
    return '<div class="ac-empty">Keine Content Credentials gefunden.</div>';
  }
  return `
    <div class="ac-info-block">
      <div class="ac-info-title">Status</div>
      <div class="ac-info-value">${escapeHtml(status || 'unbekannt')}</div>
      ${summary ? `<div class="ac-info-note">${escapeHtml(summary)}</div>` : ''}
    </div>
  `;
}

function renderWatermarks(details) {
  const watermarks = details?.watermarks || {};
  const status = watermarks.status;
  const summary = watermarks.summary;
  if (!status && !summary) {
    return '<div class="ac-empty">Keine Watermark-Hinweise erkannt.</div>';
  }
  return `
    <div class="ac-info-block">
      <div class="ac-info-title">Status</div>
      <div class="ac-info-value">${escapeHtml(status || 'unbekannt')}</div>
      ${summary ? `<div class="ac-info-note">${escapeHtml(summary)}</div>` : ''}
    </div>
  `;
}

function renderTechnical(summary, details, engines, expertMode, { includeWarnings = true } = {}) {
  const lines = [];
  if (typeof summary?.confidence01 === 'number') {
    lines.push(`Konfidenz (0-1): ${summary.confidence01.toFixed(2)}`);
  }
  if (typeof details?.decision_threshold === 'number') {
    lines.push(`Entscheidungsschwelle: ${Math.round(details.decision_threshold * 100)}%`);
  }
  if (expertMode && Array.isArray(engines)) {
    engines.forEach((engine) => {
      const note = engine?.warning || engine?.notes;
      if (note) {
        const name = ENGINE_LABELS[engine.engine] || engine.engine || 'engine';
        lines.push(`${name}: ${note}`);
      }
    });
  }
  const warnings = includeWarnings && Array.isArray(summary?.warnings_user) ? summary.warnings_user : [];
  const warningsHtml = warnings.length
    ? `<div class="ac-info-list">${warnings.map((w) => `<div class="ac-info-line">${escapeHtml(w)}</div>`).join('')}</div>`
    : '';
  const linesHtml = lines.length
    ? `<ul class="ac-compact-list">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
    : '';
  if (!warningsHtml && !linesHtml) {
    return '<div class="ac-empty">Keine technischen Hinweise gespeichert.</div>';
  }
  return `${warningsHtml}${linesHtml}`;
}

export function renderAnalysisResult(resultJson, { expertMode = false, variant = 'default' } = {}) {
  const r = normalizePublicResult(resultJson || {});
  if (!r) {
    return renderAnalysisResultLegacy(resultJson, { expertMode });
  }
  const summary = r.summary || {};
  const details = r.details || {};
  const engines = Array.isArray(details.engines) ? details.engines : [];
  const aiPercent = (typeof summary.ai_percent === 'number') ? Math.round(summary.ai_percent) : null;
  const realPercent = (typeof summary.real_percent === 'number') ? Math.round(summary.real_percent) : null;
  const isFailed = r.status === 'failed' || aiPercent === null;
  const layout = String(variant || 'default');
  const useDrawerLayout = layout === 'drawer';

  if (isFailed) {
    return `
      <div class="ac-card ac-result-error">
        <div class="ac-result-error-title">Analyse fehlgeschlagen</div>
        <div class="ac-subtle">Bitte Datei prüfen und erneut versuchen.</div>
      </div>
    `;
  }

  const verdictKey = summary?.verdict_key || 'uncertain';
  const verdictCopy = {
    likely_real: {
      title: 'Sehr wahrscheinlich echt',
      subline: 'Keine relevanten Hinweise auf KI-Manipulation erkannt.',
    },
    likely_ai: {
      title: 'Sehr wahrscheinlich KI-generiert',
      subline: 'Starke Hinweise auf synthetische Erzeugung erkannt.',
    },
    uncertain: {
      title: 'Ergebnis nicht eindeutig',
      subline: 'Gemischte Signale erkannt. Weitere Prüfung empfohlen.',
    },
  };
  const verdictText = verdictCopy[verdictKey] || verdictCopy.uncertain;

  const analysisId = r.meta?.analysis_id || '—';
  const analysisDate = formatDateTime(r.meta?.created_at);
  const analysisType = formatMediaLabel(r.meta?.media_type);
  const canCopyId = !!(
    analysisId
    && analysisId !== '—'
    && typeof navigator !== 'undefined'
    && navigator?.clipboard
    && typeof navigator.clipboard.writeText === 'function'
  );
  const canShareId = !!(
    analysisId
    && analysisId !== '—'
    && typeof navigator !== 'undefined'
    && (typeof navigator.share === 'function' || typeof navigator.clipboard?.writeText === 'function')
  );
  const safeAnalysisId = escapeHtml(analysisId);
  const copyIdButton = `
    <button type="button" class="ac-report-copy" data-copy-id="${safeAnalysisId}" ${canCopyId ? '' : 'hidden disabled'}>
      Kopieren
    </button>
  `;
  const shareIdButton = `
    <button type="button" class="ac-report-share" data-share-id="${safeAnalysisId}" ${canShareId ? '' : 'hidden disabled'}>
      Teilen
    </button>
  `;

  const confidenceLabel = formatConfidenceLabel(summary.confidence_label);
  const activeModelEngines = engines.filter(
    (engine) => engine && engine.available === true && String(engine.status || '').toLowerCase() === 'ok'
  );
  const activeModelCount = activeModelEngines.length;
  const activeModelText = activeModelCount === 1
    ? '1 unabhängiges Modell'
    : (activeModelCount > 1 ? `${activeModelCount} unabhängige Modelle` : 'Mehrere Modelle');
  const modelText = (activeModelCount === 1)
    ? 'Bewertung basiert auf 1 unabhängigen Modell.'
    : (activeModelCount > 1
        ? `Bewertung basiert auf ${activeModelCount} unabhängigen Modellen.`
        : 'Bewertung basiert auf mehreren unabhängigen Modellen.');
  const realDisplay = (typeof realPercent === 'number')
    ? realPercent
    : (aiPercent !== null ? Math.max(0, 100 - aiPercent) : null);
  const realText = (typeof realDisplay === 'number')
    ? `${realDisplay} % Wahrscheinlichkeit für authentischen Inhalt`
    : 'Authentizitäts-Wahrscheinlichkeit nicht verfügbar.';
  const aiDisplayText = (typeof aiPercent === 'number') ? `${aiPercent} %` : '--';
  const realDisplayText = (typeof realDisplay === 'number') ? `${realDisplay} %` : '--';

  const totalMs = activeModelEngines.reduce((sum, engine) => {
    const ms = Number(engine?.timing_ms);
    return Number.isFinite(ms) ? sum + ms : sum;
  }, 0);
  const totalSeconds = totalMs > 0 ? (totalMs / 1000) : null;
  const totalSecondsLabel = totalSeconds
    ? `${totalSeconds.toFixed(1).replace('.', ',')} Sekunden`
    : null;
  const summaryReason = Array.isArray(summary?.reasons_user) ? summary.reasons_user[0] : '';
  const consensusLine = summary?.conflict === true
    ? 'Modelle sind sich uneinig.'
    : (summary?.conflict === false ? 'Modelle überwiegend konsistent.' : '');
  const trafficTone = summary?.traffic_light || (verdictKey === 'likely_real'
    ? 'green'
    : (verdictKey === 'likely_ai' ? 'red' : 'yellow'));
  const statusClass = trafficClass(trafficTone);
  const statusChipLabel = trafficTone === 'green' ? 'Echt' : (trafficTone === 'red' ? 'KI' : 'Unsicher');
  const previewHtml = renderMediaPreview(r.meta?.media_type);
  const detailRows = [
    { label: 'Detektionsmodelle', value: activeModelText },
    { label: 'Analysezeit', value: totalSecondsLabel || '—' },
    { label: 'Modell-Übereinstimmung', value: summary.conflict ? 'Gering' : 'Normal' },
  ];
  const authenticityRows = [
    { label: 'Wasserzeichen', value: formatStatusSummary(details?.watermarks, 'Keine Hinweise') },
    { label: 'Content Credentials', value: formatStatusSummary(details?.provenance, 'Keine gefunden') },
    { label: 'Forensik', value: formatForensicsSummary(details?.forensics) },
  ];

  const detailRowsHtml = detailRows.map((row) => `
    <div class="ac-report-summary-row">
      <span>${escapeHtml(row.label)}</span>
      <span>${escapeHtml(row.value)}</span>
    </div>
  `).join('');
  const authenticityRowsHtml = authenticityRows.map((row) => `
    <div class="ac-report-summary-row">
      <span>${escapeHtml(row.label)}</span>
      <span>${escapeHtml(row.value)}</span>
    </div>
  `).join('');
  const summaryBlocks = `
    <div class="ac-report-summary-block">
      <div class="ac-report-summary-subtitle">Analyse-Details</div>
      <div class="ac-report-summary-grid">
        ${detailRowsHtml}
      </div>
    </div>
    <div class="ac-report-summary-block">
      <div class="ac-report-summary-subtitle">Authentizitätsprüfung</div>
      <div class="ac-report-summary-grid">
        ${authenticityRowsHtml}
      </div>
    </div>
    ${expertMode ? `
      <div class="ac-report-summary-meta">
        <div>Systemstatus: Stabil</div>
      </div>
    ` : ''}
  `;
  const summaryContent = `
    <div class="ac-report-summary">
      <div class="ac-report-summary-title">Analyse-Zusammenfassung</div>
      ${summaryBlocks}
    </div>
  `;

  const summaryCard = `
    <div class="ac-card ac-report-card" role="status" aria-live="polite">
      <div class="ac-report-statusbar ${statusClass}"></div>
      <div class="ac-report-header">
        <div class="ac-report-header-left">
          <div class="ac-report-header-top">
            <div class="ac-report-label">Analysebericht</div>
            <span class="ac-report-chip ${statusClass}">${statusChipLabel}</span>
          </div>
          <div class="ac-report-title">${escapeHtml(verdictText.title)}</div>
          <div class="ac-report-subline">${escapeHtml(verdictText.subline)}</div>
          ${summaryReason ? `<div class="ac-report-reason">${escapeHtml(summaryReason)}</div>` : ''}
          ${consensusLine ? `<div class="ac-report-consensus">${escapeHtml(consensusLine)}</div>` : ''}
        </div>
        <div class="ac-report-meta">
          <div class="ac-report-meta-item">
            <div class="ac-report-meta-label">Analyse-ID</div>
            <div class="ac-report-meta-value">
              <div class="ac-report-meta-row">
                <span class="ac-report-id" title="${safeAnalysisId}">${safeAnalysisId}</span>
                <div class="ac-report-actions">
                  ${copyIdButton}
                  ${shareIdButton}
                </div>
              </div>
            </div>
          </div>
          <div class="ac-report-meta-item">
            <div class="ac-report-meta-label">Datum</div>
            <div class="ac-report-meta-value">${escapeHtml(analysisDate)}</div>
          </div>
          <div class="ac-report-meta-item">
            <div class="ac-report-meta-label">Medientyp</div>
            <div class="ac-report-meta-value">${escapeHtml(analysisType)}</div>
          </div>
        </div>
      </div>
      <div class="ac-report-body">
        <div class="ac-report-score">
          ${previewHtml || ''}
          ${renderRing(aiPercent, summary.traffic_light)}
          <div class="ac-report-metric">${escapeHtml(realText)}</div>
          <div class="ac-report-metric">${escapeHtml(modelText)}</div>
          <div class="ac-report-confidence">Konfidenz: ${escapeHtml(confidenceLabel)}</div>
        </div>
        ${summaryContent}
      </div>
    </div>
  `;

  const warnings = Array.isArray(summary?.warnings_user) ? summary.warnings_user : [];
  const warningsHtml = warnings.length
    ? `<div class="ac-info-list">${warnings.map((w) => `<div class="ac-info-line">${escapeHtml(w)}</div>`).join('')}</div>`
    : '<div class="ac-empty">Keine Warnungen gespeichert.</div>';
  const explanationLines = [verdictText.subline, summaryReason, consensusLine].filter((line) => line && String(line).trim());
  const explanationHtml = explanationLines.length
    ? explanationLines.map((line) => `<div class="ac-report-explain-line">${escapeHtml(line)}</div>`).join('')
    : '<div class="ac-empty">Keine zusätzliche Erklärung verfügbar.</div>';
  const metaRows = [
    { label: 'Analyse-ID', value: analysisId },
    { label: 'Datum', value: analysisDate },
    { label: 'Medientyp', value: analysisType },
  ];
  const metaRowsHtml = metaRows.map((row) => `
    <div class="ac-report-summary-row">
      <span>${escapeHtml(row.label)}</span>
      <span>${escapeHtml(row.value || '--')}</span>
    </div>
  `).join('');
  const technicalDetails = renderTechnical(summary, details, engines, expertMode, { includeWarnings: false });

  if (useDrawerLayout) {
    const resultCardDrawer = `
      <div class="ac-card ac-report-card ac-report-result-card" role="status" aria-live="polite">
        <div class="ac-report-statusbar ${statusClass}"></div>
        <div class="ac-report-header ac-report-header-drawer">
          <div class="ac-report-header-top">
            <div class="ac-report-label">Ergebnis</div>
            <span class="ac-report-chip ${statusClass}">${statusChipLabel}</span>
          </div>
          <div class="ac-report-title">${escapeHtml(verdictText.title)}</div>
        </div>
        <div class="ac-report-meta-grid">
          ${metaRowsHtml}
        </div>
      </div>
    `;
    const scoreCardDrawer = `
      <div class="ac-card ac-report-card ac-report-score-card">
        <div class="ac-report-score ac-report-score-stack">
          ${renderRing(aiPercent, summary.traffic_light)}
          <div class="ac-report-kpis">
            <div class="ac-report-kpi">
              <div class="ac-report-kpi-label">KI-Wahrscheinlichkeit</div>
              <div class="ac-report-kpi-value">${escapeHtml(aiDisplayText)}</div>
            </div>
            <div class="ac-report-kpi">
              <div class="ac-report-kpi-label">Echte Wahrscheinlichkeit</div>
              <div class="ac-report-kpi-value">${escapeHtml(realDisplayText)}</div>
            </div>
            <div class="ac-report-kpi">
              <div class="ac-report-kpi-label">Konfidenz</div>
              <div class="ac-report-kpi-value">${escapeHtml(confidenceLabel)}</div>
            </div>
          </div>
          ${modelText ? `<div class="ac-report-score-note">${escapeHtml(modelText)}</div>` : ''}
        </div>
      </div>
    `;
    const explanationCardDrawer = `
      <div class="ac-card ac-report-card ac-report-explain-card">
        <div class="ac-report-section-title">Erklärung</div>
        <div class="ac-report-explain-body">
          ${explanationHtml}
        </div>
      </div>
    `;
    const modelCardDrawer = `
      <div class="ac-card ac-report-card ac-report-model-card">
        <div class="ac-report-section-title">Model Analysis</div>
        <div class="ac-report-intro">Die folgenden Modelle wurden zur Bewertung verwendet.</div>
        ${renderEngineTable(engines, expertMode)}
      </div>
    `;
    const technicalCardDrawer = `
      <div class="ac-card ac-report-card ac-report-technical-card">
        <div class="ac-report-section-title">Technical Signals</div>
        <div class="ac-report-technical-body">
          ${summaryBlocks}
          <div class="ac-report-summary-block">
            <div class="ac-report-summary-subtitle">Technische Details</div>
            ${technicalDetails}
          </div>
        </div>
      </div>
    `;
    const warningsCardDrawer = `
      <div class="ac-card ac-report-card ac-report-warnings-card">
        <div class="ac-report-section-title">Warnings</div>
        ${warningsHtml}
      </div>
    `;
    return `
      <div class="ac-report-surface ac-animate-in ac-report-drawer">
        ${resultCardDrawer}
        ${scoreCardDrawer}
        ${explanationCardDrawer}
        ${modelCardDrawer}
        ${technicalCardDrawer}
        ${warningsCardDrawer}
      </div>
    `;
  }

  const detectorsSection = `
    <details class="ac-accordion" open>
      <summary>Modellanalyse</summary>
      <div class="ac-accordion-body">
        <div class="ac-report-intro">Die folgenden Modelle wurden zur Bewertung verwendet.</div>
        ${renderEngineTable(engines, expertMode)}
      </div>
    </details>
  `;

  const provenanceSection = `
    <details class="ac-accordion">
      <summary>Content Credentials</summary>
      <div class="ac-accordion-body">
        ${renderProvenance(details)}
      </div>
    </details>
  `;

  const watermarkSection = `
    <details class="ac-accordion">
      <summary>Metadaten &amp; Wasserzeichen</summary>
      <div class="ac-accordion-body">
        ${renderWatermarks(details)}
      </div>
    </details>
  `;

  const technicalSection = `
    <details class="ac-accordion">
      <summary>Technische Details</summary>
      <div class="ac-accordion-body">
        ${renderTechnical(summary, details, engines, expertMode)}
      </div>
    </details>
  `;

  return `
    <div class="ac-report-surface ac-animate-in">
      ${summaryCard}
      <div class="ac-report-accordion">
        ${detectorsSection}
        ${provenanceSection}
        ${watermarkSection}
        ${technicalSection}
      </div>
    </div>
  `;
}

export function updateCreditsUI(auth) {
  if (!creditsLabel && !creditsValue) return;
  if (!auth || !auth.isLoggedIn?.()) {
    if (creditsValue) {
      creditsValue.textContent = '—';
    } else if (creditsLabel) {
      creditsLabel.textContent = '—';
    }
    if (creditsBox) {
      creditsBox.dataset.credits = '';
      creditsBox.classList.remove('is-low', 'is-critical', 'is-animating');
    }
    return;
  }

  const available = (auth.balance && typeof auth.balance.credits_available === 'number')
    ? auth.balance.credits_available
    : null;
  const displayValue = (typeof available === 'number') ? String(available) : '...';

  const prevRaw = creditsBox?.dataset?.credits ?? '';
  const prevValue = prevRaw === '' ? null : Number(prevRaw);

  if (creditsValue) {
    creditsValue.textContent = displayValue;
  } else if (creditsLabel) {
    creditsLabel.textContent = (typeof available === 'number') ? `${displayValue} Credits` : displayValue;
  }

  if (creditsBox) {
    creditsBox.classList.remove('is-low', 'is-critical');
    if (typeof available === 'number') {
      if (available < 5) creditsBox.classList.add('is-critical');
      else if (available < 20) creditsBox.classList.add('is-low');
    }
  }

  if (typeof available === 'number') {
    if (creditsBox) creditsBox.dataset.credits = String(available);
    if (creditsBox && typeof prevValue === 'number' && prevValue !== available) {
      creditsBox.classList.remove('is-animating');
      void creditsBox.offsetWidth;
      creditsBox.classList.add('is-animating');
      window.setTimeout(() => creditsBox.classList.remove('is-animating'), 180);
    }
  } else if (creditsBox) {
    creditsBox.dataset.credits = '';
  }

  // --- Sidebar-Credits-Card aktualisieren ---
  const cardEl = document.getElementById('sidebarCreditsCard');
  const cardValueEl = document.getElementById('sidebarCreditsValue');
  const cardPlanEl = document.getElementById('sidebarCreditsPlan');
  const cardBarEl = document.getElementById('sidebarCreditsBar');
  const cardResetEl = document.getElementById('sidebarCreditsReset');

  if (!cardEl) return;

  const loggedIn = auth?.isLoggedIn?.() === true;
  cardEl.hidden = !loggedIn;

  if (!loggedIn) return;

  if (cardValueEl) cardValueEl.textContent = (typeof available === 'number') ? String(available) : '—';

  const planRaw = auth.balance?.plan_type || auth.user?.plan_type || 'free';
  const planLabel = planRaw ? `${planRaw.charAt(0).toUpperCase()}${planRaw.slice(1)}` : 'Free';
  if (cardPlanEl) cardPlanEl.textContent = planLabel;

  const resetAt = auth.balance?.last_credit_reset || auth.user?.last_credit_reset || null;
  if (cardResetEl) cardResetEl.textContent = resetAt ? formatDate(resetAt) : '—';

  // Fortschrittsbalken
  if (cardBarEl) {
    const total = typeof auth.user?.credits_total === 'number' ? auth.user.credits_total : 100;
    const used = typeof auth.user?.credits_used === 'number' ? auth.user.credits_used : (total - (available ?? total));
    const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((used / total) * 100))) : 0;
    cardBarEl.style.width = `${pct}%`;
    cardBarEl.classList.remove('is-low', 'is-critical');
    if (typeof available === 'number') {
      if (available < 5) cardBarEl.classList.add('is-critical');
      else if (available < 20) cardBarEl.classList.add('is-low');
    }
  }
}

export function updateAnalyzeButtons(auth, isAnalyzing = currentAnalyzing) {
  currentAnalyzing = !!isAnalyzing;
  const buttons = $$('.ac-primary[data-kind]');
  buttons.forEach((btn) => {
    const kind = btn.dataset.kind || 'image';
    const cost = getAnalysisCost(kind);
    const isLoggedIn = auth?.isLoggedIn?.() === true;
    const guestAllowed = auth?.canUseGuest?.() === true;
    const emailVerified = auth?.isEmailVerified?.() !== false;
    const balanceCredits = typeof auth?.balance?.credits_available === 'number'
      ? auth.balance.credits_available
      : (
          (typeof auth?.user?.credits_total === 'number' && typeof auth?.user?.credits_used === 'number')
            ? Math.max(0, auth.user.credits_total - auth.user.credits_used)
            : null
        );
    const hasUserCredits = (typeof balanceCredits === 'number' ? balanceCredits >= cost : true);

    let tooltip = '';
    if (currentAnalyzing) {
      tooltip = 'Analyse läuft...';
    } else if (!isLoggedIn && !guestAllowed) {
      tooltip = 'Gastmodus deaktiviert. Bitte einloggen.';
    } else if (isLoggedIn && !emailVerified) {
      tooltip = 'Bitte E-Mail bestätigen – Analysen sind gesperrt.';
    } else if (isLoggedIn && !hasUserCredits) {
      tooltip = 'Nicht genug Credits.';
    }

    const locked = !!tooltip;
    btn.dataset.locked = locked ? 'true' : 'false';
    btn.dataset.state = locked ? 'blocked' : 'ready';
    if (locked) {
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
  });
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '--';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const precision = size >= 10 ? 1 : 2;
  return `${size.toFixed(precision).replace('.', ',')} ${units[unitIndex]}`;
}

function truncateFileName(name, maxLength = 34) {
  const safe = String(name || '').trim();
  if (!safe) return '';
  if (safe.length <= maxLength) return safe;
  const lastDot = safe.lastIndexOf('.');
  const ext = lastDot > 0 ? safe.slice(lastDot) : '';
  const baseMax = Math.max(10, maxLength - ext.length - 1);
  const base = safe.slice(0, baseMax);
  return `${base}…${ext}`;
}

function truncateText(value, maxLength = 42) {
  const safe = String(value || '').trim();
  if (!safe) return '';
  if (safe.length <= maxLength) return safe;
  return `${safe.slice(0, Math.max(8, maxLength - 1))}…`;
}

function setLastPreviewForKind(kind, mode, linkValue) {
  if (!kind) return;
  const existing = lastPreviewByKind[kind];
  if (existing?.url) {
    try {
      URL.revokeObjectURL(existing.url);
    } catch (err) {
      // ignore revoke errors
    }
  }
  if (mode === 'link') {
    const trimmed = String(linkValue || '').trim();
    lastPreviewByKind[kind] = { mode: 'link', link: trimmed || '' };
    return;
  }
  const input = document.querySelector(`#${kind}Input`);
  const file = input?.files?.[0];
  if (!file) {
    lastPreviewByKind[kind] = null;
    return;
  }
  const url = URL.createObjectURL(file);
  lastPreviewByKind[kind] = {
    mode: 'file',
    url,
    type: file.type || '',
    name: file.name || '',
  };
}

function setAnalyzeButtonLoading(button, loading) {
  if (!button) return;
  let labelNode = button.querySelector('.ac-btn-label');
  const spinnerNode = button.querySelector('.ac-btn-spinner');
  const currentLabel = labelNode ? labelNode.textContent : button.textContent.trim();
  if (!button.dataset.label && currentLabel) {
    button.dataset.label = currentLabel;
  }
  if (!labelNode || !spinnerNode) {
    const label = button.dataset.label || currentLabel || 'Analyse starten';
    button.dataset.label = label;
    button.innerHTML = `
      <span class="ac-btn-label">${escapeHtml(label)}</span>
      <span class="ac-btn-spinner" aria-hidden="true"></span>
    `;
    labelNode = button.querySelector('.ac-btn-label');
  }
  if (loading) {
    button.classList.add('is-loading');
    if (labelNode) labelNode.textContent = 'Analyse läuft…';
  } else {
    button.classList.remove('is-loading');
    if (labelNode) labelNode.textContent = button.dataset.label || 'Analyse starten';
  }
}

function renderAnalyzeSteps(current = 'analysis') {
  const steps = ['upload', 'analysis', 'report'];
  const labels = {
    upload: 'Upload',
    analysis: 'Analyse',
    report: 'Bericht',
  };
  const currentIndex = steps.indexOf(current);
  return `
    <div class="ac-status-steps" role="list">
      ${steps.map((step, idx) => {
        const stateClass = idx < currentIndex ? 'is-done' : (idx === currentIndex ? 'is-active' : '');
        return `
          <span class="ac-status-step ${stateClass}">${labels[step]}</span>
          ${idx < steps.length - 1 ? '<span class="ac-status-sep">→</span>' : ''}
        `;
      }).join('')}
    </div>
  `;
}

function setAnalyzeStatus(state, { title, message, tone = 'info', progress = false } = {}) {
  if (state !== 'loading' && activeAnalyzeButton) {
    setAnalyzeButtonLoading(activeAnalyzeButton, false);
    activeAnalyzeButton = null;
  }
  if (!analysisStatus) analysisStatus = document.querySelector('#analysisStatus');
  if (!analysisArea) analysisArea = document.querySelector('#analysisArea');
  if (!analysisStatus) return;
  if (analysisTool) analysisTool.dataset.state = state || '';
  if (state === 'loading' && progress) {
    analysisStatus.innerHTML = '';
    analysisStatus.hidden = true;
    if (analysisArea) analysisArea.classList.remove('is-hidden');
    return;
  }
  if (state === 'success') {
    analysisStatus.innerHTML = '';
    analysisStatus.hidden = true;
    if (analysisArea) analysisArea.classList.remove('is-hidden');
    return;
  }
  if (state === 'idle') {
    analysisStatus.innerHTML = '';
    analysisStatus.hidden = true;
    if (analysisArea) analysisArea.classList.add('is-hidden');
    return;
  }
  analysisStatus.hidden = false;
  const toneClass = tone ? `is-${tone}` : '';
  const stepsHtml = '';
  const subline = message || (state === 'loading' ? 'Bitte warten' : '');
  analysisStatus.innerHTML = `
    <div class="ac-status-card ${toneClass}">
      <div class="ac-status-title">${escapeHtml(title || 'Status')}</div>
      ${subline ? `<div class="ac-status-sub">${escapeHtml(subline)}</div>` : ''}
      ${stepsHtml}
      ${progress ? `
        <div class="ac-progress" role="progressbar" aria-label="Analyse läuft" aria-busy="true">
          <div class="ac-progress-track">
            <div class="ac-progress-bar"></div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
  if (analysisArea) analysisArea.classList.add('is-hidden');
}

function deriveAnalyzeStatus(rawText) {
  const t = String(rawText || '').toLowerCase()
    .replace(/ae/g, 'ä')
    .replace(/oe/g, 'ö')
    .replace(/ue/g, 'ü');
  if (!t) return { state: 'idle' };
  if (t.includes('analyse läuft')) {
    return {
      state: 'loading',
      title: 'Analyse läuft…',
      message: 'Bitte warten',
      tone: 'info',
      progress: true,
    };
  }
  if (t.includes('login erforderlich') || t.includes('gastmodus ist deaktiviert')) {
    return {
      state: 'blocked',
      title: 'Login erforderlich',
      message: 'Bitte einloggen oder registrieren, um die Analyse zu starten.',
      tone: 'warning',
    };
  }
  if (t.includes('e-mail nicht')) {
    return {
      state: 'blocked',
      title: 'E-Mail nicht bestätigt',
      message: 'Bitte E-Mail bestätigen – ohne Verifikation sind Analysen gesperrt.',
      tone: 'warning',
    };
  }
  if (t.includes('nicht genug credits')) {
    return {
      state: 'blocked',
      title: 'Nicht genug Credits',
      message: 'Bitte upgraden oder bis zum nächsten Reset warten.',
      tone: 'warning',
    };
  }
  if (t.includes('datei auswählen')) {
    return {
      state: 'info',
      title: 'Datei auswählen',
      message: 'Bitte zuerst eine Datei auswählen.',
      tone: 'info',
    };
  }
  if (t.includes('link eingeben')) {
    return {
      state: 'info',
      title: 'Link eingeben',
      message: 'Bitte einen gültigen Link eingeben.',
      tone: 'info',
    };
  }
  if (t.includes('nur http/https')) {
    return {
      state: 'info',
      title: 'Ungültiger Link',
      message: 'Bitte einen gültigen http- oder https-Link verwenden.',
      tone: 'info',
    };
  }
  if (t.includes('link-analyse') || (t.includes('link') && t.includes('nur') && t.includes('video'))) {
    return {
      state: 'info',
      title: 'Link-Analyse nur für Video',
      message: 'Link-Analysen sind aktuell nur für Video verfügbar.',
      tone: 'info',
    };
  }
  if (t.includes('zu viele versuche')) {
    return {
      state: 'error',
      title: 'Zu viele Versuche',
      message: 'Bitte kurz warten und erneut versuchen.',
      tone: 'error',
    };
  }
  if (t.includes('zeitüberschreitung') || t.includes('verbindung')) {
    return {
      state: 'error',
      title: 'Verbindung fehlgeschlagen',
      message: 'Bitte erneut versuchen.',
      tone: 'error',
    };
  }
  if (t.includes('fehler') || t.includes('fehlgeschlagen')) {
    return {
      state: 'error',
      title: 'Analyse fehlgeschlagen',
      message: 'Bitte erneut versuchen.',
      tone: 'error',
    };
  }
  return {
    state: 'info',
    title: 'Hinweis',
    message: 'Bitte Eingabe prüfen und erneut versuchen.',
    tone: 'info',
  };
}

function updateFilePreview(kind) {
  const input = document.querySelector(`#${kind}Input`);
  const preview = document.querySelector(`.ac-file-preview[data-kind="${kind}"]`);
  const dropzone = document.querySelector(`.ac-dropzone[data-kind="${kind}"]`);
  if (!dropzone || !input) return;
  const selected = dropzone.querySelector('.ac-dropzone-selected');
  const file = input.files && input.files[0] ? input.files[0] : null;
  const existingUrl = analyzePreviewUrls.get(kind);
  if (existingUrl) {
    URL.revokeObjectURL(existingUrl);
    analyzePreviewUrls.delete(kind);
  }
  if (preview) {
    preview.innerHTML = '';
    preview.classList.add('is-empty');
  }
  if (!selected) return;
  if (!file) {
    dropzone.classList.remove('has-file');
    selected.innerHTML = '';
    selected.setAttribute('aria-hidden', 'true');
    return;
  }

  dropzone.classList.add('has-file');
  selected.setAttribute('aria-hidden', 'false');
  const name = file.name || 'Datei';
  const sizeLabel = formatBytes(file.size);
  const displayName = truncateFileName(name);
  const isImage = file.type.startsWith('image/') || kind === 'image';
  const isAudio = file.type.startsWith('audio/') || kind === 'audio';
  const isVideo = file.type.startsWith('video/') || kind === 'video';
  let mediaHtml = `<div class="ac-file-icon" aria-hidden="true">${mediaIconSvg(kind)}</div>`;

  if (isImage || isAudio || isVideo) {
    const url = URL.createObjectURL(file);
    analyzePreviewUrls.set(kind, url);
    if (isImage) {
      mediaHtml = `<img class="ac-file-thumb" src="${url}" alt="Vorschau" />`;
    } else if (isAudio) {
      mediaHtml = `<audio class="ac-file-player" controls src="${url}"></audio>`;
    } else if (isVideo) {
      mediaHtml = `<video class="ac-file-player" controls src="${url}"></video>`;
    }
  }

  const safeName = escapeHtml(name);
  selected.innerHTML = `
    <div class="ac-dropzone-media">${mediaHtml}</div>
    <div class="ac-dropzone-meta">
      <div class="ac-dropzone-label">Datei ausgewählt</div>
      <div class="ac-dropzone-name" title="${safeName}">${escapeHtml(displayName || 'Datei')}</div>
      <div class="ac-dropzone-info">
        <span>${escapeHtml(sizeLabel)}</span>
        <span class="ac-dropzone-hint">Zum Austauschen klicken</span>
      </div>
    </div>
    <button type="button" class="ac-dropzone-remove" aria-label="Datei entfernen">×</button>
  `;
}

function setupAnalyzeToolUI() {
  if (analyzeUiBound) return;
  analyzeUiBound = true;
  if (!analysisTool) return;

  const fileInputs = {
    image: $('#imageInput'),
    video: $('#videoInput'),
    audio: $('#audioInput'),
  };

  const clearSelectedFile = (kind, input) => {
    if (!input) return;
    input.value = '';
    updateFilePreview(kind);
    setAnalyzeStatus('idle');
  };
  const clearAnalysisView = () => {
    if (analysisArea) {
      analysisArea.innerHTML = '<div id="resultMount"></div>';
      analysisArea.classList.add('is-hidden');
      delete analysisArea.dataset.scrollPending;
    }
    setAnalyzeStatus('idle');
  };
  const restoreAnalysisView = (kind) => {
    const stored = kind ? lastResultsByKind[kind] : null;
    if (!analysisArea || !stored) {
      clearAnalysisView();
      return false;
    }
    setAnalyzeStatus('idle');
    analysisArea.innerHTML = stored;
    analysisArea.classList.remove('is-hidden');
    return true;
  };

  $$('.ac-media-card[data-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('ac-active')) return;
      const oldKind = getActiveMediaKind();
      if (oldKind && analysisAreaHasResult()) {
        lastResultsByKind[oldKind] = analysisArea.innerHTML;
      }
      clearAnalysisView();
      window.setTimeout(() => {
        const newKind = getActiveMediaKind();
        restoreAnalysisView(newKind);
        updateQuickMediaButtons(newKind);
      }, 0);
    });
  });


  $$('.ac-dropzone').forEach((zone) => {
    const kind = zone.dataset.kind;
    const input = kind ? fileInputs[kind] : null;
    if (!input) return;
    const activate = () => input.click();
    zone.addEventListener('click', (event) => {
      const removeBtn = event.target?.closest?.('.ac-dropzone-remove');
      if (removeBtn) {
        event.preventDefault();
        event.stopPropagation();
        clearSelectedFile(kind, input);
        return;
      }
      if (event.target?.closest?.('audio, video')) {
        return;
      }
      event.preventDefault();
      activate();
    });
    zone.addEventListener('keydown', (event) => {
      if (event.target?.closest?.('.ac-dropzone-remove')) return;
      if (event.target?.closest?.('audio, video')) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate();
      }
    });
    ['dragenter', 'dragover'].forEach((evt) => {
      zone.addEventListener(evt, (event) => {
        event.preventDefault();
        zone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'dragend'].forEach((evt) => {
      zone.addEventListener(evt, (event) => {
        event.preventDefault();
        zone.classList.remove('is-dragover');
      });
    });
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('is-dragover');
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  Object.entries(fileInputs).forEach(([kind, input]) => {
    if (!input) return;
    input.addEventListener('change', () => {
      updateFilePreview(kind);
      if (analysisArea?.classList.contains('is-hidden')) {
        setAnalyzeStatus('idle');
      }
    });
  });

  Object.keys(fileInputs).forEach((kind) => updateFilePreview(kind));

  $$('.analyze-btn.ac-primary[data-kind]').forEach((btn) => {
    if (!btn.querySelector('.ac-btn-spinner')) {
      const label = btn.textContent.trim() || 'Analyse starten';
      btn.dataset.label = label;
      btn.innerHTML = `
        <span class="ac-btn-label">${escapeHtml(label)}</span>
        <span class="ac-btn-spinner" aria-hidden="true"></span>
      `;
    }
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const nextKind = btn.dataset.kind || getActiveMediaKind();
      const nextMode = btn.dataset.mode || 'file';
      if (nextKind) {
        currentAnalyzeKind = nextKind;
        lastResultsByKind[nextKind] = null;
        if (nextMode === 'link') {
          const linkInput = document.querySelector(`#${nextKind}Url`);
          setLastPreviewForKind(nextKind, 'link', linkInput?.value);
        } else {
          setLastPreviewForKind(nextKind, 'file');
        }
      }
      activeAnalyzeButton = btn;
      setAnalyzeButtonLoading(btn, true);
      setAnalyzeStatus('loading', {
        title: 'Analyse läuft…',
        message: 'Bitte warten',
        tone: 'info',
        progress: true,
      });
      if (analysisArea) analysisArea.dataset.scrollPending = 'true';
    }, true);
  });

    if (analysisArea) {
      const observer = new MutationObserver(() => {
        const hasResult = !!analysisArea.querySelector('.ac-report-surface, .ac-result-card, .ac-result-error, .ac-card');
        if (hasResult) {
          const kindForResult = currentAnalyzeKind || getActiveMediaKind();
          if (kindForResult) {
            lastResultsByKind[kindForResult] = analysisArea.innerHTML;
          }
          currentAnalyzeKind = null;
          const activeKind = getActiveMediaKind();
          if (!kindForResult || kindForResult === activeKind) {
            setAnalyzeStatus('success');
          if (analysisArea.dataset.scrollPending === 'true') {
            delete analysisArea.dataset.scrollPending;
            analysisArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } else {
          setAnalyzeStatus('idle');
        }
        return;
      }
      const text = analysisArea.textContent || '';
      if (!text.trim()) {
        setAnalyzeStatus('idle');
        return;
      }
      const status = deriveAnalyzeStatus(text);
      setAnalyzeStatus(status.state, status);
    });
    observer.observe(analysisArea, { childList: true, subtree: true });
  }
}

function bindReportCopy() {
  if (reportCopyBound) return;
  reportCopyBound = true;
  const writeClipboard = async (text) => {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch (err) {
      return false;
    }
  };

  const applyButtonFeedback = (button, label, defaultLabel) => {
    const original = button.dataset.label || button.textContent.trim();
    button.dataset.label = original;
    button.textContent = label;
    button.classList.add('is-copied');
    window.setTimeout(() => {
      button.textContent = button.dataset.label || defaultLabel;
      button.classList.remove('is-copied');
    }, 1200);
  };

  document.addEventListener('click', async (event) => {
    const shareBtn = event.target?.closest?.('.ac-report-share');
    if (shareBtn && !shareBtn.disabled) {
      const id = shareBtn.dataset.shareId;
      if (!id) return;
      const baseUrl = (window.location.href || '').split('#')[0];
      const shareUrl = `${baseUrl}#analysis=${encodeURIComponent(id)}`;
      if (typeof navigator?.share === 'function') {
        try {
          await navigator.share({
            title: 'AIRealCheck Analyse',
            text: 'Analysebericht',
            url: shareUrl,
          });
          return;
        } catch (err) {
          // fall back to clipboard
        }
      }
      try {
        const copied = await writeClipboard(shareUrl);
        if (copied) {
          applyButtonFeedback(shareBtn, 'Link kopiert', 'Teilen');
        }
      } catch (err) {
        // ignore clipboard errors
      }
      return;
    }

    const btn = event.target?.closest?.('.ac-report-copy');
    if (!btn || btn.disabled) return;
    const id = btn.dataset.copyId;
    if (!id) return;
    try {
      const copied = await writeClipboard(id);
      if (copied) {
        applyButtonFeedback(btn, 'Kopiert', 'Kopieren');
      }
    } catch (err) {
      // ignore clipboard errors
    }
  });
}

function updateVerifyBanner(auth) {
  const needsVerify = auth?.isLoggedIn?.() === true && auth?.user && auth.user.email_verified === false;
  if (emailVerifyBanner) emailVerifyBanner.classList.toggle('ac-hide', !needsVerify);
  if (profileVerifyBanner) profileVerifyBanner.classList.toggle('ac-hide', !needsVerify);
  if (!needsVerify) {
    if (resendVerifyStatus) {
      resendVerifyStatus.textContent = '';
      resendVerifyStatus.hidden = true;
      resendVerifyStatus.dataset.tone = '';
    }
    if (profileResendVerifyStatus) {
      profileResendVerifyStatus.textContent = '';
      profileResendVerifyStatus.hidden = true;
      profileResendVerifyStatus.dataset.tone = '';
    }
  }
}

function updateAnalysisGateNotice(auth) {
  if (!analysisGateNotice) return;
  const isLoggedIn = auth?.isLoggedIn?.() === true;
  const guestAllowed = auth?.canUseGuest?.() === true;
  if (isLoggedIn) {
    analysisGateNotice.classList.add('ac-hide');
    analysisGateNotice.innerHTML = '';
    return;
  }
  if (guestAllowed) {
    analysisGateNotice.classList.remove('ac-hide');
    analysisGateNotice.innerHTML = `
      <div class="ac-banner-icon">i</div>
      <div class="ac-banner-body">
        <div class="ac-banner-title">Gastmodus aktiv</div>
        <div class="ac-banner-text">Analysen werden nicht gespeichert. Melde dich an, um Verlauf und Credits zu nutzen.</div>
        <div class="ac-banner-actions">
          <button type="button" class="ac-ghost ac-banner-btn" data-link="/login">Anmelden</button>
          <button type="button" class="ac-primary ac-banner-btn" data-link="/register">Konto erstellen</button>
        </div>
      </div>
    `;
    return;
  }
  analysisGateNotice.classList.remove('ac-hide');
  analysisGateNotice.innerHTML = `
    <div class="ac-banner-icon">!</div>
    <div class="ac-banner-body">
      <div class="ac-banner-title">Analyse nur mit Konto</div>
      <div class="ac-banner-text">Der Gastmodus ist deaktiviert. Bitte melde dich an oder registriere dich.</div>
      <div class="ac-banner-actions">
        <button type="button" class="ac-ghost ac-banner-btn" data-link="/login">Anmelden</button>
        <button type="button" class="ac-primary ac-banner-btn" data-link="/register">Konto erstellen</button>
      </div>
    </div>
  `;
}

function setResendStatus(message, tone = 'info') {
  const targets = [resendVerifyStatus, profileResendVerifyStatus].filter(Boolean);
  targets.forEach((el) => {
    el.textContent = message || '';
    el.hidden = !message;
    if (tone) el.dataset.tone = tone;
  });
}

function bindResendVerify(auth) {
  if (resendVerifyBound) return;
  resendVerifyBound = true;
  const buttons = [resendVerifyBtn, profileResendVerifyBtn].filter(Boolean);
  if (!buttons.length) return;
  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!auth?.isLoggedIn?.()) {
        setResendStatus('Bitte zuerst einloggen.', 'error');
        auth?.navigate?.('/login');
        return;
      }
      if (btn.dataset.loading === 'true') return;
      const original = btn.dataset.label || btn.textContent;
      btn.dataset.label = original;
      btn.dataset.loading = 'true';
      btn.textContent = 'Sende...';
      btn.disabled = true;
      setResendStatus('');
      try {
        const result = await auth.resendVerify?.();
        if (result?.already_verified) {
          setResendStatus('E-Mail ist bereits bestätigt.', 'success');
        } else {
          setResendStatus('Bestätigungs-E-Mail wurde versendet.', 'success');
        }
      } catch (err) {
        const code = err?.response?.error;
        if (code === 'smtp_not_configured') {
          setResendStatus('E-Mail-Versand ist in dieser Umgebung nicht aktiv.', 'error');
        } else if (code === 'rate_limited' || err?.status === 429) {
          setResendStatus('Zu viele Versuche. Bitte später erneut senden.', 'error');
        } else {
          setResendStatus('Versand fehlgeschlagen. Bitte später erneut versuchen.', 'error');
        }
      } finally {
        btn.dataset.loading = 'false';
        btn.textContent = btn.dataset.label || original;
        btn.disabled = false;
      }
    });
  });
}

export function updateProfileView(auth) {
  const isLoggedIn = auth?.isLoggedIn?.() === true;
  const email = auth?.user?.email ?? null;
  const displayName = auth?.user?.display_name || auth?.user?.name || null;
  const initialSource = displayName || email || 'A';

  if (profileAvatar) {
    if (isLoggedIn && email) {
      profileTrigger?.classList.remove('login-mode');
      profileAvatar.textContent = initialSource.charAt(0).toUpperCase();
    } else {
      profileTrigger?.classList.add('login-mode');
      profileAvatar.textContent = 'Login';
    }
    profileTrigger?.setAttribute('aria-expanded', 'false');
  }
  if (profileTrigger) {
    if (isLoggedIn) {
      profileTrigger.removeAttribute('data-link');
    } else {
      profileTrigger.setAttribute('data-link', '/login');
    }
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

  if (profileName) profileName.textContent = displayName || email || '-';
  profileEmail.textContent = email ?? '-';
  const planTypeRaw = (auth.balance?.plan_type || auth.user?.plan_type || 'free');
  const planType = planTypeRaw ? `${planTypeRaw.charAt(0).toUpperCase()}${planTypeRaw.slice(1)}` : 'Free';
  profilePlan.textContent = planType;

  if (profileBadge) {
    profileBadge.textContent = initialSource.charAt(0).toUpperCase();
  }

  const creditsValue = (typeof auth?.balance?.credits_available === 'number')
    ? auth.balance.credits_available
    : (
        (typeof auth?.user?.credits_total === 'number' && typeof auth?.user?.credits_used === 'number')
          ? Math.max(0, auth.user.credits_total - auth.user.credits_used)
          : '0'
      );

  profileCredits.textContent = creditsValue;

  const resetAt = auth.balance?.last_credit_reset || auth.user?.last_credit_reset || null;
  profileReset.textContent = resetAt ? formatDateTime(resetAt) : '—';

  const subscriptionActive = auth.balance?.subscription_active ?? auth.user?.subscription_active;
  profilePremium.textContent = subscriptionActive ? 'Ja' : 'Nein';
  if (profileVerified) {
    profileVerified.textContent = auth.user?.email_verified ? 'Ja' : 'Nein';
  }

  const createdAt = auth.user?.created_at
    ? formatDate(auth.user.created_at)
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
    auth.setNotice?.('Bitte zuerst einloggen.', 'info');
    auth.navigate?.('/login');
    return;
  }
  updateProfileView(auth);
  showPage('profile');
}

function historyStatusInfo(status) {
  const raw = String(status || '').toLowerCase();
  if (raw === 'success' || raw === 'done') return { label: 'Erfolgreich', className: 'success' };
  if (raw === 'failed' || raw === 'error') return { label: 'Fehlgeschlagen', className: 'failed' };
  if (raw === 'running' || raw === 'pending') return { label: 'Läuft', className: 'running' };
  return { label: raw ? raw : 'Unbekannt', className: 'running' };
}

function renderStatusBadge(status) {
  const info = historyStatusInfo(status);
  return `<span class="ac-history-status ${info.className}">${info.label}</span>`;
}

function scoreClassFor(value) {
  if (typeof value !== 'number') return 'score-medium';
  if (value >= 70) return 'score-high';
  if (value >= 31) return 'score-medium';
  return 'score-low';
}

function renderHistorySkeleton(count = 4) {
  return Array.from({ length: count })
    .map(() => `
      <div class="ac-history-skeleton">
        <div class="ac-history-skeleton-line"></div>
        <div class="ac-history-skeleton-line"></div>
        <div class="ac-history-skeleton-line"></div>
      </div>
    `)
    .join('');
}

function renderHistoryItem(item) {
  const title = item?.title || 'Analyse';
  const verdict = item?.verdict_label || 'Ergebnis';
  const scoreValue = (typeof item?.final_score === 'number') ? Math.round(item.final_score) : null;
  const score = (scoreValue !== null) ? `${scoreValue}% KI` : '—';
  const scoreClass = scoreClassFor(scoreValue);
  const createdAt = formatDateTime(item?.created_at);
  const credits = (typeof item?.credits_charged === 'number') ? `${item.credits_charged} Credits` : '—';
  const mediaIcon = mediaIconSvg(item?.media_type);
  const statusBadge = renderStatusBadge(item?.status);
  return `
    <button class="ac-history-item history-item" type="button" data-history-id="${escapeHtml(item?.id || '')}">
      <div class="ac-history-icon">${mediaIcon}</div>
      <div class="ac-history-main">
        <div class="ac-history-title">${escapeHtml(title)}</div>
        <div class="ac-history-meta">
          <span>${escapeHtml(createdAt)}</span>
          <span class="history-meta-sep">•</span>
          <span>${escapeHtml(credits)}</span>
          <span class="history-meta-sep">•</span>
          ${statusBadge}
        </div>
        <div class="ac-history-verdict">${escapeHtml(verdict)}</div>
      </div>
      <div class="history-item-right">
        <span class="score-badge ${scoreClass}">${escapeHtml(score)}</span>
        <span class="ac-history-arrow" aria-hidden="true">›</span>
      </div>
    </button>
  `;
}

function historyMatchesFilter(item) {
  if (historyFilterValue === 'all') return true;
  const type = String(item?.media_type || '').toLowerCase();
  return type === historyFilterValue;
}

function detectAiInHistory(item) {
  const label = String(item?.verdict_label || '').toLowerCase();
  if (label.includes('ki')) return true;
  const score = Number(item?.final_score);
  if (Number.isFinite(score) && score >= 60) return true;
  return false;
}

function updateHistoryStats(items) {
  if (!historyStatsTotal && !historyStatsAi) return;
  const now = Date.now();
  const windowStart = now - (7 * 24 * 60 * 60 * 1000);
  let total = 0;
  let aiCount = 0;
  items.forEach((item) => {
    const ts = Date.parse(item?.created_at || '');
    if (!Number.isFinite(ts)) return;
    if (ts < windowStart) return;
    total += 1;
    if (detectAiInHistory(item)) aiCount += 1;
  });
  if (historyStatsTotal) historyStatsTotal.textContent = String(total);
  if (historyStatsAi) historyStatsAi.textContent = String(aiCount);
}

function renderHistoryEmpty(title, text) {
  const heading = title || 'Noch keine Analysen';
  const message = text || 'Starte deine erste Prüfung.';
  return `
    <div class="ac-history-empty">
      <div class="history-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
        </svg>
      </div>
      <div>
        <div class="history-empty-title">${escapeHtml(heading)}</div>
        <div class="history-empty-text">${escapeHtml(message)}</div>
      </div>
    </div>
  `;
}

function updateHistoryFilterButtons() {
  if (!historyFilterBar) return;
  const buttons = Array.from(historyFilterBar.querySelectorAll('.filter'));
  buttons.forEach((btn) => {
    const value = btn.dataset.filter || 'all';
    btn.classList.toggle('active', value === historyFilterValue);
  });
}

function bindHistoryFilters(auth) {
  if (historyFilterBound || !historyFilterBar) return;
  historyFilterBound = true;
  historyFilterBar.addEventListener('click', (event) => {
    const btn = event.target.closest('.filter');
    if (!btn) return;
    const value = btn.dataset.filter || 'all';
    if (value === historyFilterValue) return;
    historyFilterValue = value;
    updateHistoryFilterButtons();
    renderHistory(auth, { force: false, skipFetch: true });
  });
}

function renderHistoryDetailSkeleton() {
  return `
    <div class="ac-history-skeleton">
      <div class="ac-history-skeleton-line"></div>
      <div class="ac-history-skeleton-line"></div>
      <div class="ac-history-skeleton-line"></div>
    </div>
  `;
}

function openHistoryDrawer() {
  historyDrawer?.classList.add('open');
  historyDrawer?.setAttribute('aria-hidden', 'false');
  historyDrawerBackdrop?.classList.add('show');
  historyDrawerBackdrop?.setAttribute('aria-hidden', 'false');
}

function closeHistoryDrawer() {
  historyDrawer?.classList.remove('open');
  historyDrawer?.setAttribute('aria-hidden', 'true');
  historyDrawerBackdrop?.classList.remove('show');
  historyDrawerBackdrop?.setAttribute('aria-hidden', 'true');
  activeHistoryId = null;
  activeHistoryPayload = null;
  if (historyDetailBadge) historyDetailBadge.innerHTML = '';
  if (historyDetailCopy) {
    historyDetailCopy.disabled = true;
    historyDetailCopy.textContent = canCopyDetails ? 'Details kopieren' : 'Kopieren nicht verfügbar';
    historyDetailCopy.classList.remove('is-copied');
  }
  document.querySelectorAll('.ac-history-item.is-selected, .ac-history-item.is-active').forEach((el) => {
    el.classList.remove('is-selected', 'is-active');
  });
}

function setActiveHistoryItem(historyId) {
  document.querySelectorAll('.ac-history-item').forEach((el) => {
    const isSelected = el.dataset.historyId === historyId;
    el.classList.toggle('is-selected', isSelected);
    el.classList.toggle('is-active', isSelected);
  });
}

async function openHistoryDetail(auth, historyId) {
  if (!historyId || historyDetailLoading) return;
  historyDetailLoading = true;
  activeHistoryId = historyId;
  setActiveHistoryItem(historyId);
  openHistoryDrawer();
  if (historyDetailTitle) historyDetailTitle.textContent = 'Details laden...';
  if (historyDetailMeta) historyDetailMeta.textContent = '';
  if (historyDetailBadge) historyDetailBadge.innerHTML = '';
  if (historyDetailCopy) {
    historyDetailCopy.disabled = true;
    historyDetailCopy.textContent = canCopyDetails ? 'Details kopieren' : 'Kopieren nicht verfügbar';
    historyDetailCopy.classList.remove('is-copied');
  }
  activeHistoryPayload = null;
  if (historyDetailBody) historyDetailBody.innerHTML = renderHistoryDetailSkeleton();
  try {
    const payload = await auth.apiFetch(`/api/history/${historyId}`);
    renderHistoryDetail(payload);
  } catch (err) {
    if (err?.status === 401) {
      await auth.logout('Bitte erneut einloggen.');
      return;
    }
    const msg = err?.response?.error === 'forbidden'
      ? 'Kein Zugriff auf diesen Eintrag.'
      : 'Details konnten nicht geladen werden.';
    if (historyDetailBody) historyDetailBody.innerHTML = `<div class="drawer-empty">${msg}</div>`;
  } finally {
    historyDetailLoading = false;
  }
}

export async function renderHistory(auth, { force = false, skipFetch = false } = {}) {
  const h = $('#historyList');
  if (!h) return;
  if (!auth?.isLoggedIn?.()) {
    h.innerHTML = renderHistoryEmpty('Bitte einloggen', 'Melde dich an, um deinen Verlauf zu sehen.');
    return;
  }
  bindHistoryFilters(auth);
  updateHistoryFilterButtons();
  if (historyLoading) return;
  const renderFromCache = () => {
    const filtered = historyCache.filter(historyMatchesFilter);
    updateHistoryStats(historyCache);
    if (!filtered.length) {
      const message = historyCache.length
        ? 'Keine Einträge für diesen Filter.'
        : 'Starte deine erste Prüfung.';
      h.innerHTML = renderHistoryEmpty('Keine Analysen', message);
      return;
    }
    h.innerHTML = filtered.map(renderHistoryItem).join('');
  };

  if (historyCache.length && !force) {
    renderFromCache();
    if (skipFetch) {
      return;
    }
  } else {
    h.innerHTML = renderHistorySkeleton(4);
  }

  historyLoading = true;
  try {
    const items = await auth.apiFetch('/api/history?limit=20');
    historyCache = Array.isArray(items) ? items : [];
    renderFromCache();
  } catch (err) {
    if (err?.status === 401) {
      await auth.logout('Bitte erneut einloggen.');
      return;
    }
    const msg = err?.response?.error === 'email_not_verified'
      ? 'Bitte E-Mail bestätigen, um den Verlauf zu sehen.'
      : 'Verlauf konnte nicht geladen werden.';
    h.innerHTML = renderHistoryEmpty('Verlauf nicht verfügbar', msg);
  } finally {
    historyLoading = false;
  }

  h.onclick = (event) => {
    const target = event.target.closest('[data-history-id]');
    if (!target) return;
    const historyId = target.dataset.historyId;
    if (!historyId) return;
    openHistoryDetail(auth, historyId);
  };
}

function updateAdminVisibility(auth) {
  const isAdmin = auth?.isAdmin?.() === true;
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
  const navigate = extras?.navigate;
  const router = extras?.router;
  const navigateFn = typeof navigate === 'function'
    ? navigate
    : (typeof auth?.navigate === 'function' ? auth.navigate.bind(auth) : null);
  currentRoute = normalizePath(window.location.pathname || currentRoute);
  setRouteClasses(currentRoute);
  enforceAuthGuard(auth, currentRoute, navigateFn);
  updateHeaderUI(auth, currentRoute);
  updateAnalysisVisibility(auth);

  hamburger?.addEventListener('click', (e) => {
    e.preventDefault();
    const open = sidebar?.classList.toggle('open');
    sidebarOverlay?.classList.toggle('show', !!open);
  });

  const closeSidebar = () => {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('show');
  };

  const handleSidebarClick = (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (actionEl) {
      handleNavAction(actionEl.dataset.action, navigateFn);
      closeSidebar();
      return;
    }
    const linkEl = event.target.closest('[data-link]');
    if (linkEl) closeSidebar();
  };

  sidebarOverlay?.addEventListener('click', () => closeSidebar());
  sidebarNav?.addEventListener('click', handleSidebarClick);
  // Klicks auf Upgrade-CTA und Footer-Links in der Sidebar schließen auf Mobile den Drawer
  document.getElementById('sidebarUpgrade')?.addEventListener('click', () => closeSidebar());
  bottomNav?.addEventListener('click', () => {
    if (sidebar?.classList.contains('open')) closeSidebar();
  });

  // --- Sidebar-Collapse-Logik (nur Desktop, ac-shell Modus) ---
  const SIDEBAR_COLLAPSED_KEY = 'ac_sidebar_collapsed';
  const sidebarToggleBtn = document.getElementById('sidebarToggle');

  const applySidebarCollapse = (collapsed) => {
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed', collapsed);
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
    if (sidebarToggleBtn) {
      sidebarToggleBtn.setAttribute('aria-label', collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen');
    }
  };

  // Initialzustand aus localStorage lesen (auf kleinen Schirmen standardmäßig eingeklappt)
  const isMobileBreakpoint = () => window.matchMedia('(max-width: 900px)').matches;
  const savedCollapse = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
  const startCollapsed = savedCollapse !== null ? savedCollapse === 'true' : isMobileBreakpoint();
  applySidebarCollapse(startCollapsed);

  sidebarToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const nowCollapsed = !sidebar?.classList.contains('collapsed');
    applySidebarCollapse(nowCollapsed);
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(nowCollapsed)); } catch (_) {}
  });

  // Responsiveness: Beim Verkleinern des Fensters unter 900px automatisch einklappen
  const mq = window.matchMedia('(max-width: 900px)');
  mq.addEventListener('change', (evt) => {
    if (evt.matches) {
      // Mobile: Drawer-Modus — collapsed-Klasse entfernen (hat keine Wirkung im Mobile-Modus)
      sidebar?.classList.remove('collapsed');
      document.documentElement.classList.remove('sidebar-collapsed');
    } else {
      // Zurück zu Desktop: gespeicherten Zustand wiederherstellen
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      applySidebarCollapse(saved === 'true');
    }
  });

  profileLogoutBtn?.addEventListener('click', () => auth.logout());

  profileTrigger?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!auth.isLoggedIn()) {
      auth.setNotice?.('Bitte zuerst einloggen.', 'info');
      auth.navigate?.('/login');
      return;
    }
    toggleProfileDropdown();
  });

  profileDropdown?.addEventListener('click', (e) => {
    const action = e.target.closest('button')?.dataset.menu;
    if (!action) return;
    if (action === 'profile' || action === 'credits') {
      if (navigate) navigate('/profile');
      else showProfilePage(auth);
    } else if (action === 'settings') {
      if (navigate) navigate('/settings');
      else showPage('settings');
    } else if (action === 'admin') {
      if (navigate) navigate('/admin');
      else if (typeof onOpenAdmin === 'function') onOpenAdmin();
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
    if (e.key === 'Escape') {
      closeProfileDropdown();
      closeHistoryDrawer();
    }
  });

  historyDetailClose?.addEventListener('click', () => closeHistoryDrawer());
  historyDrawerBackdrop?.addEventListener('click', () => closeHistoryDrawer());
  if (historyDetailCopy) {
    canCopyDetails = !!(navigator?.clipboard?.writeText)
      || (typeof document !== 'undefined'
        && typeof document.queryCommandSupported === 'function'
        && document.queryCommandSupported('copy'));
    historyDetailCopy.disabled = true;
    if (!canCopyDetails) {
      historyDetailCopy.textContent = 'Kopieren nicht verfügbar';
    } else {
      historyDetailCopy.textContent = 'Details kopieren';
    }
    historyDetailCopy.addEventListener('click', () => copyHistoryDetail());
  }

  auth.subscribe(() => {
    updateAnalysisVisibility(auth);
    enforceAuthGuard(auth, currentRoute, navigateFn);
    updateCreditsUI(auth);
    updateProfileView(auth);
    updateAnalyzeButtons(auth);
    updateVerifyBanner(auth);
    updateAnalysisGateNotice(auth);
    updateAdminVisibility(auth);
    updateHeaderUI(auth, currentRoute);
    refreshNavigation(auth);
  });

  setupExpertModeToggle();
  updateCreditsUI(auth);
  updateProfileView(auth);
  updateAnalyzeButtons(auth, false);
  updateVerifyBanner(auth);
  updateAnalysisGateNotice(auth);
  updateAnalysisVisibility(auth);
  updateAdminVisibility(auth);
  updateHeaderUI(auth, currentRoute);
  refreshNavigation(auth);
  bindResendVerify(auth);
  setupAnalyzeToolUI();
  bindReportCopy();
  if (router?.subscribe) {
    router.subscribe((path, route) => {
      currentRoute = path;
      const activeRoute = route || resolveRoute(path);
      updateAnalysisVisibility(auth);
      updateHeaderUI(auth, path);
      if (activeRoute?.key === 'history') {
        renderHistory(auth);
      } else if (activeRoute?.key === 'profile') {
        updateProfileView(auth);
      } else if (activeRoute?.key === 'admin') {
        if (auth?.isAdmin?.() !== true) {
          if (navigateFn) navigateFn('/');
          return;
        }
        if (typeof onOpenAdmin === 'function') onOpenAdmin();
      } else if (activeRoute?.key === 'start') {
        updateQuickMediaButtons();
      }
    });
  }
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
    <label for="expertModeToggle">Expert Mode (Details für Profis)</label>
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

function normalizeHistorySummary(payload) {
  const result = payload?.result_payload || {};
  if (result && typeof result === 'object' && result.summary && typeof result.summary === 'object') {
    return result.summary;
  }
  return (result && typeof result === 'object') ? result : {};
}

function normalizeHistoryPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num >= 0 && num <= 1) return Math.round(num * 100);
  return Math.round(num);
}

function normalizeHistoryEngines(breakdown) {
  if (!breakdown || typeof breakdown !== 'object') return [];
  return Object.entries(breakdown).map(([engine, info]) => {
    let score = null;
    let confidence = null;
    let status = null;
    let available = null;
    if (typeof info === 'number') {
      score = info;
    } else if (info && typeof info === 'object') {
      if (typeof info.score === 'number') score = info.score;
      else if (typeof info.ai_percent === 'number') score = info.ai_percent;
      else if (typeof info.ai === 'number') score = info.ai;
      if (typeof info.confidence === 'number') confidence = info.confidence;
      if (typeof info.status === 'string' && info.status) status = info.status;
      if (typeof info.available === 'boolean') available = info.available;
    }
    const entry = { engine };
    if (typeof score === 'number') entry.ai_percent = score;
    if (typeof confidence === 'number') entry.confidence01 = confidence > 1 ? (confidence / 100) : confidence;
    if (typeof status === 'string') entry.status = status;
    if (typeof available === 'boolean') entry.available = available;
    return entry;
  });
}

function normalizeHistoryConfidence(summary) {
  if (!summary || typeof summary !== 'object') return;
  const hasLabel = typeof summary.confidence_label === 'string' && summary.confidence_label.trim();
  let confidence01 = summary.confidence01;
  if (!Number.isFinite(confidence01)) {
    const raw = summary.confidence;
    if (Number.isFinite(raw)) {
      confidence01 = raw > 1 ? (raw / 100) : raw;
    }
  }
  if (Number.isFinite(confidence01) && !Number.isFinite(summary.confidence01)) {
    summary.confidence01 = confidence01;
  }
  if (!hasLabel && Number.isFinite(confidence01)) {
    if (confidence01 >= 0.7) summary.confidence_label = 'high';
    else if (confidence01 >= 0.4) summary.confidence_label = 'medium';
    else summary.confidence_label = 'low';
  }
}

function inferHistoryVerdictKey(summary, payload, aiPercent) {
  const candidate = summary?.verdict_key || summary?.verdict;
  if (candidate === 'likely_ai' || candidate === 'likely_real' || candidate === 'uncertain') {
    return candidate;
  }
  const label = String(summary?.label_de || payload?.verdict_label || '').toLowerCase();
  if (label.includes('ki') && !label.includes('echt')) return 'likely_ai';
  if (label.includes('echt')) return 'likely_real';
  if (typeof aiPercent === 'number') {
    if (aiPercent >= 70) return 'likely_ai';
    if (aiPercent <= 30) return 'likely_real';
  }
  return 'uncertain';
}

function inferHistoryTrafficLight(verdictKey) {
  if (verdictKey === 'likely_ai') return 'red';
  if (verdictKey === 'likely_real') return 'green';
  return 'yellow';
}

function buildHistoryResultPayload(payload) {
  const summary = Object.assign({}, normalizeHistorySummary(payload));
  const aiPercent = (typeof summary.ai_percent === 'number')
    ? Math.round(summary.ai_percent)
    : normalizeHistoryPercent(
        summary.ai_likelihood ?? summary.final_ai ?? summary.ai ?? payload?.final_score
      );
  if (typeof summary.ai_percent !== 'number' && aiPercent !== null) {
    summary.ai_percent = aiPercent;
  }
  if (typeof summary.real_percent !== 'number' && typeof summary.ai_percent === 'number') {
    summary.real_percent = Math.max(0, 100 - summary.ai_percent);
  }
  if (!Array.isArray(summary.reasons_user)) {
    summary.reasons_user = Array.isArray(summary.reasons) ? summary.reasons : [];
  }
  if (!Array.isArray(summary.warnings_user)) {
    summary.warnings_user = [];
  }
  if (!summary.label_de && payload?.verdict_label) {
    summary.label_de = payload.verdict_label;
  }
  summary.verdict_key = inferHistoryVerdictKey(summary, payload, summary.ai_percent);
  if (!summary.traffic_light) {
    summary.traffic_light = inferHistoryTrafficLight(summary.verdict_key);
  }
  if (typeof summary.conflict !== 'boolean') {
    summary.conflict = false;
  }
  normalizeHistoryConfidence(summary);

  const details = {
    engines: normalizeHistoryEngines(payload?.engine_breakdown),
  };

  return {
    meta: {
      schema_version: 'public_result_v1',
      analysis_id: payload?.id || payload?.analysis_id || null,
      media_type: payload?.media_type || null,
      created_at: payload?.created_at || null,
    },
    summary,
    details,
    status: payload?.status || null,
  };
}


function renderHistoryDetail(payload) {
  const title = payload?.title || payload?.verdict_label || 'Analyse';
  const createdAt = formatDateTime(payload?.created_at);
  const mediaType = formatMediaLabel(payload?.media_type);
  if (historyDetailTitle) historyDetailTitle.textContent = title;
  if (historyDetailMeta) historyDetailMeta.textContent = `${mediaType} - ${createdAt}`;

  activeHistoryPayload = payload || null;
  if (historyDetailBadge) {
    historyDetailBadge.innerHTML = '';
  }
  if (historyDetailCopy) {
    historyDetailCopy.disabled = !canCopyDetails || !activeHistoryPayload;
    historyDetailCopy.textContent = canCopyDetails ? 'Details kopieren' : 'Kopieren nicht verfügbar';
    historyDetailCopy.classList.remove('is-copied');
  }

  const expertMode = (() => {
    try {
      return localStorage.getItem('ac_expert_mode') === '1';
    } catch (e) {
      return false;
    }
  })();
  const resultPayload = buildHistoryResultPayload(payload);
  if (historyDetailBody) historyDetailBody.innerHTML = renderAnalysisResult(resultPayload, { expertMode, variant: 'drawer' });
}

function buildHistoryCopyText(payload) {
  if (!payload) return '';
  const title = payload?.title || payload?.verdict_label || 'Analyse';
  const createdAt = formatDateTime(payload?.created_at);
  const mediaType = formatMediaLabel(payload?.media_type);
  const verdict = payload?.verdict_label || 'Ergebnis';
  const scoreValue = (typeof payload?.final_score === 'number') ? Math.round(payload.final_score) : null;
  const scoreText = scoreValue !== null ? `${scoreValue}% KI` : '--';
  const credits = (typeof payload?.credits_charged === 'number') ? `${payload.credits_charged} Credits` : '--';
  const statusInfo = historyStatusInfo(payload?.status);
  const summary = normalizeHistorySummary(payload);
  const confidenceLabel = summary?.confidence_label ? formatConfidenceLabel(summary.confidence_label) : 'Unbekannt';
  const reasons = Array.isArray(summary?.reasons_user)
    ? summary.reasons_user
    : (Array.isArray(summary?.reasons) ? summary.reasons : []);
  const warnings = Array.isArray(summary?.warnings_user) ? summary.warnings_user : [];
  const lines = [
    `Titel: ${title}`,
    `Datum: ${createdAt}`,
    `Typ: ${mediaType}`,
    `Ergebnis: ${verdict}`,
    `KI-Score: ${scoreText}`,
    `Konfidenz: ${confidenceLabel}`,
    `Status: ${statusInfo.label}`,
    `Credits: ${credits}`,
  ];

  if (reasons.length) {
    lines.push('Hinweise:');
    reasons.forEach((reason) => lines.push(`- ${reason}`));
  }
  if (warnings.length) {
    lines.push('Warnungen:');
    warnings.forEach((warning) => lines.push(`- ${warning}`));
  }

  const breakdown = payload?.engine_breakdown;
  if (breakdown && typeof breakdown === 'object') {
    const entries = Object.entries(breakdown);
    if (entries.length) {
      lines.push('Engine-Breakdown:');
      entries.forEach(([name, info]) => {
        const rawScore = (typeof info === 'number')
          ? info
          : ((typeof info?.score === 'number') ? info.score : null);
        const engineScore = (typeof rawScore === 'number') ? Math.round(rawScore) : null;
        const engineScoreText = engineScore !== null ? `${engineScore}% KI` : '--';
        const confText = (typeof info?.confidence === 'number')
          ? `${formatPercent(info.confidence)} Konfidenz`
          : null;
        const metaText = [engineScoreText, confText].filter(Boolean).join(' · ');
        lines.push(`- ${name}: ${metaText || '--'}`);
      });
    }
  }

  return lines.join('\n');
}

function copyHistoryDetail() {
  if (!historyDetailCopy || historyDetailCopy.disabled) return;
  if (!canCopyDetails || !activeHistoryPayload) return;
  const text = buildHistoryCopyText(activeHistoryPayload);
  if (!text) return;

  const applyFeedback = (label) => {
    const original = historyDetailCopy.dataset.label || historyDetailCopy.textContent.trim();
    historyDetailCopy.dataset.label = original;
    historyDetailCopy.textContent = label;
    historyDetailCopy.classList.add('is-copied');
    window.setTimeout(() => {
      historyDetailCopy.textContent = historyDetailCopy.dataset.label || original;
      historyDetailCopy.classList.remove('is-copied');
    }, 1200);
  };

  const copyFallback = () => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch (err) {
      return false;
    }
  };

  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => applyFeedback('Details kopiert'))
      .catch(() => {
        if (copyFallback()) applyFeedback('Details kopiert');
      });
    return;
  }
  if (copyFallback()) applyFeedback('Details kopiert');
}

