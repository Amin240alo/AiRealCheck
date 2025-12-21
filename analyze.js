
console.log("I AM THE REAL ANALYZE.JS");
console.log("REAL FILE PATH:", import.meta?.url || document.currentScript?.src);
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const idMap = { image: '#imageInput', video: '#videoInput', audio: '#audioInput' };
const ANALYSIS_COSTS = { image: 10, video: 15, audio: 20 };
const DEFAULT_API_BASE = 'http://127.0.0.1:5001';
let authRef = null;
let helpersRef = null;
let apiBase = DEFAULT_API_BASE;
let isAnalyzing = false;
let reqCounter = 0;
let activeAnalyzeBtn = null;
let resultRendered = false;



const getAnalysisCost = (kind = 'image') => ANALYSIS_COSTS[kind] || 10;

function setApiBase(base) {
  const source = (typeof base === 'string' && base.trim()) ? base : DEFAULT_API_BASE;
  apiBase = source.trim().replace(/\/+$/, '');
}

export function initAnalyze(auth, helpers) {
  authRef = auth;
  helpersRef = helpers;
  setApiBase(helpers?.apiBase);









  const analyzeButtons = $$('.ac-primary[data-kind]');
  analyzeButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {

      activeAnalyzeBtn = e.currentTarget;
      


      e.preventDefault();
      e.stopPropagation();
      const kind = btn.dataset.kind;
      const mode = btn.dataset.mode || 'file';
      if (isAnalyzing) return;
      if (mode !== 'file') {
        const area = $('#analysisArea');
        if (area) area.innerHTML = '<div class="ac-card"><b>Nur Datei-Uploads werden aktuell unterstuetzt.</b></div>';
        return;
      }
      const cost = getAnalysisCost(kind);
      const isGuest = !authRef.isLoggedIn();
      if (!isGuest && !authRef.requireSession()) {
        return;
      }
      if (isGuest) {
        const guestCredits = typeof authRef.getGuestCredits === 'function' ? authRef.getGuestCredits() : 0;
        if (guestCredits < cost) {
          const area = $('#analysisArea');
          if (area) {
            area.innerHTML = '<div class="ac-card"><b>Keine Credits mehr</b><p class="ac-subtle">Bitte registrieren oder einloggen.</p></div>';
          }
         
          return;
        }
      } else if (!authRef.isPremium()) {
        const currentCredits = typeof authRef?.balance?.credits === 'number' ? authRef.balance.credits : 0;
        if (currentCredits < cost) {
          const area = $('#analysisArea');
          if (area) {
            area.innerHTML = '<div class="ac-card"><b>Keine Credits verfuegbar</b><p class="ac-subtle">Bitte spaeter erneut versuchen.</p></div>';
          }
         
          return;
        }
      }
      analyzeFile(kind);
    });
  });











 document.querySelector('#btnVideo')?.addEventListener('click', () => setMediaType('video'));
document.querySelector('#btnImage')?.addEventListener('click', () => setMediaType('image'));
document.querySelector('#btnAudio')?.addEventListener('click', () => setMediaType('audio'));

document.querySelector('#segFile')?.addEventListener('click', () => toggleMode('file'));
document.querySelector('#segLink')?.addEventListener('click', () => toggleMode('link'));

// Optional: Standardtyp setzen
setMediaType('image');

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
}


async function analyzeFile(mediaType) {
    console.log("🔥 ENTER ANALYZEFILE — THIS LOG CANNOT BE SKIPPED");
    console.log("mediaType sofort_am_anfang:", mediaType);

    try {
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
    alert('Bitte zuerst eine Datei auswaehlen!');
    isAnalyzing = false;
    updateAnalyzeState();
    return;
  }

  // aktuell nur Bilder erlauben (wie vorher)
  if (mediaType !== 'image') {
    if (area) {
      area.innerHTML = '<div class="ac-card"><b>Nur Bilder werden aktuell unterstuetzt.</b></div>';
    }
    isAnalyzing = false;
    updateAnalyzeState();
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

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), 60000);

  try {
    const isGuest = !authRef.isLoggedIn();
    const endpoint = isGuest ? '/analyze/guest' : '/analyze';
    const url = `${apiBase}${endpoint}`;

    const headers = isGuest
      ? { Accept: 'application/json' }
      : Object.assign({ Accept: 'application/json' }, authRef.authHeaders());

    const resp = await fetch(url, {
      method: 'POST',
      body: formData,
      headers,
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
      } else if (resp.status === 402 && data?.error === 'no_credits') {
        authRef.balance = Object.assign({}, authRef.balance || {}, { credits: 0, is_premium: false });
        helpersRef?.updateCreditsUI?.(authRef);
       
        helpersRef?.renderProfileView?.(authRef);
        if (area) {
          area.innerHTML = '<div class="ac-card"><b>Keine Credits mehr</b><p class="ac-subtle">Bitte warte auf den naechsten Reset oder upgrade.</p></div>';
        }
      } else {
        const msg = (data && (data.error || data.message)) || 'Analyse fehlgeschlagen';
        if (area) {
          area.innerHTML = `<div class="ac-card"><b>Fehler</b><p class="ac-subtle">${msg}</p></div>`;
        }
      }
      return;
    }

    // ✅ Erfolgsfall – hier bleibt das Layout wie vorher
    const real = data.real;
    const fake = data.fake;
    const msg = data.message || '';
    const details = Array.isArray(data.details) ? data.details : [];
    const cost = getAnalysisCost(mediaType);
    let usageInfo = '';

    if (data.usage) {
      if (authRef.isPremium()) {
        authRef.balance = Object.assign({}, authRef.balance || {}, { credits: null, is_premium: true });
      } else if (typeof data.usage.credits_left === 'number') {
        authRef.balance = Object.assign({}, authRef.balance || {}, {
          credits: data.usage.credits_left,
          is_premium: false,
        });
      }
      helpersRef?.updateCreditsUI?.(authRef);
    
      helpersRef?.renderProfileView?.(authRef);
      usageInfo = `<div class="ac-subtle" style="margin-top:8px">Quelle: ${
        String(data.usage.source || 'n/a')
      } &bull; Credits verbleibend: ${
        data.usage.credits_left == null ? '&infin;' : String(data.usage.credits_left)
      }</div>`;
    }

    if (!authRef.isLoggedIn()) {
      const currentGuest = typeof authRef.getGuestCredits === 'function' ? authRef.getGuestCredits() : 0;
      authRef.setGuestCredits?.(currentGuest - cost);
      helpersRef?.updateCreditsUI?.(authRef);
      
    }

    if (area) {
      area.innerHTML = `
        <div class="ac-card">
          <div class="ac-row" style="justify-content: space-between; align-items: baseline;">
            <div>
              <b>${real}% echt / ${fake}% KI</b>
              <p class="ac-subtle" style="margin:4px 0 0 0">${msg}</p>
            </div>
            <button id="toggleDetails" class="ac-ghost" style="font-size:12px;padding:4px 8px">Details</button>
          </div>
          <div id="inlineDetails" class="ac-subtle" style="display:none; margin-top:8px">
            <ul class="ac-compare-list">
              ${details.map((d) => `<li>${String(d)}</li>`).join('')}
            </ul>
          </div>
          ${usageInfo}
        </div>`;
       resultRendered = true;





      const btn = document.querySelector('#toggleDetails');
      const box = document.querySelector('#inlineDetails');
      if (btn && box) {
        btn.addEventListener('click', () => {
          const open = box.style.display !== 'none';
          box.style.display = open ? 'none' : 'block';
          btn.textContent = open ? 'Details' : 'Details verbergen';
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

  if (!resultRendered) {
    updateAnalyzeState();
  }

  unlockActiveButton();
}


      } catch (err) {
        console.error("🔥 FATAL ANALYZE ERROR:", err);
        throw err;
    }
}



function updateAnalyzeState() {

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


