/* AIRealCheck - script.js (stabile Analyse + Grundfunktionen) */

document.addEventListener('DOMContentLoaded', () => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  let isAnalyzing = false;
  let reqCounter = 0;

  // --- Auth helpers ---
  const auth = {
    token: localStorage.getItem('token') || null,
    user: null,
    setToken(t){ this.token = t; if(t){ localStorage.setItem('token', t); } else { localStorage.removeItem('token'); } },
    headers(){ return this.token ? { 'Authorization': 'Bearer ' + this.token } : {}; },
    async register(email, password){
      const resp = await fetch('http://127.0.0.1:5000/auth/register', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email, password }) });
      return await resp.json();
    },
    async login(email, password){
      const resp = await fetch('http://127.0.0.1:5000/auth/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await resp.json();
      if(resp.ok && data && data.ok && data.token){ this.setToken(data.token); this.user = data.user || null; }
      return data;
    },
    async me(){
      if(!this.token) return null;
      try{
        const resp = await fetch('http://127.0.0.1:5000/auth/me', { headers: this.headers() });
        const data = await resp.json();
        if(resp.ok && data && data.ok){ this.user = data.user; return this.user; }
      }catch(e){ /* ignore */ }
      return null;
    },
    async balance(){
      if(!this.token) return null;
      try{
        const resp = await fetch('http://127.0.0.1:5000/credits/balance', { headers: this.headers() });
        const data = await resp.json();
        if(resp.ok && data && data.ok){ return data; }
        return null;
      }catch(e){ return null; }
    }
  };

  // Seitenumschaltung (Start/History/Details/...) minimal funktionsfaehig
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
  };

  function showPage(name) {
    Object.values(pages).forEach((p) => p && p.classList.add('ac-hide'));
    const target = pages[name] || pages.start;
    if (target) target.classList.remove('ac-hide');
    $('#navStart')?.classList.toggle('ac-active', name === 'start');
    $('#navHistory')?.classList.toggle('ac-active', name === 'history');
  }

  $('#navStart')?.addEventListener('click', (e) => { e.preventDefault(); showPage('start'); });
  $('#navHistory')?.addEventListener('click', (e) => { e.preventDefault(); renderHistory(); showPage('history'); });
  $('#brandHome')?.addEventListener('click', (e) => { e.preventDefault(); showPage('start'); });

  // Sidebar Grundlogik
  const sidebar = $('#sidebar');
  const overlay = $('#overlay');
  $('#hamburger')?.addEventListener('click', (e) => {
    e.preventDefault();
    const open = sidebar?.classList.toggle('open');
    overlay?.classList.toggle('show', !!open);
  });
  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');
  });

  // Menü: oeffne Seiten oder setze Medientyp
  $('#menuList')?.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const [type, page, sub] = (el.dataset.action || '').split(':');
    if (type !== 'open') return;
    if (['video', 'image', 'audio'].includes(page)) {
      setMediaType(page);
      showPage('start');
    } else if (page === 'history') {
      renderHistory();
      showPage('history');
    } else if (page === 'legal') {
      showPage('legal');
      showLegal(sub || 'impressum');
    } else {
      showPage(page);
    }
    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');
  });

  // Media-Tabs (Video/Bild/Audio) + File/Link Umschalter
  function setMediaType(type) {
    $('#btnVideo')?.classList.toggle('ac-active', type === 'video');
    $('#btnImage')?.classList.toggle('ac-active', type === 'image');
    $('#btnAudio')?.classList.toggle('ac-active', type === 'audio');
    $('#blockVideo')?.classList.toggle('ac-hide', type !== 'video');
    $('#blockImage')?.classList.toggle('ac-hide', type !== 'image');
    $('#blockAudio')?.classList.toggle('ac-hide', type !== 'audio');
    $('#linkVideo')?.classList.toggle('ac-hide', type !== 'video');
    $('#linkImage')?.classList.toggle('ac-hide', type !== 'image');
    $('#linkAudio')?.classList.toggle('ac-hide', type !== 'audio');
  }
  setMediaType('image');
  $('#btnVideo')?.addEventListener('click', () => setMediaType('video'));
  $('#btnImage')?.addEventListener('click', () => setMediaType('image'));
  $('#btnAudio')?.addEventListener('click', () => setMediaType('audio'));

  $('#segFile')?.addEventListener('click', () => toggleMode('file'));
  $('#segLink')?.addEventListener('click', () => toggleMode('link'));
  function toggleMode(mode) {
    const isFile = mode === 'file';
    $('#fileInputs')?.classList.toggle('ac-hide', !isFile);
    $('#linkInputs')?.classList.toggle('ac-hide', isFile);
    $('#segFile')?.classList.toggle('ac-active', isFile);
    $('#segLink')?.classList.toggle('ac-active', !isFile);
  }

  function renderHistory() {
    const h = $('#historyList');
    if (h) h.innerHTML = '<div class="ac-subtle">Noch keine Eintraege.</div>';
  }
  function showLegal(section) {
    const c = $('#legalContent');
    if (!c) return;
    if (section === 'impressum') c.innerHTML = '<h3>Impressum</h3><p>Folgt.</p>';
    else if (section === 'privacy') c.innerHTML = '<h3>Datenschutz</h3><p>Folgt.</p>';
    else if (section === 'tac') c.innerHTML = '<h3>AGB</h3><p>Folgt.</p>';
  }

  // Buttons an Analyse binden (nur Datei-Uploads)
  $$('.ac-primary[data-kind]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const kind = btn.dataset.kind;
      const mode = btn.dataset.mode || 'file';
      if (isAnalyzing) return; // blocke Mehrfachklicks
      // Ensure authenticated and has credits
      if(!auth.token){
        openAuthModal();
        return;
      }
      if (mode !== 'file') {
        const area = document.querySelector('#analysisArea');
        if (area) area.innerHTML = '<div class="ac-card"><b>Nur Datei-Uploads werden aktuell unterstuetzt.</b></div>';
        return;
      }
      analyzeFile(kind);
    });
  });

  // Echte Analysefunktion (nur Bilder aktiv)
  async function analyzeFile(mediaType) {
    isAnalyzing = true;
    reqCounter += 1;
    const myReq = reqCounter;
    // Buttons temporär deaktivieren
    const analyzeBtns = Array.from(document.querySelectorAll('.ac-primary[data-kind]'));
    analyzeBtns.forEach(b => b.setAttribute('disabled', 'disabled'));
    const idMap = { image: '#imageInput', video: '#videoInput', audio: '#audioInput' };
    const fileInput = document.querySelector(idMap[mediaType] || '#imageInput');
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (!file) {
      alert('Bitte zuerst eine Datei auswaehlen!');
      return;
    }

    if (mediaType !== 'image') {
      const area = document.querySelector('#analysisArea');
      if (area) area.innerHTML = '<div class="ac-card"><b>Nur Bilder werden aktuell unterstuetzt.</b></div>';
      return;
    }

    const area = document.querySelector('#analysisArea');
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

    try {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 45000);
      // Check credits before sending
      try {
        const bal = await auth.balance();
        if(bal && !bal.is_premium && (bal.credits === 0 || bal.credits === null)){
          if (area) area.innerHTML = '<div class="ac-card"><b>Keine Credits verfuegbar</b><p class="ac-subtle">Bitte spaeter erneut versuchen.</p></div>';
          isAnalyzing = false; analyzeBtns.forEach(b => b.removeAttribute('disabled'));
          return;
        }
      } catch(e){}

      const resp = await fetch('http://127.0.0.1:5000/analyze', {
        method: 'POST',
        body: formData,
        headers: Object.assign({ 'Accept': 'application/json' }, auth.headers()),
        signal: controller.signal,
      });
      clearTimeout(to);

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

      // Nur letztes Ergebnis anzeigen
      if (myReq !== reqCounter) return;

      if (!resp.ok || !data || data.ok === false) {
        const msg = (data && (data.error || data.message)) || 'Analyse fehlgeschlagen';
        if (area) area.innerHTML = `<div class="ac-card"><b>Fehler</b><p class="ac-subtle">${msg}</p></div>`;
      } else {
        const real = data.real;
        const fake = data.fake;
        const msg = data.message || '';
        const details = Array.isArray(data.details) ? data.details : [];

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
              ${data && data.usage ? `<div class="ac-subtle" style="margin-top:8px">Quelle: ${String(data.usage.source || 'n/a')} • Credits verbleibend: ${data.usage.credits_left == null ? '∞' : String(data.usage.credits_left)}</div>` : ''}
            </div>`;

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
      }
    } catch (err) {
      if (myReq === reqCounter && area) {
        const msg = (err && err.name === 'AbortError') ? 'Zeitüberschreitung bei der Verbindung.' : 'Verbindung zum Server fehlgeschlagen.';
        area.innerHTML = `<div class="ac-card"><b>Fehler</b><p class="ac-subtle">${msg}</p></div>`;
      }
      console.error('Analyse-Fehler:', err);
    }
    // Buttons wieder aktivieren
    isAnalyzing = false;
    analyzeBtns.forEach(b => b.removeAttribute('disabled'));
  }

  // Demo-Funktionen endgueltig neutralisieren
  try { window.startFakeAnalysis = function(){}; window.showFakeResult = function(){}; } catch(e) {}

  // Erste Seite sichtbar machen
  showPage('start');

  // --- Minimal Auth UI ---
  function updateCreditsBox(bal){
    const box = $('#creditsText');
    if(!box) return;
    if(!bal){ box.textContent = '—'; return; }
    const text = bal.is_premium ? 'Premium ∞' : `${bal.credits} Credits`;
    box.textContent = text;
  }

  async function refreshAuthState(){
    if(!auth.token) { updateCreditsBox(null); return; }
    await auth.me();
    const bal = await auth.balance();
    updateCreditsBox(bal);
  }

  function openAuthModal(){
    const modal = $('#authModal');
    if(modal) modal.style.display = 'block';
  }
  function closeAuthModal(){
    const modal = $('#authModal');
    if(modal) modal.style.display = 'none';
  }

  $('#loginQuick')?.addEventListener('click', (e) => { e.preventDefault(); openAuthModal(); });
  $('#authClose')?.addEventListener('click', (e) => { e.preventDefault(); closeAuthModal(); });
  $('#authDoLogin')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = String($('#authEmail')?.value||'').trim();
    const password = String($('#authPassword')?.value||'');
    if(!email || !password){ alert('Bitte E-Mail und Passwort eingeben'); return; }
    const res = await auth.login(email, password);
    if(res && res.ok){ closeAuthModal(); refreshAuthState(); }
    else { alert('Login fehlgeschlagen'); }
  });
  $('#authDoRegister')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = String($('#authEmail')?.value||'').trim();
    const password = String($('#authPassword')?.value||'');
    if(!email || !password || password.length < 8){ alert('Passwort min. 8 Zeichen'); return; }
    const res = await auth.register(email, password);
    if(res && res.ok){ alert('Registrierung erfolgreich. Bitte einloggen.'); }
    else if(res && res.error === 'email_exists'){ alert('E-Mail bereits registriert.'); }
    else { alert('Registrierung fehlgeschlagen'); }
  });

  refreshAuthState();
});
