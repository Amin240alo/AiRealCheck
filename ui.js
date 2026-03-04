const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const pages = {
  start: $('#page-start'),
  history: $('#page-history'),
  details: $('#page-details'),
  login: $('#page-login'),
  authCallback: $('#page-auth-callback'),
  register: $('#page-register'),
  verify: $('#page-verify'),
  forgot: $('#page-forgot'),
  reset: $('#page-reset'),
  profile: $('#page-profile'),
  settings: $('#page-settings'),
  premium: $('#page-premium'),
  affiliate: $('#page-affiliate'),
  rate: $('#page-rate'),
  legal: $('#page-legal'),
  admin: $('#page-admin'),
};

const header = $('#mainHeader');
const headerAuth = $('#headerAuth');
const headerBack = $('#headerBack');
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
const profileHistoryBtn = $('#profileHistory');
const profileLogoutBtn = $('#profileLogout');
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
const emailVerifyBanner = $('#emailVerifyBanner');
const analysisGateNotice = $('#analysisGateNotice');
const analysisTool = $('#analysisTool');
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

const RETURN_TO_KEY = 'airealcheck_return_to';
const fmtDT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDate = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });

const AUTH_ROUTES = new Set([
  '/login',
  '/auth/callback',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
]);

const PUBLIC_ROUTES = new Set([...AUTH_ROUTES, '/legal']);

function normalizePath(value) {
  return String(value || '').split('?')[0];
}

function isAuthRoute(path) {
  return AUTH_ROUTES.has(normalizePath(path));
}

function isPublicRoute(path) {
  return PUBLIC_ROUTES.has(normalizePath(path));
}

function setRouteClasses(path) {
  const safePath = normalizePath(path);
  const root = document.documentElement;
  root.classList.toggle('ac-route-login', safePath === '/login');
  root.classList.toggle('ac-route-register', safePath === '/register');
  root.classList.toggle('ac-route-reset', safePath === '/reset-password');
}

export function showPage(name) {
  Object.values(pages).forEach((p) => p && p.classList.add('ac-hide'));
  const target = pages[name] || pages.start;
  if (target) target.classList.remove('ac-hide');
  navStart?.classList.toggle('ac-active', name === 'start');
  navHistory?.classList.toggle('ac-active', name === 'history');
  if (name !== 'history') closeHistoryDrawer();
}

function updateHeaderUI(auth, path = currentRoute) {
  const loggedIn = auth?.isLoggedIn?.() === true;
  const authRoute = isAuthRoute(path);
  if (header) header.classList.toggle('ac-header-simple', authRoute);
  if (headerBack) headerBack.classList.toggle('ac-hide', !authRoute);
  if (headerAuth) headerAuth.hidden = loggedIn || authRoute;
  if (hamburger) hamburger.hidden = !loggedIn || authRoute;
  if (creditsBox) creditsBox.hidden = !loggedIn || authRoute;
  if (profileTrigger) profileTrigger.hidden = !loggedIn || authRoute;
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
  if (analysisTool) analysisTool.classList.toggle('ac-hide', !loggedIn);
  if (!loggedIn && analysisGateNotice) {
    analysisGateNotice.classList.add('ac-hide');
    analysisGateNotice.innerHTML = '';
  }
}

function enforceAuthGuard(auth, path = currentRoute, navigate) {
  const loggedIn = auth?.isLoggedIn?.() === true;
  const safePath = normalizePath(path);
  if (!loggedIn && !isPublicRoute(safePath)) {
    try {
      const returnTarget = `${window.location.pathname}${window.location.search}`;
      if (returnTarget && !isAuthRoute(normalizePath(returnTarget))) {
        sessionStorage.setItem(RETURN_TO_KEY, returnTarget);
      }
    } catch (err) {
      // ignore storage errors
    }
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
  return false;
}

export function initRouter(auth) {
  const listeners = new Set();
  const routeMap = {
    '/login': 'login',
    '/auth/callback': 'authCallback',
    '/register': 'register',
    '/verify-email': 'verify',
    '/forgot-password': 'forgot',
    '/reset-password': 'reset',
    '/legal': 'legal',
  };

  function render(pathname = window.location.pathname) {
    const safePath = normalizePath(pathname);
    setRouteClasses(safePath);
    if (!auth?.isLoggedIn?.() && !isPublicRoute(safePath)) {
      navigate('/login');
      return;
    }
    const page = routeMap[safePath] || 'start';
    showPage(page);
    if (safePath === '/legal') {
      const params = new URLSearchParams(window.location.search || '');
      showLegal(params.get('section') || params.get('tab') || 'impressum');
    }
    listeners.forEach((cb) => {
      try {
        cb(safePath);
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
  if (label === 'high') return 'Hoch';
  if (label === 'medium') return 'Mittel';
  if (label === 'low') return 'Niedrig';
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
  reality_defender: 'Reality Defender',
  hive: 'Hive',
  xception: 'Xception (Local ML)',
  audio_aasist: 'AASIST (Local ML)',
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

export function renderAnalysisResult(resultJson, { expertMode = false } = {}) {
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
        <div class="ac-result-title" style="color:#b42318">FFmpeg fehlt – Video-Frames koennen nicht extrahiert werden. Installiere FFmpeg und starte den Server neu.</div>
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
  if (!isLoggedIn) {
    analysisGateNotice.classList.add('ac-hide');
    analysisGateNotice.innerHTML = '';
    return;
  }
  analysisGateNotice.classList.add('ac-hide');
  analysisGateNotice.innerHTML = '';
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

function renderEngineBreakdown(breakdown) {
  if (!breakdown || typeof breakdown !== 'object') {
    return '<div class="drawer-empty">Keine Engine-Details gespeichert.</div>';
  }
  const entries = Object.entries(breakdown);
  if (!entries.length) {
    return '<div class="drawer-empty">Keine Engine-Details gespeichert.</div>';
  }
  const scoreBucket = (score) => {
    if (typeof score !== 'number') return '';
    if (score >= 70) return 'is-danger';
    if (score >= 31) return 'is-warning';
    return 'is-success';
  };
  return `
    <div class="ac-history-engine-list">
      ${entries.map(([name, info]) => {
        const scoreValue = (typeof info?.score === 'number') ? Math.round(info.score) : null;
        const scoreText = scoreValue !== null ? `${scoreValue}% KI` : '—';
        const confText = (typeof info?.confidence === 'number')
          ? `${formatPercent(info.confidence)} Konfidenz`
          : null;
        const metaText = [scoreText, confText].filter(Boolean).join(' · ');
        const width = scoreValue !== null ? Math.max(0, Math.min(100, scoreValue)) : 0;
        const fillClass = scoreBucket(scoreValue);
        return `
          <div class="engine-row">
            <div class="engine-row-head">
              <span class="engine-row-label">${escapeHtml(name)}</span>
              <span class="engine-row-meta">${escapeHtml(metaText || '—')}</span>
            </div>
            <div class="engine-row-bar">
              <span class="engine-row-fill ${fillClass}" style="width:${width}%"></span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function buildHistoryCopyText(payload) {
  if (!payload) return '';
  const title = payload?.title || payload?.verdict_label || 'Analyse';
  const createdAt = formatDateTime(payload?.created_at);
  const mediaType = formatMediaLabel(payload?.media_type);
  const verdict = payload?.verdict_label || 'Ergebnis';
  const scoreValue = (typeof payload?.final_score === 'number') ? Math.round(payload.final_score) : null;
  const scoreText = scoreValue !== null ? `${scoreValue}% KI` : '—';
  const credits = (typeof payload?.credits_charged === 'number') ? `${payload.credits_charged} Credits` : '—';
  const statusInfo = historyStatusInfo(payload?.status);
  const result = payload?.result_payload || {};
  const confidenceLabel = result?.confidence_label ? formatConfidenceLabel(result.confidence_label) : 'Unbekannt';
  const reasons = Array.isArray(result?.reasons_user)
    ? result.reasons_user
    : (Array.isArray(result?.reasons) ? result.reasons : []);
  const warnings = Array.isArray(result?.warnings_user) ? result.warnings_user : [];
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
        const engineScore = (typeof info?.score === 'number') ? Math.round(info.score) : null;
        const engineScoreText = engineScore !== null ? `${engineScore}% KI` : '—';
        const confText = (typeof info?.confidence === 'number')
          ? `${formatPercent(info.confidence)} Konfidenz`
          : null;
        const metaText = [engineScoreText, confText].filter(Boolean).join(' · ');
        lines.push(`- ${name}: ${metaText || '—'}`);
      });
    }
  }

  return lines.join('\n');
}

async function copyHistoryDetail() {
  if (!activeHistoryPayload || !historyDetailCopy || !canCopyDetails) return;
  const text = buildHistoryCopyText(activeHistoryPayload);
  if (!text) return;
  let copied = false;
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (err) {
      copied = false;
    }
  }
  if (!copied) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      copied = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (err) {
      copied = false;
    }
  }
  if (copied) {
    historyDetailCopy.textContent = 'Kopiert';
    historyDetailCopy.classList.add('is-copied');
    setTimeout(() => {
      if (!historyDetailCopy || !activeHistoryPayload) return;
      historyDetailCopy.textContent = 'Details kopieren';
      historyDetailCopy.classList.remove('is-copied');
    }, 1800);
  } else {
    historyDetailCopy.textContent = 'Kopieren fehlgeschlagen';
    historyDetailCopy.classList.remove('is-copied');
    setTimeout(() => {
      if (!historyDetailCopy) return;
      historyDetailCopy.textContent = 'Details kopieren';
    }, 2000);
  }
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

function renderHistoryDetail(payload) {
  const title = payload?.title || payload?.verdict_label || 'Analyse';
  const createdAt = formatDateTime(payload?.created_at);
  const mediaType = formatMediaLabel(payload?.media_type);
  if (historyDetailTitle) historyDetailTitle.textContent = title;
  if (historyDetailMeta) historyDetailMeta.textContent = `${mediaType} • ${createdAt}`;

  const verdict = payload?.verdict_label || 'Ergebnis';
  const scoreValue = (typeof payload?.final_score === 'number') ? Math.round(payload.final_score) : null;
  const score = (scoreValue !== null) ? `${scoreValue}% KI` : '—';
  const credits = (typeof payload?.credits_charged === 'number') ? `${payload.credits_charged} Credits` : '—';
  const statusInfo = historyStatusInfo(payload?.status);
  const result = payload?.result_payload || {};
  const confidenceLabel = result?.confidence_label ? formatConfidenceLabel(result.confidence_label) : 'Unbekannt';
  const reasons = Array.isArray(result?.reasons_user)
    ? result.reasons_user
    : (Array.isArray(result?.reasons) ? result.reasons : []);
  const warnings = Array.isArray(result?.warnings_user) ? result.warnings_user : [];

  activeHistoryPayload = payload || null;
  if (historyDetailBadge) {
    const badgeText = scoreValue !== null ? `${verdict} · ${scoreValue}% KI` : verdict;
    historyDetailBadge.innerHTML = badgeText
      ? `<span class="drawer-chip">${escapeHtml(badgeText)}</span>`
      : '';
  }
  if (historyDetailCopy) {
    historyDetailCopy.disabled = !canCopyDetails || !activeHistoryPayload;
    historyDetailCopy.textContent = canCopyDetails ? 'Details kopieren' : 'Kopieren nicht verfügbar';
    historyDetailCopy.classList.remove('is-copied');
  }

  const reasonsHtml = reasons.length
    ? reasons.map((r) => `<div class="ac-history-meta">${escapeHtml(r)}</div>`).join('')
    : '<div class="drawer-empty">Keine Hinweise gespeichert.</div>';
  const warningsHtml = warnings.length
    ? warnings.map((w) => `<div class="ac-history-meta">${escapeHtml(w)}</div>`).join('')
    : '<div class="drawer-empty">Keine Warnungen gespeichert.</div>';

  const timelineHtml = `
    <div class="ac-history-panel-card drawer-card">
      <div class="ac-history-card-title">Analyse Timeline</div>
      <div class="analysis-timeline">
        <div class="timeline-item"><span class="timeline-dot"></span><span class="timeline-text">Upload</span></div>
        <div class="timeline-item"><span class="timeline-dot"></span><span class="timeline-text">Analyse gestartet</span></div>
        <div class="timeline-item"><span class="timeline-dot"></span><span class="timeline-text">Engines ausgeführt</span></div>
        <div class="timeline-item"><span class="timeline-dot"></span><span class="timeline-text">Ergebnis berechnet</span></div>
      </div>
    </div>
  `;

  const detailHtml = `
    <div class="ac-history-panel-card drawer-card">
      <div class="ac-history-card-title">Zusammenfassung</div>
      <div class="ac-history-kv"><span>Ergebnis</span><span>${escapeHtml(verdict)}</span></div>
      <div class="ac-history-kv"><span>KI-Score</span><span>${escapeHtml(score)}</span></div>
      <div class="ac-history-kv"><span>Status</span><span>${escapeHtml(statusInfo.label)}</span></div>
      <div class="ac-history-kv"><span>Credits</span><span>${escapeHtml(credits)}</span></div>
      <div class="ac-history-kv"><span>Konfidenz</span><span>${escapeHtml(confidenceLabel)}</span></div>
    </div>
    ${timelineHtml}
    <div class="ac-history-panel-card drawer-card">
      <div class="ac-history-card-title">Hinweise</div>
      ${reasonsHtml}
    </div>
    <div class="ac-history-panel-card drawer-card">
      <div class="ac-history-card-title">Engine-Breakdown</div>
      ${renderEngineBreakdown(payload?.engine_breakdown)}
    </div>
    <div class="ac-history-panel-card drawer-card">
      <div class="ac-history-card-title">Warnungen</div>
      ${warningsHtml}
    </div>
  `;
  if (historyDetailBody) historyDetailBody.innerHTML = detailHtml;
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
  const navigate = extras?.navigate;
  const router = extras?.router;
  const navigateFn = typeof navigate === 'function'
    ? navigate
    : (typeof auth?.navigate === 'function' ? auth.navigate.bind(auth) : null);
  currentRoute = normalizePath(window.location.pathname || currentRoute);
  setRouteClasses(currentRoute);
  const shouldRedirect = enforceAuthGuard(auth, currentRoute, navigateFn);
  updateHeaderUI(auth, currentRoute);
  updateAnalysisVisibility(auth);
  if (shouldRedirect) return;
  navStart?.addEventListener('click', (e) => {
    e.preventDefault();
    if (navigate) navigate('/');
    else showPage('start');
  });

  navHistory?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!auth.requireSession()) return;
    renderHistory(auth);
    showPage('history');
  });

  brandHome?.addEventListener('click', (e) => {
    e.preventDefault();
    if (navigate) navigate('/');
    else showPage('start');
  });

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
      if (navigate) navigate('/');
      else showPage('start');
    } else if (page === 'history') {
      if (!auth.requireSession()) return;
      renderHistory(auth);
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
    renderHistory(auth);
    showPage('history');
  });

  profileLogoutBtn?.addEventListener('click', () => auth.logout());

  profileTrigger?.addEventListener('click', (e) => {
    e.preventDefault();
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
    if (enforceAuthGuard(auth, currentRoute, navigateFn)) return;
    updateCreditsUI(auth);
    updateProfileView(auth);
    updateAnalyzeButtons(auth);
    updateVerifyBanner(auth);
    updateAnalysisGateNotice(auth);
    updateAdminVisibility(auth);
    updateHeaderUI(auth, currentRoute);
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
  bindResendVerify(auth);
  if (router?.subscribe) {
    router.subscribe((path) => {
      currentRoute = path;
      updateAnalysisVisibility(auth);
      if (enforceAuthGuard(auth, path, navigateFn)) return;
      updateHeaderUI(auth, path);
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

