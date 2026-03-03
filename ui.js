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

let currentAnalyzing = false;
let expertToggleBound = false;
let resendVerifyBound = false;
let currentRoute = window.location.pathname || '/';

const RETURN_TO_KEY = 'airealcheck_return_to';

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

const ANALYSIS_COSTS = { image: 10, video: 15, audio: 20 };
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
  sightengine: 'API-Detector fuer AI-Content.',
  reality_defender: 'API-Detector fuer Deepfakes.',
  hive: 'API-Detector fuer KI-Generierung.',
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
        : 'nicht verfuegbar';
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
          <div class="ac-engine-meta">Status: ${available ? 'verfuegbar' : 'nicht verfuegbar'}</div>
          ${desc ? `<div class="ac-engine-desc">${desc}</div>` : ''}
          ${notes ? `<div class="ac-engine-notes">${notes}</div>` : ''}
          ${xceptionExtras}
        </div>
      `;
    }).join('')
    : '<div class="ac-subtle">Keine Detector-Engines verfuegbar.</div>';

  const c2pa = r.engine_results.find((e) => e.engine === 'c2pa');
  let c2paStatus = 'kein Nachweis';
  if (c2pa && c2pa.available === false) {
    c2paStatus = 'nicht verfuegbar';
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
    watermarkStatus = 'nicht verfuegbar';
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
        : 'nicht verfuegbar';
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
          <div class="ac-engine-meta">Status: ${available ? 'verfuegbar' : 'nicht verfuegbar'}</div>
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
        <div class="ac-engine-meta">Status: ${frameDetectors.available !== false ? 'verfuegbar' : 'nicht verfuegbar'}</div>
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
      audioWhyLines.push('Widerspruechliche Signale \u2192 Sicherheit reduziert');
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
        <span class="ac-traffic-badge ${confidenceInfo.badge}">Sicherheit: ${confidenceInfo.label}</span>
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
  if (!creditsLabel) return;
  if (!auth || !auth.isLoggedIn?.()) {
    creditsLabel.textContent = '—';
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
    const isLoggedIn = auth?.isLoggedIn?.() === true;
    const guestAllowed = auth?.canUseGuest?.() === true;
    const emailVerified = auth?.isEmailVerified?.() !== false;
    const balanceCredits = typeof auth?.balance?.credits === 'number'
      ? auth.balance.credits
      : (typeof auth?.user?.credits === 'number' ? auth.user.credits : null);
    const hasUserCredits = auth?.isPremium()
      ? true
      : (typeof balanceCredits === 'number' ? balanceCredits >= cost : true);

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
  profilePlan.textContent = auth.isPremium() ? 'Premium' : 'Free';

  if (profileBadge) {
    profileBadge.textContent = initialSource.charAt(0).toUpperCase();
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
  if (profileVerified) {
    profileVerified.textContent = auth.user?.email_verified ? 'Ja' : 'Nein';
  }

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
    auth.setNotice?.('Bitte zuerst einloggen.', 'info');
    auth.navigate?.('/login');
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
    renderHistory();
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
    if (e.key === 'Escape') closeProfileDropdown();
  });

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

