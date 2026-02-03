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

function verdictFromPercent(aiPercent) {
  if (aiPercent === null || aiPercent === undefined) return { key: 'uncertain', label: 'Unsicher' };
  if (aiPercent >= 90) return { key: 'ai', label: 'Sehr wahrscheinlich KI' };
  if (aiPercent >= 65) return { key: 'ai', label: 'Eher KI' };
  if (aiPercent >= 35) return { key: 'uncertain', label: 'Unsicher' };
  if (aiPercent >= 11) return { key: 'real', label: 'Eher echt' };
  return { key: 'real', label: 'Sehr wahrscheinlich echt' };
}

function extractSignalValue(signals, key) {
  const match = (signals || []).find((s) => String(s).toLowerCase().startsWith(`${key}:`));
  if (!match) return null;
  const raw = String(match).split(':').slice(1).join(':');
  return raw ? raw.trim() : null;
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
    }));
}

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

  return {
    media_type: typeof data?.media_type === 'string' ? data.media_type.toLowerCase() : 'image',
    final_ai: finalAi,
    final_real: finalReal,
    ai_likelihood: aiLikelihood,
    confidence_label: confidenceLabel,
    reasons,
    conflict,
    engine_results: engineResults,
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

  const confidenceMap = {
    high: { label: 'Hoch', badge: 'badge-green' },
    medium: { label: 'Mittel', badge: 'badge-yellow' },
    low: { label: 'Niedrig', badge: 'badge-red' },
  };
  const confidenceInfo = confidenceMap[r.confidence_label] || { label: 'Unbekannt', badge: 'badge-yellow' };

  const detectorEngines = mediaType === 'video'
    ? new Set(['video_frame_detectors', 'reality_defender_video'])
    : new Set(['sightengine', 'reality_defender', 'hive']);
  const detectors = r.engine_results.filter((e) => detectorEngines.has(e.engine));
  const availableDetectorCount = detectors.filter(
    (engine) => engine.available !== false && typeof engine.ai_likelihood === 'number'
  ).length;
  const detectorsAligned = availableDetectorCount >= 2 && r.conflict === false;
  const detectorsHtml = detectors.length
    ? detectors.map((engine) => {
      const available = engine.available !== false;
      const score = available
        ? (percentFromValue(engine.ai_likelihood) !== null ? `${percentFromValue(engine.ai_likelihood)}% KI` : '—')
        : 'nicht verfuegbar';
      const notes = String(engine?.notes || '');
      return `
        <div class="ac-engine-item ${available ? '' : 'is-disabled'}">
          <div class="ac-engine-head">
            <div class="ac-engine-name">${engine.engine}</div>
            <div class="ac-engine-score">${score}</div>
          </div>
          <div class="ac-engine-meta">Status: ${available ? 'verfuegbar' : 'nicht verfuegbar'}</div>
          ${notes ? `<div class="ac-engine-notes">${notes}</div>` : ''}
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

  const forensicsEngine = mediaType === 'video' ? 'video_forensics' : 'forensics';
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

  return `
    ${ffmpegMissing ? `
      <div class="ac-card">
        <div class="ac-result-title" style="color:#b42318">FFmpeg fehlt – Video-Frames koennen nicht extrahiert werden. Installiere FFmpeg und starte den Server neu.</div>
      </div>
    ` : ''}
    <div class="ac-card ac-result-card" role="status" aria-live="polite">
      <div class="ac-result-headline">${verdict.label}</div>
      <div class="ac-result-row">
        <span class="ac-traffic-badge ${confidenceInfo.badge}">Sicherheit: ${confidenceInfo.label}</span>
        ${mediaType === 'video' && framesScored !== null ? `<span class="ac-subtle">Basierend auf ${framesScored} Frames</span>` : ''}
      </div>
      <div class="ac-result-hero">
        <div class="ac-result-percent">KI-Wahrscheinlichkeit: ${finalAiPercent !== null ? `${finalAiPercent}%` : '—'}</div>
      </div>
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
