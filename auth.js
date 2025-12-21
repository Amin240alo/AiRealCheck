const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const GUEST_CREDITS_KEY = 'guest_credits';
const DEFAULT_GUEST_CREDITS = 100;

function loadGuestCredits() {
  const raw = localStorage.getItem(GUEST_CREDITS_KEY);
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  localStorage.setItem(GUEST_CREDITS_KEY, String(DEFAULT_GUEST_CREDITS));
  return DEFAULT_GUEST_CREDITS;
}

export function createAuth(API_BASE) {
  const overlay = $('#authOverlay');
  const closeBtn = $('#authClose');
  const form = $('#authForm');
  const emailInput = $('#authEmail');
  const passwordInput = $('#authPassword');
  const errorBox = $('#authError');
  const submitBtn = $('#authSubmit');
  const submitLabel = $('#authSubmitLabel');
  const tabs = $$('.auth-tab');
  const passwordToggle = $('#authTogglePassword');
  const passwordWrap = passwordInput?.closest('.auth-input-wrap') || passwordInput?.parentElement;

  const listeners = new Set();

  const auth = {
    token: localStorage.getItem('aireal_token') || null,
    user: null,
    balance: null,
    mode: 'login',
    loading: false,
    guestCredits: loadGuestCredits(),
    subscribe(fn) {
      if (typeof fn === 'function') {
        listeners.add(fn);
        return () => listeners.delete(fn);
      }
      return () => {};
    },
    notify() {
      listeners.forEach((cb) => {
        try {
          cb(auth);
        } catch (err) {
          console.error('Auth listener error:', err);
        }
      });
    },
    authHeaders() {
      return this.token ? { Authorization: `Bearer ${this.token}` } : {};
    },
    getGuestCredits() {
      if (typeof this.guestCredits !== 'number') {
        this.guestCredits = loadGuestCredits();
      }
      return this.guestCredits;
    },
    setGuestCredits(value) {
      const safeValue = Math.max(0, Math.floor(Number(value)));
      this.guestCredits = safeValue;
      localStorage.setItem(GUEST_CREDITS_KEY, String(safeValue));
      this.notify();
    },
    resetGuestCredits() {
      this.guestCredits = DEFAULT_GUEST_CREDITS;
      localStorage.setItem(GUEST_CREDITS_KEY, String(DEFAULT_GUEST_CREDITS));
      this.notify();
    },
    clearGuestCredits() {
      this.guestCredits = null;
      localStorage.removeItem(GUEST_CREDITS_KEY);
    },
    isLoggedIn() {
      return !!this.token;
    },
    isPremium() {
      return !!(this.user?.is_premium || this.balance?.is_premium);
    },
    isAdmin() {
      return !!(this.user?.is_admin);
    },
    setMode(mode = 'login') {
      this.mode = mode;
      tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.authMode === mode));
      if (submitLabel) submitLabel.textContent = mode === 'login' ? 'Login' : 'Registrieren';
    },
    open(mode = 'login') {
      this.setMode(mode);
      overlay?.classList.add('open');
      overlay?.setAttribute('aria-hidden', 'false');
      setTimeout(() => emailInput?.focus(), 50);
    },
    close() {
      overlay?.classList.remove('open');
      overlay?.setAttribute('aria-hidden', 'true');
      this.setError('');
      form?.reset();
      if (passwordInput) passwordInput.type = 'password';
      passwordToggle?.classList.remove('visible');
      this.toggleLoading(false);
    },
    setToken(token) {
      this.token = token;
      if (token) {
        localStorage.setItem('aireal_token', token);
      } else {
        localStorage.removeItem('aireal_token');
      }
    },
    setError(message, tone = 'error') {
      if (!errorBox) return;
      if (!message) {
        errorBox.hidden = true;
        errorBox.textContent = '';
        errorBox.dataset.tone = 'error';
      } else {
        errorBox.hidden = false;
        errorBox.textContent = message;
        errorBox.dataset.tone = tone;
        if (tone === 'error' && passwordWrap) {
          passwordWrap.classList.remove('auth-shake');
          void passwordWrap.offsetWidth; // force reflow
          passwordWrap.classList.add('auth-shake');
        }
      }
    },
    toggleLoading(state) {
      this.loading = state;
      if (submitBtn) {
        submitBtn.disabled = state;
        submitBtn.classList.toggle('is-loading', state);
      }
    },
    async login() {
      const email = (emailInput?.value || '').trim().toLowerCase();
      const password = passwordInput?.value || '';
      if (!email || !password) {
        this.setError('Bitte E-Mail und Passwort eingeben.');
        return;
      }
      this.setError('');
      this.toggleLoading(true);
      try {
        const data = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
        if (!data?.token) throw new Error('login_failed');
        this.setToken(data.token);
        this.user = data.user || null;
        await this.fetchBalance(true);
        this.clearGuestCredits();
        this.close();
      } catch (err) {
        this.setError(resolveAuthError(err, 'login'));
      } finally {
        this.toggleLoading(false);
      }
    },
    async register() {
      const email = (emailInput?.value || '').trim().toLowerCase();
      const password = passwordInput?.value || '';
      if (!email || !password || password.length < 8) {
        this.setError('Passwort muss mindestens 8 Zeichen haben.');
        return;
      }
      this.setError('');
      this.toggleLoading(true);
      try {
        await apiRequest('/auth/register', { method: 'POST', body: { email, password } });
        this.setMode('login');
        this.toggleLoading(false);
        await this.login();
      } catch (err) {
        this.toggleLoading(false);
        this.setError(resolveAuthError(err, 'register'));
      }
    },
    async fetchMe() {
      if (!this.token) return null;
      try {
        const data = await apiRequest('/auth/me');
        this.user = data.user;
        this.notify();
        return data.user;
      } catch (err) {
        return null;
      }
    },
    async fetchBalance(shouldNotify = false) {
      if (!this.token) return null;
      try {
        const data = await apiRequest('/credits/balance');
        this.balance = {
          credits: data.credits,
          is_premium: data.is_premium,
          reset_at: data.reset_at,
        };
        if (this.user) this.user.is_premium = data.is_premium;
        if (shouldNotify) this.notify();
        return this.balance;
      } catch (err) {
        return null;
      }
    },
    async refreshContext() {
      if (!this.token) return;
      await this.fetchMe();
      await this.fetchBalance(true);
    },
    async bootstrap() {
      if (!this.token) {
        if (typeof this.guestCredits !== 'number') {
          this.guestCredits = loadGuestCredits();
        }
        this.notify();
        return;
      }
      await this.refreshContext();
    },
    async logout(reason) {
      this.setToken(null);
      this.user = null;
      this.balance = null;
      this.resetGuestCredits();
      if (reason) {
        this.open('login');
        this.setError(reason, 'info');
      }
    },
    requireSession() {
      if (this.isLoggedIn()) return true;
      this.open('login');
      this.setError('Bitte zuerst einloggen.', 'info');
      return false;
    },
  };

  async function apiRequest(path, { method = 'GET', body = null, headers = {} } = {}) {
    const finalHeaders = Object.assign({ Accept: 'application/json' }, headers, auth.authHeaders());
    const opts = { method, headers: finalHeaders };
    if (body instanceof FormData) {
      opts.body = body;
      delete opts.headers['Content-Type'];
    } else if (body !== null && body !== undefined) {
      opts.body = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${API_BASE}${path}`, opts);
    let data = null;
    try {
      data = await response.clone().json();
    } catch (err) {
      data = null;
    }
    if (response.status === 401 && auth.token) {
      await auth.logout('Deine Session ist abgelaufen. Bitte erneut einloggen.');
    }
    if (!response.ok) {
      const error = new Error((data && (data.error || data.message)) || 'request_failed');
      error.status = response.status;
      error.response = data;
      throw error;
    }
    return data;
  }

  function resolveAuthError(err, mode = 'login') {
    const code = err?.response?.error;
    if (code === 'email_exists') return 'Diese E-Mail ist bereits registriert.';
    if (code === 'invalid_credentials') return 'E-Mail oder Passwort ist falsch.';
    if (code === 'invalid_input') return 'Bitte alle Felder korrekt ausfuellen.';
    if (code === 'auth_required') return 'Bitte melde dich zuerst an.';
    if (err?.status >= 500) return 'Serverfehler. Bitte spaeter erneut probieren.';
    return mode === 'login' ? 'Login fehlgeschlagen.' : 'Registrierung fehlgeschlagen.';
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (auth.loading) return;
    if (auth.mode === 'login') await auth.login();
    else await auth.register();
  });

  form?.addEventListener('input', () => {
    auth.setError('');
    passwordWrap?.classList.remove('auth-shake');
  });

  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    auth.close();
  });

  let overlayPointerDown = false;
  overlay?.addEventListener('pointerdown', (e) => {
    overlayPointerDown = e.target === overlay;
  });
  overlay?.addEventListener('pointerup', (e) => {
    if (overlayPointerDown && e.target === overlay) auth.close();
    overlayPointerDown = false;
  });
  overlay?.addEventListener('pointerleave', () => {
    overlayPointerDown = false;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.classList.contains('open')) auth.close();
  });

  tabs.forEach((tab) => tab.addEventListener('click', () => auth.setMode(tab.dataset.authMode)));

  passwordToggle?.addEventListener('click', () => {
    if (!passwordInput) return;
    const visible = passwordInput.type === 'password';
    passwordInput.type = visible ? 'text' : 'password';
    passwordToggle.classList.toggle('visible', visible);
  });

  return auth;
}
