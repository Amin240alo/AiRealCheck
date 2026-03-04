import { renderAnalysisResult } from './ui.js';

console.log("I AM THE REAL ANALYZE.JS");
console.log("REAL FILE PATH:", import.meta?.url || document.currentScript?.src);
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const idMap = { image: '#imageInput', video: '#videoInput', audio: '#audioInput' };
const urlIdMap = { image: '#imageUrl', video: '#videoUrl', audio: '#audioUrl' };
const ANALYSIS_COSTS = { image: 10, video: 25, audio: 15 };
const DEFAULT_API_BASE = 'http://127.0.0.1:5001';
const DEFAULT_ANALYZE_TIMEOUT_MS = 180000;
let authRef = null;
let helpersRef = null;
let apiBase = DEFAULT_API_BASE;
let isAnalyzing = false;
let reqCounter = 0;
let activeAnalyzeBtn = null;
let resultRendered = false;

function getExpertMode() {
  try {
    return localStorage.getItem('ac_expert_mode') === '1';
  } catch (e) {
    return false;
  }
}

function renderResultCard(data, expertMode = false) {
  const real = Number(data.real || 0);
  const fake = Number(data.fake || 0);
  const confidence = String(data.confidence || '').toLowerCase();

  const verdict = (fake >= 70 && confidence !== 'low')
    ? 'fake'
    : (real >= 70 && confidence !== 'low' ? 'real' : 'uncertain');

  const verdictLabel = verdict === 'real'
    ? 'Wahrscheinlich echt'
    : verdict === 'fake'
      ? 'Wahrscheinlich KI'
      : 'Unklar';

  const icon = verdict === 'real' ? '✓' : (verdict === 'fake' ? '!' : '?');
  const iconClass = verdict === 'real'
    ? 'ac-result-icon is-real'
    : (verdict === 'fake' ? 'ac-result-icon is-fake' : 'ac-result-icon is-uncertain');

  const metricLabel = `KI-Wahrscheinlichkeit: ${Number.isFinite(fake) ? `${Math.round(fake)}%` : '—'}`;

  const confidenceLabel = confidence === 'high' ? 'Hoch' : (confidence === 'medium' ? 'Mittel' : 'Niedrig');
  const confidenceHint = 'Niedrig bedeutet: Ergebnis unsicher / gemischte Signale';

  const explanation = verdict === 'uncertain'
    ? 'Unklar - bitte zusaetzliche Pruefung oder bessere Qualitaet (hoehere Aufloesung, Originaldatei).'
    : (verdict === 'real'
      ? 'Die Analyse spricht eher fuer eine echte Aufnahme.'
      : 'Die Analyse spricht eher fuer KI/Manipulation.');

  const summaryLines = Array.isArray(data.user_summary) && data.user_summary.length
    ? data.user_summary
    : (data.message ? [data.message] : []);
  const summaryList = (summaryLines.length ? summaryLines : [explanation])
    .slice(0, 2)
    .map((d) => `<li>${String(d)}</li>`)
    .join('');

  const detailsObj = data.details || {};
  const techLines = [];
  if (expertMode) {
    const primary = data.primary_source || data.source;
    if (primary) techLines.push(`Primary Source: ${primary}`);
    if (Array.isArray(data.sources_used) && data.sources_used.length) {
      techLines.push(`Engines: ${data.sources_used.join(', ')}`);
    }
    if (Array.isArray(data.warnings) && data.warnings.length) {
      data.warnings.forEach((w) => techLines.push(`Warnung: ${w}`));
    }
    const addDetails = (label, arr) => {
      if (!arr) return;
      const list = Array.isArray(arr) ? arr : [arr];
      list.forEach((d) => techLines.push(`${label}: ${d}`));
    };
    addDetails('Hive', detailsObj.hive);
    addDetails('Forensics', detailsObj.forensics);
    addDetails('Model', detailsObj.model);
  }
  const techList = techLines.map((d) => `<li>${String(d)}</li>`).join('');

  const detailsBody = expertMode
    ? `
        <div class="ac-subtle"><b>Warum?</b></div>
        <ul class="ac-compare-list">${summaryList}</ul>
        <div class="ac-subtle" style="margin-top:8px"><b>Technische Rohdaten</b></div>
        <ul class="ac-compare-list">${techList || '<li>Keine Rohdaten verfuegbar.</li>'}</ul>
      `
    : `
        <div class="ac-subtle"><b>Warum?</b></div>
        <ul class="ac-compare-list">${summaryList}</ul>
      `;

  return `
    <div class="ac-card ac-result-card" role="status" aria-live="polite">
      <div class="ac-result-header">
        <span class="${iconClass}" aria-hidden="true">${icon}</span>
        <div class="ac-result-title">${verdictLabel}</div>
      </div>
      <div class="ac-result-chips">
        <span class="ac-chip ac-chip-metric">${metricLabel}</span>
        <span class="ac-chip ac-chip-metric" title="${confidenceHint}">Sicherheit: ${confidenceLabel}</span>
      </div>
      <div class="ac-result-expl">${explanation}</div>
      <button id="toggleDetails" class="ac-secondary ac-details-btn" type="button">Details </button>
      <div id="inlineDetails" class="ac-subtle" style="display:none; margin-top:8px">
        ${detailsBody}
      </div>
    </div>`;
}


function getAnalyzeTimeoutMs() {
  const fromWindow = Number(
    window?.AIREALCHECK_CONFIG?.analyzeTimeoutMs
    ?? window?.AIREALCHECK_ANALYZE_TIMEOUT_MS
  );
  const fromMeta = Number(document.querySelector('meta[name="ac-analyze-timeout-ms"]')?.content);
  const value = (Number.isFinite(fromWindow) && fromWindow > 0)
    ? fromWindow
    : ((Number.isFinite(fromMeta) && fromMeta > 0) ? fromMeta : DEFAULT_ANALYZE_TIMEOUT_MS);
  return Math.max(10000, value);
}



const getAnalysisCost = (kind = 'image') => ANALYSIS_COSTS[kind] || 10;

function setApiBase(base) {
  const source = (typeof base === 'string' && base.trim()) ? base : DEFAULT_API_BASE;
  apiBase = source.trim().replace(/\/+$/, '');
}

export function initAnalyze(auth, helpers) {
  authRef = auth;
  helpersRef = helpers;
  setApiBase(helpers?.apiBase);

  const fileInputs = Object.values(idMap)
    .map((sel) => document.querySelector(sel))
    .filter(Boolean);
  fileInputs.forEach((input) => {
    input.addEventListener('change', () => {
      resultRendered = false;
      updateAnalyzeState();
    });
  });
  const urlInputs = Object.values(urlIdMap)
    .map((sel) => document.querySelector(sel))
    .filter(Boolean);
  urlInputs.forEach((input) => {
    input.addEventListener('input', () => {
      resultRendered = false;
      updateAnalyzeState();
    });
  });









  const analyzeButtons = $$('.ac-primary[data-kind]');
  analyzeButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {

      activeAnalyzeBtn = e.currentTarget;
      


      e.preventDefault();
      e.stopPropagation();
      const kind = btn.dataset.kind;
      const mode = btn.dataset.mode || 'file';
      if (isAnalyzing) return;
      const cost = getAnalysisCost(kind);
      const isLoggedIn = authRef.isLoggedIn?.() === true;
      const guestAllowed = authRef.canUseGuest?.() === true;
      if (!isLoggedIn && !guestAllowed) {
        const area = $('#analysisArea');
        if (area) {
          area.innerHTML = '<div class="ac-card"><b>Login erforderlich</b><p class="ac-subtle">Gastmodus ist deaktiviert. Bitte einloggen oder registrieren.</p></div>';
        }
        authRef.navigate?.('/login');
        return;
      }
      if (isLoggedIn && !authRef.isEmailVerified?.()) {
        const area = $('#analysisArea');
        if (area) {
          area.innerHTML = '<div class="ac-card"><b>E-Mail nicht bestätigt</b><p class="ac-subtle">Bitte E-Mail bestätigen – ohne Verifikation sind Analysen gesperrt.</p></div>';
        }
        return;
      }
      if (isLoggedIn) {
        const currentCredits = typeof authRef?.balance?.credits_available === 'number'
          ? authRef.balance.credits_available
          : null;
        if (typeof currentCredits === 'number' && currentCredits < cost) {
          const area = $('#analysisArea');
          if (area) {
            area.innerHTML = '<div class="ac-card"><b>Nicht genug Credits</b><p class="ac-subtle">Nicht genug Credits. Bitte upgraden oder warten bis dein Credits-Reset wieder greift.</p></div>';
          }
          return;
        }
      }
      if (mode === 'file') {
        analyzeFile(kind);
      } else {
        analyzeLink(kind);
      }
    });
  });











 document.querySelector('#btnVideo')?.addEventListener('click', () => setMediaType('video'));
document.querySelector('#btnImage')?.addEventListener('click', () => setMediaType('image'));
document.querySelector('#btnAudio')?.addEventListener('click', () => setMediaType('audio'));

document.querySelector('#segFile')?.addEventListener('click', () => toggleMode('file'));
document.querySelector('#segLink')?.addEventListener('click', () => toggleMode('link'));

// Optional: Standardtyp setzen
setMediaType('image');

  updateAnalyzeState();
}

export function setMediaType(type) {
  document.querySelector('#btnVideo')?.classList.toggle('ac-active', type === 'video');
  document.querySelector('#btnImage')?.classList.toggle('ac-active', type === 'image');
  document.querySelector('#btnAudio')?.classList.toggle('ac-active', type === 'audio');

  document.querySelector('#blockVideo')?.classList.toggle('ac-hide', type !== 'video');
  document.querySelector('#blockImage')?.classList.toggle('ac-hide', type !== 'image');
  document.querySelector('#blockAudio')?.classList.toggle('ac-hide', type !== 'audio');

  document.querySelector('#linkVideo')?.classList.toggle('ac-hide', type !== 'video');
  document.querySelector('#linkImage')?.classList.toggle('ac-hide', type !== 'image');
  document.querySelector('#linkAudio')?.classList.toggle('ac-hide', type !== 'audio');
}


export function toggleMode(mode) {
  const isFile = mode === 'file';

  document.querySelector('#fileInputs')?.classList.toggle('ac-hide', !isFile);
  document.querySelector('#linkInputs')?.classList.toggle('ac-hide', isFile);

  document.querySelector('#segFile')?.classList.toggle('ac-active', isFile);
  document.querySelector('#segLink')?.classList.toggle('ac-active', !isFile);
  updateAnalyzeState();
}


async function analyzeFile(mediaType) {
    console.log("🔥 ENTER ANALYZEFILE — THIS LOG CANNOT BE SKIPPED");
    console.log("mediaType sofort_am_anfang:", mediaType);

        console.log("🔥 TRY BLOCK START");


  // Schutz: nicht zwei Analysen gleichzeitig
  if (isAnalyzing) return;

  isAnalyzing = true;
  reqCounter += 1;
  const myReq = reqCounter;
  updateAnalyzeState();
  lockActiveButton();


  const fileInput = document.querySelector(idMap[mediaType] || '#imageInput');
  const file = fileInput?.files?.[0] || null;
  const area = $('#analysisArea');

  if (!file) {
    if (area) {
      area.innerHTML = '<div class="ac-card"><b>Bitte zuerst eine Datei auswaehlen.</b></div>';
    }
    isAnalyzing = false;
    updateAnalyzeState();
    unlockActiveButton();
    return;
  }

  // Lade-Card
  if (area) {
    area.innerHTML = `
      <div class="ac-card">
        <b>Analyse laeuft...</b>
        <p class="ac-subtle">Bitte warten</p>
        <progress max="100" value="30" style="width:100%;height:10px"></progress>
      </div>`;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', mediaType);
  formData.append('force', 'true');
  const nonce = Date.now();
  formData.append('nonce', String(nonce));

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), getAnalyzeTimeoutMs());

  try {
    const isGuest = !authRef.isLoggedIn();
    const useGuest = isGuest && authRef.canUseGuest?.();
    const endpoint = useGuest ? '/analyze/guest' : '/analyze';
    const url = `${apiBase}${endpoint}?t=${nonce}`;

    const headers = useGuest
      ? { Accept: 'application/json' }
      : Object.assign({ Accept: 'application/json' }, authRef.authHeaders());

    const resp = await fetch(url, {
      method: 'POST',
      body: formData,
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    let data = null;
    try {
      data = await resp.clone().json();
    } catch (e) {
      const txt = await resp.text();
      if (myReq === reqCounter && area) {
        area.innerHTML = `<div class="ac-card"><b>Fehler</b><p class="ac-subtle">${txt || 'Unerwartete Server-Antwort'}</p></div>`;
      }
      return;
    }

    // alte / überholte Antwort ignorieren (kein Flackern)
    if (myReq !== reqCounter) {
      console.log('Ignored old request:', myReq, reqCounter);
      return;
    }

    if (!resp.ok || !data || data.ok === false) {
      // Fehler-Fälle wie vorher
      if (resp.status === 401 && authRef.isLoggedIn()) {
        await authRef.logout('Bitte erneut einloggen.');
        if (area) {
          area.innerHTML = '<div class="ac-card"><b>Login erforderlich</b><p class="ac-subtle">Deine Session ist beendet.</p></div>';
        }
      } else if (resp.status === 403 && data?.error === 'email_not_verified') {
        if (area) {
          area.innerHTML = '<div class="ac-card"><b>E-Mail nicht bestätigt</b><p class="ac-subtle">Bitte E-Mail bestätigen – ohne Verifikation sind Analysen gesperrt.</p></div>';
        }
      } else if (resp.status === 403 && data?.error === 'guest_disabled') {
        if (area) {
          area.innerHTML = '<div class="ac-card"><b>Login erforderlich</b><p class="ac-subtle">Gastmodus ist deaktiviert. Bitte einloggen.</p></div>';
        }
        authRef.navigate?.('/login');
      } else if (resp.status === 429 || data?.error === 'rate_limited') {
        if (area) {
          area.innerHTML = '<div class="ac-card"><b>Zu viele Versuche</b><p class="ac-subtle">Bitte warte kurz und versuche es erneut.</p></div>';
        }
      } else if ((resp.status === 402 || resp.status === 409) && (data?.error === 'insufficient_credits' || data?.error === 'no_credits')) {
        const available = typeof data?.available === 'number' ? data.available : 0;
        authRef.balance = Object.assign({}, authRef.balance || {}, { credits_available: available });
        helpersRef?.updateCreditsUI?.(authRef);
        
        helpersRef?.renderProfileView?.(authRef);
        if (area) {
          area.innerHTML = '<div class="ac-card"><b>Nicht genug Credits</b><p class="ac-subtle">Nicht genug Credits. Bitte upgraden oder warten bis dein Credits-Reset wieder greift.</p></div>';
        }
      } else {
        const msg = (data && (data.error || data.message)) || 'Analyse fehlgeschlagen';
        if (area) {
          area.innerHTML = `<div class="ac-card"><b>Fehler</b><p class="ac-subtle">${msg}</p></div>`;
        }
      }
      return;
    }

    // ✅ Erfolgsfall – neues, reduziertes Ergebnis-UI
    const expertMode = getExpertMode();
    const cost = getAnalysisCost(mediaType);

    if (data.usage && typeof data.usage.credits_left === 'number') {
      authRef.balance = Object.assign({}, authRef.balance || {}, {
        credits_available: data.usage.credits_left,
      });
      helpersRef?.updateCreditsUI?.(authRef);
    
      helpersRef?.renderProfileView?.(authRef);

    }

    if (!authRef.isLoggedIn()) {
      helpersRef?.updateCreditsUI?.(authRef);
    }

    if (area) {
      area.innerHTML = renderAnalysisResult(data, { expertMode });
      resultRendered = true;
      // Datei behalten, damit erneute Analyse ohne Neuauswahl moeglich ist
      if (activeAnalyzeBtn) {
        activeAnalyzeBtn.textContent = 'Analysieren ';
      }





      const btn = document.querySelector('#resultDetailsToggle');
      const box = document.querySelector('#resultDetails');
      if (btn && box) {
        btn.addEventListener('click', () => {
          const open = box.style.display !== 'none';
          box.style.display = open ? 'none' : 'block';
          btn.textContent = open ? 'Details anzeigen' : 'Details schliessen';
        });
      }
    }
  } catch (err) {
    if (myReq === reqCounter && area) {
      const msg = (err && err.name === 'AbortError')
        ? 'Zeitueberschreitung bei der Verbindung.'
        : 'Verbindung zum Server fehlgeschlagen.';
      area.innerHTML = `<div class="ac-card"><b>Fehler</b><p class="ac-subtle">${msg}</p></div>`;
    }
    console.error('Analyse-Fehler:', err);



  } finally {
  isAnalyzing = false;

  updateAnalyzeState();

  unlockActiveButton();
}

}

async function analyzeLink(mediaType) {
  if (isAnalyzing) return;
  isAnalyzing = true;
  reqCounter += 1;
  const myReq = reqCounter;
  updateAnalyzeState();
  lockActiveButton();

  const area = $('#analysisArea');
  const urlInput = document.querySelector(urlIdMap[mediaType] || '#videoUrl');
  const url = (urlInput?.value || '').trim();

  if (!url) {
    if (area) {
      area.innerHTML = '<div class="ac-card"><b>Bitte einen Link eingeben.</b></div>';
    }
    isAnalyzing = false;
    updateAnalyzeState();
    unlockActiveButton();
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    if (area) {
      area.innerHTML = '<div class="ac-card"><b>Nur http/https Links sind erlaubt.</b></div>';
    }
    isAnalyzing = false;
    updateAnalyzeState();
    unlockActiveButton();
    return;
  }

  if (mediaType !== 'video') {
    if (area) {
      area.innerHTML = '<div class="ac-card"><b>Link-Analyse ist aktuell nur fuer Videos verfuegbar.</b></div>';
    }
    isAnalyzing = false;
    updateAnalyzeState();
    unlockActiveButton();
    return;
  }

  if (area) {
    area.innerHTML = `
      <div class="ac-card">
        <b>Analyse laeuft...</b>
        <p class="ac-subtle">Bitte warten</p>
        <progress max="100" value="30" style="width:100%;height:10px"></progress>
      </div>`;
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), getAnalyzeTimeoutMs());

  try {
    const isGuest = !authRef.isLoggedIn();
    const useGuest = isGuest && authRef.canUseGuest?.();
    const endpoint = useGuest ? '/analyze/video-url/guest' : '/analyze/video-url';
    const urlReq = `${apiBase}${endpoint}?t=${Date.now()}`;

    const headers = useGuest
      ? { Accept: 'application/json', 'Content-Type': 'application/json' }
      : Object.assign({ Accept: 'application/json', 'Content-Type': 'application/json' }, authRef.authHeaders());

    const resp = await fetch(urlReq, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    let data = null;
    try {
      data = await resp.clone().json();
    } catch (e) {
      const txt = await resp.text();
      if (myReq === reqCounter && area) {
        area.innerHTML = `<div class="ac-card"><b>Fehler</b><p class="ac-subtle">${txt || 'Unerwartete Server-Antwort'}</p></div>`;
      }
      return;
    }

    if (myReq !== reqCounter) {
      return;
    }

    if (!resp.ok || !data || data.ok === false) {
      if (resp.status === 401 && authRef.isLoggedIn()) {
        await authRef.logout('Bitte erneut einloggen.');
        if (area) {
          area.innerHTML = '<div class="ac-card"><b>Login erforderlich</b><p class="ac-subtle">Deine Session ist beendet.</p></div>';
        }
      } else if (resp.status === 403 && data?.error === 'email_not_verified') {
        if (area) {
          area.innerHTML = '<div class="ac-card"><b>E-Mail nicht bestätigt</b><p class="ac-subtle">Bitte E-Mail bestätigen – ohne Verifikation sind Analysen gesperrt.</p></div>';
        }
      } else if (resp.status === 403 && data?.error === 'guest_disabled') {
        if (area) {
          area.innerHTML = '<div class="ac-card"><b>Login erforderlich</b><p class="ac-subtle">Gastmodus ist deaktiviert. Bitte einloggen.</p></div>';
        }
        authRef.navigate?.('/login');
      } else if (resp.status === 429 || data?.error === 'rate_limited') {
        if (area) {
          area.innerHTML = '<div class="ac-card"><b>Zu viele Versuche</b><p class="ac-subtle">Bitte warte kurz und versuche es erneut.</p></div>';
        }
      } else if ((resp.status === 402 || resp.status === 409) && (data?.error === 'insufficient_credits' || data?.error === 'no_credits')) {
        const available = typeof data?.available === 'number' ? data.available : 0;
        authRef.balance = Object.assign({}, authRef.balance || {}, { credits_available: available });
        helpersRef?.updateCreditsUI?.(authRef);
        helpersRef?.renderProfileView?.(authRef);
        if (area) {
          area.innerHTML = '<div class="ac-card"><b>Nicht genug Credits</b><p class="ac-subtle">Nicht genug Credits. Bitte upgraden oder warten bis dein Credits-Reset wieder greift.</p></div>';
        }
      } else {
        const msg = (data && (data.error || data.message || (data.details && data.details[0]))) || 'Analyse fehlgeschlagen';
        if (area) {
          area.innerHTML = `<div class="ac-card"><b>Fehler</b><p class="ac-subtle">${msg}</p></div>`;
        }
      }
      return;
    }

    const expertMode = getExpertMode();
    const cost = getAnalysisCost(mediaType);

    if (data.usage && typeof data.usage.credits_left === 'number') {
      authRef.balance = Object.assign({}, authRef.balance || {}, {
        credits_available: data.usage.credits_left,
      });
      helpersRef?.updateCreditsUI?.(authRef);
      helpersRef?.renderProfileView?.(authRef);
    }

    if (!authRef.isLoggedIn()) {
      helpersRef?.updateCreditsUI?.(authRef);
    }

    if (area) {
      area.innerHTML = renderAnalysisResult(data, { expertMode });
      resultRendered = true;
      if (activeAnalyzeBtn) {
        activeAnalyzeBtn.textContent = 'Analysieren ';
      }
    }
  } catch (err) {
    if (myReq === reqCounter && area) {
      const msg = (err && err.name === 'AbortError')
        ? 'Zeitueberschreitung bei der Verbindung.'
        : 'Verbindung zum Server fehlgeschlagen.';
      area.innerHTML = `<div class="ac-card"><b>Fehler</b><p class="ac-subtle">${msg}</p></div>`;
    }
    console.error('Analyse-Fehler:', err);
  } finally {
    isAnalyzing = false;
    updateAnalyzeState();
    unlockActiveButton();
  }
}





function updateAnalyzeState() {
  const buttons = $$('.ac-primary[data-kind]');
  if (isAnalyzing) {
    buttons.forEach((btn) => { btn.disabled = true; });
    return;
  }
  buttons.forEach((btn) => {
    if (btn.dataset.locked === 'true') {
      btn.disabled = true;
      return;
    }
    const kind = btn.dataset.kind;
    const mode = btn.dataset.mode || 'file';
    if (mode === 'file') {
      const inputSel = idMap[kind];
      const inputEl = inputSel ? document.querySelector(inputSel) : null;
      const hasFile = !!(inputEl && inputEl.files && inputEl.files.length > 0);
      btn.disabled = !hasFile;
    } else {
      const inputSel = urlIdMap[kind];
      const inputEl = inputSel ? document.querySelector(inputSel) : null;
      const value = (inputEl && inputEl.value || '').trim();
      btn.disabled = !value;
    }
  });
}
function lockActiveButton() {
  if (!activeAnalyzeBtn) return;
  activeAnalyzeBtn.disabled = true;
}

function unlockActiveButton() {
  if (!activeAnalyzeBtn) return;
  activeAnalyzeBtn.disabled = false;
  activeAnalyzeBtn = null;
}






















