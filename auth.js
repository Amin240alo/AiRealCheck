const $ = (sel) => document.querySelector(sel);
const TOKEN_KEY = 'airealcheck_token';
const LEGACY_TOKEN_KEY = 'aireal_token';
const RETURN_TO_KEY = 'airealcheck_return_to';

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(v)) return true;
    if (['0', 'false', 'no', 'off'].includes(v)) return false;
  }
  return fallback;
}

function readStoredToken(persistToken) {
  if (!persistToken) return null;
  try {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
  } catch (err) {
    return null;
  }
}

function migrateLegacyToken(token, persistToken) {
  if (!persistToken || !token) return;
  try {
    const hasNew = localStorage.getItem(TOKEN_KEY);
    const hasLegacy = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (!hasNew && hasLegacy) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
  } catch (err) {
    // ignore storage errors
  }
}

function consumeReturnPath() {
  try {
    const raw = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    if (!raw) return '/';
    const normalized = String(raw);
    const pathOnly = normalized.split('?')[0];
    if (!pathOnly.startsWith('/')) return '/';
    if (['/login', '/auth/callback'].includes(pathOnly)) return '/';
    return normalized;
  } catch (err) {
    return '/';
  }
}

function readTokenFromHash() {
  const hash = window.location.hash || '';
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  return (params.get('token') || '').trim();
}

function clearUrlHash() {
  if (!window.location.hash) return;
  try {
    history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
  } catch (err) {
    // ignore history errors
  }
}

function normalizeApiBase(base) {
  const raw = (base || '').trim();
  return raw ? raw.replace(/\/+$/, '') : 'http://127.0.0.1:5001';
}

export function createAuth(apiBaseInput, config = {}) {
  const listeners = new Set();
  const options = {
    apiBase: normalizeApiBase(apiBaseInput || config.apiBase || config.api_base),
    enableGuestAnalyze: parseBoolean(config.enableGuestAnalyze ?? config.enable_guest_analyze, false),
    persistToken: parseBoolean(config.persistToken ?? config.persist_token, true),
  };
  const storedToken = readStoredToken(options.persistToken);
  let navigator = null;

  const auth = {
    token: storedToken,
    user: null,
    balance: null,
    notice: null,
    noticeTone: 'info',
    loading: false,
    config: options,
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
    setNavigator(fn) {
      navigator = typeof fn === 'function' ? fn : null;
    },
    navigate(path) {
      if (navigator) navigator(path);
      else if (path) window.location.assign(path);
    },
    setNotice(message, tone = 'info') {
      this.notice = message;
      this.noticeTone = tone || 'info';
      this.notify();
    },
    consumeNotice() {
      const payload = { message: this.notice, tone: this.noticeTone };
      this.notice = null;
      this.noticeTone = 'info';
      return payload;
    },
    clearNotice() {
      this.notice = null;
      this.noticeTone = 'info';
    },
    getToken() {
      return this.token;
    },
    getApiBase() {
      return options.apiBase;
    },
    authHeaders() {
      return this.token ? { Authorization: `Bearer ${this.token}` } : {};
    },
    apiFetch,
    setToken(token) {
      this.token = token || null;
      if (options.persistToken) {
        try {
          if (token) localStorage.setItem(TOKEN_KEY, token);
          else localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(LEGACY_TOKEN_KEY);
        } catch (err) {
          // ignore storage errors
        }
      }
    },
    clearToken() {
      this.setToken(null);
      this.user = null;
      this.balance = null;
    },
    clearSession() {
      this.clearToken();
    },
    isLoggedIn() {
      return !!this.token;
    },
    isAdmin() {
      return !!this.user?.is_admin;
    },
    isPremium() {
      const plan = String(this.balance?.plan_type || this.user?.plan_type || '').toLowerCase();
      const active = this.balance?.subscription_active ?? this.user?.subscription_active;
      if (!plan || plan === 'free') return false;
      return !!active;
    },
    isEmailVerified() {
      if (!this.user) return false;
      return !!this.user.email_verified;
    },
    canUseGuest() {
      return !this.isLoggedIn() && !!options.enableGuestAnalyze;
    },
    async login(email, password) {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
        credentials: 'include',
      });
      if (!data?.token) throw new Error('login_failed');
      this.setToken(data.token);
      this.user = data.user || null;
      await this.fetchBalance(true);
      this.notify();
      return data;
    },
    async register(email, password, displayName, consentTerms = false) {
      return apiFetch('/auth/register', {
        method: 'POST',
        body: {
          email,
          password,
          display_name: displayName,
          consent_terms: !!consentTerms,
        },
        credentials: 'include',
      });
    },
    async verifyEmail(token) {
      return apiFetch('/auth/verify', {
        method: 'POST',
        body: { token },
        credentials: 'include',
      });
    },
    async resendVerify() {
      return apiFetch('/auth/resend-verify', {
        method: 'POST',
        credentials: 'include',
      });
    },
    async forgot(email) {
      return apiFetch('/auth/forgot', {
        method: 'POST',
        body: { email },
        credentials: 'include',
      });
    },
    async resetPassword(token, password) {
      return apiFetch('/auth/reset', {
        method: 'POST',
        body: { token, password },
        credentials: 'include',
      });
    },
    async refresh() {
      try {
        const data = await apiFetch('/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (!data?.token) return false;
        this.setToken(data.token);
        this.user = data.user || null;
        await this.fetchBalance(true);
        this.notify();
        return true;
      } catch (err) {
        return false;
      }
    },
    async fetchMe() {
      if (!this.token) return null;
      try {
        const data = await apiFetch('/auth/me', { credentials: 'include' });
        this.user = data.user || null;
        this.notify();
        return this.user;
      } catch (err) {
        if (err?.status === 401 || err?.status === 403) {
          this.clearSession();
          this.notify();
        }
        return null;
      }
    },
    async fetchBalance(shouldNotify = false) {
      if (!this.token) return null;
      try {
        const data = await apiFetch('/api/credits', { credentials: 'include' });
        this.balance = {
          plan_type: data.plan_type,
          subscription_active: data.subscription_active,
          credits_total: data.credits_total,
          credits_used: data.credits_used,
          credits_available: data.credits_available,
          last_credit_reset: data.last_credit_reset,
        };
        if (this.user) {
          this.user.plan_type = data.plan_type;
          this.user.subscription_active = data.subscription_active;
          this.user.credits_total = data.credits_total;
          this.user.credits_used = data.credits_used;
          this.user.last_credit_reset = data.last_credit_reset;
        }
        if (shouldNotify) this.notify();
        return this.balance;
      } catch (err) {
        return null;
      }
    },
    async bootstrap() {
      const hasStoredToken = options.persistToken && !!readStoredToken(options.persistToken);
      const shouldRefresh = hasStoredToken || this.isLoggedIn();
      const refreshed = shouldRefresh ? await this.refresh() : false;
      if (!refreshed && this.token) {
        const me = await this.fetchMe();
        if (me) await this.fetchBalance(true);
      }
      if (!this.token) {
        this.clearSession();
      }
      this.notify();
    },
    async logout(reason) {
      try {
        await apiFetch('/auth/logout', { method: 'POST', credentials: 'include' });
      } catch (err) {
        // ignore
      }
      this.clearSession();
      if (reason) this.setNotice(reason, 'info');
      this.notify();
      this.navigate('/login');
    },
    requireSession() {
      if (this.isLoggedIn()) return true;
      this.setNotice('Bitte zuerst einloggen.', 'info');
      this.navigate('/login');
      return false;
    },
  };

  async function apiFetch(path, { method = 'GET', body = null, headers = {}, credentials = 'include' } = {}) {
    const finalHeaders = Object.assign({ Accept: 'application/json' }, headers, auth.authHeaders());
    const opts = { method, headers: finalHeaders, credentials };
    if (body instanceof FormData) {
      opts.body = body;
      delete opts.headers['Content-Type'];
    } else if (body !== null && body !== undefined) {
      opts.body = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${options.apiBase}${path}`, opts);
    let data = null;
    try {
      data = await response.clone().json();
    } catch (err) {
      data = null;
    }
    if (!response.ok) {
      const error = new Error((data && (data.error || data.message)) || 'request_failed');
      error.status = response.status;
      error.response = data;
      throw error;
    }
    return data;
  }

  migrateLegacyToken(storedToken, options.persistToken);
  return auth;
}

function setAlert(el, message, tone = 'error') {
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    el.dataset.tone = 'error';
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.dataset.tone = tone || 'error';
}

function setLoading(btn, state) {
  if (!btn) return;
  btn.disabled = state;
  btn.classList.toggle('is-loading', state);
}

function resolveAuthError(err, mode = 'login') {
  const code = err?.response?.error;
  if (code === 'email_exists') return 'Diese E-Mail ist bereits registriert.';
  if (code === 'invalid_credentials') return 'E-Mail oder Passwort ist falsch.';
  if (code === 'invalid_input') return 'Bitte alle Felder korrekt ausfüllen.';
  if (code === 'invalid_token') return 'Der Link ist ungültig oder abgelaufen.';
  if (code === 'email_not_verified') return 'Bitte bestätige zuerst deine E-Mail.';
  if (code === 'smtp_not_configured') return 'E-Mail-Versand ist in dieser Umgebung nicht aktiv.';
  if (code === 'email_send_failed') return 'E-Mail konnte nicht versendet werden. Bitte spÃ¤ter erneut versuchen.';
  if (code === 'terms_not_accepted') return 'Bitte AGB und Datenschutz akzeptieren.';
  if (code === 'rate_limited' || err?.status === 429) return 'Zu viele Versuche. Bitte kurz warten und erneut probieren.';
  if (err?.status === 403) return 'Aktion nicht erlaubt.';
  if (err?.status >= 500) return 'Serverfehler. Bitte später erneut probieren.';
  return mode === 'login' ? 'Login fehlgeschlagen.' : 'Aktion fehlgeschlagen.';
}

export function initAuthPages(auth, router) {
  const loginForm = $('#loginForm');
  const loginEmail = $('#loginEmail');
  const loginPassword = $('#loginPassword');
  const loginNotice = $('#loginNotice');
  const loginSubmit = $('#loginSubmit');
  const googleLoginBtn = $('#googleLoginBtn');

  const registerForm = $('#registerForm');
  const registerName = $('#registerName');
  const registerEmail = $('#registerEmail');
  const registerPassword = $('#registerPassword');
  const registerPasswordConfirm = $('#registerPasswordConfirm');
  const registerConsent = $('#registerConsent');
  const registerNotice = $('#registerNotice');
  const registerSubmit = $('#registerSubmit');
  const registerSuccess = $('#registerSuccess');
  const registerSuccessEmail = $('#registerSuccessEmail');

  const forgotForm = $('#forgotForm');
  const forgotEmail = $('#forgotEmail');
  const forgotNotice = $('#forgotNotice');
  const forgotSuccess = $('#forgotSuccess');
  const forgotSubmit = $('#forgotSubmit');

  const resetForm = $('#resetForm');
  const resetPassword = $('#resetPassword');
  const resetPasswordConfirm = $('#resetPasswordConfirm');
  const resetNotice = $('#resetNotice');
  const resetSuccess = $('#resetSuccess');
  const resetSubmit = $('#resetSubmit');

  const verifyStatus = $('#verifyStatus');
  const verifyIcon = $('#verifyIcon');
  const verifyTitle = $('#verifyTitle');
  const verifyMessage = $('#verifyMessage');
  const oauthStatus = $('#oauthStatus');
  const oauthIcon = $('#oauthIcon');
  const oauthTitle = $('#oauthTitle');
  const oauthMessage = $('#oauthMessage');
  const googleRegisterBtn = $('#googleRegisterBtn');

  let lastVerifyToken = null;
  let verifyInFlight = false;
  let oauthInFlight = false;
  let lastOauthToken = null;
  const passwordFields = [
    loginPassword,
    registerPassword,
    registerPasswordConfirm,
    resetPassword,
    resetPasswordConfirm,
  ].filter(Boolean);
  const passwordToggles = Array.from(document.querySelectorAll('[data-password-toggle]'));

  function routeToken() {
    const params = new URLSearchParams(window.location.search || '');
    return (params.get('token') || '').trim();
  }

  function showOauthErrorNotice() {
    if (!loginNotice) return;
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('oauth_error')) {
      setAlert(loginNotice, 'Google-Login fehlgeschlagen. Bitte erneut versuchen.', 'error');
    }
  }

  function setOauthStatus(state, title, message, icon) {
    if (!oauthStatus) return;
    if (state) oauthStatus.dataset.state = state;
    if (oauthIcon && icon) oauthIcon.textContent = icon;
    if (oauthTitle && title) oauthTitle.textContent = title;
    if (oauthMessage && message) oauthMessage.textContent = message;
  }

  function startGoogleLogin() {
    const apiBase = auth?.getApiBase?.() || auth?.config?.apiBase;
    if (!apiBase) return;
    window.location.assign(`${apiBase}/auth/google`);
  }

  function clearSensitiveFields() {
    passwordFields.forEach((input) => {
      input.value = '';
      input.type = 'password';
    });
    passwordToggles.forEach((btn) => {
      btn.classList.remove('is-visible');
      btn.setAttribute('aria-pressed', 'false');
    });
  }

  function bindPasswordToggles() {
    passwordToggles.forEach((btn) => {
      if (btn.dataset.bound === 'true') return;
      btn.dataset.bound = 'true';
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-password-toggle');
        const input = targetId ? document.getElementById(targetId) : null;
        if (!input) return;
        const makeVisible = input.type === 'password';
        input.type = makeVisible ? 'text' : 'password';
        btn.classList.toggle('is-visible', makeVisible);
        btn.setAttribute('aria-pressed', String(makeVisible));
      });
    });
  }

  function showLoginNoticeFromAuth() {
    if (!loginNotice) return;
    const notice = auth.consumeNotice();
    if (notice?.message) {
      setAlert(loginNotice, notice.message, notice.tone || 'info');
    }
  }

  router?.subscribe((path) => {
    clearSensitiveFields();
    if (path === '/login') {
      showLoginNoticeFromAuth();
      showOauthErrorNotice();
    } else if (loginNotice) {
      setAlert(loginNotice, '');
    }
    if (path === '/register') {
      if (registerNotice) setAlert(registerNotice, '');
    }
    if (path === '/forgot-password') {
      if (forgotNotice) setAlert(forgotNotice, '');
    }
    if (path === '/reset-password') {
      if (resetNotice) setAlert(resetNotice, '');
    }
    if (path === '/auth/callback') {
      handleOauthCallback();
    }
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (loginEmail?.value || '').trim().toLowerCase();
    const password = loginPassword?.value || '';
    if (!email || !password) {
      setAlert(loginNotice, 'Bitte E-Mail und Passwort eingeben.', 'error');
      return;
    }
    setAlert(loginNotice, '');
    setLoading(loginSubmit, true);
    try {
      await auth.login(email, password);
      auth.clearNotice();
      setAlert(loginNotice, '');
      clearSensitiveFields();
      auth.navigate('/');
    } catch (err) {
      setAlert(loginNotice, resolveAuthError(err, 'login'), 'error');
    } finally {
      setLoading(loginSubmit, false);
    }
  });

  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayName = (registerName?.value || '').trim();
    const email = (registerEmail?.value || '').trim().toLowerCase();
    const password = registerPassword?.value || '';
    const confirm = registerPasswordConfirm?.value || '';
    const consentAccepted = !!registerConsent?.checked;
    if (!displayName) {
      setAlert(registerNotice, 'Bitte deinen Namen eingeben.', 'error');
      return;
    }
    if (!email || !password || password.length < 8) {
      setAlert(registerNotice, 'Passwort muss mindestens 8 Zeichen haben.', 'error');
      return;
    }
    if (password !== confirm) {
      setAlert(registerNotice, 'Passwörter stimmen nicht überein.', 'error');
      return;
    }
    if (!consentAccepted) {
      setAlert(registerNotice, 'Bitte AGB und Datenschutz akzeptieren.', 'error');
      return;
    }
    setAlert(registerNotice, '');
    setLoading(registerSubmit, true);
    try {
      await auth.register(email, password, displayName, consentAccepted);
      try {
        await auth.login(email, password);
        auth.clearNotice();
        setAlert(registerNotice, '');
        clearSensitiveFields();
        auth.navigate('/');
        return;
      } catch (loginErr) {
        clearSensitiveFields();
        if (registerSuccessEmail) registerSuccessEmail.textContent = email;
        registerSuccess?.classList.remove('ac-hide');
        registerForm?.classList.add('ac-hide');
      }
    } catch (err) {
      setAlert(registerNotice, resolveAuthError(err, 'register'), 'error');
    } finally {
      setLoading(registerSubmit, false);
    }
  });

  forgotForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (forgotEmail?.value || '').trim().toLowerCase();
    if (!email) {
      setAlert(forgotNotice, 'Bitte E-Mail eingeben.', 'error');
      return;
    }
    setAlert(forgotNotice, '');
    setLoading(forgotSubmit, true);
    try {
      await auth.forgot(email);
      forgotSuccess?.classList.remove('ac-hide');
    } catch (err) {
      setAlert(forgotNotice, resolveAuthError(err, 'forgot'), 'error');
    } finally {
      setLoading(forgotSubmit, false);
    }
  });

  resetForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = routeToken();
    const password = resetPassword?.value || '';
    const confirm = resetPasswordConfirm?.value || '';
    if (!token) {
      setAlert(resetNotice, 'Reset-Link fehlt.', 'error');
      return;
    }
    if (!password || password.length < 8) {
      setAlert(resetNotice, 'Passwort muss mindestens 8 Zeichen haben.', 'error');
      return;
    }
    if (password !== confirm) {
      setAlert(resetNotice, 'Passwörter stimmen nicht überein.', 'error');
      return;
    }
    setAlert(resetNotice, '');
    setLoading(resetSubmit, true);
    try {
      await auth.resetPassword(token, password);
      clearSensitiveFields();
      resetSuccess?.classList.remove('ac-hide');
      resetForm?.classList.add('ac-hide');
    } catch (err) {
      setAlert(resetNotice, resolveAuthError(err, 'reset'), 'error');
    } finally {
      setLoading(resetSubmit, false);
    }
  });

  async function handleVerifyRoute() {
    if (!verifyStatus || verifyInFlight) return;
    const token = routeToken();
    if (!token) {
      verifyStatus.dataset.state = 'error';
      if (verifyIcon) verifyIcon.textContent = '!';
      if (verifyTitle) verifyTitle.textContent = 'Token fehlt';
      if (verifyMessage) verifyMessage.textContent = 'Bitte nutze den Link aus der E-Mail.';
      return;
    }
    if (token === lastVerifyToken) return;
    lastVerifyToken = token;
    verifyInFlight = true;
    verifyStatus.dataset.state = 'loading';
    if (verifyIcon) verifyIcon.textContent = '…';
    if (verifyTitle) verifyTitle.textContent = 'Bestätigung prüfen…';
    if (verifyMessage) verifyMessage.textContent = 'Wir prüfen deinen Link.';
    try {
      await auth.verifyEmail(token);
      verifyStatus.dataset.state = 'success';
      if (verifyIcon) verifyIcon.textContent = '✓';
      if (verifyTitle) verifyTitle.textContent = 'E-Mail bestätigt';
      if (verifyMessage) verifyMessage.textContent = 'Du kannst dich jetzt anmelden.';
    } catch (err) {
      verifyStatus.dataset.state = 'error';
      if (verifyIcon) verifyIcon.textContent = '!';
      if (verifyTitle) verifyTitle.textContent = 'Bestätigung fehlgeschlagen';
      if (verifyMessage) verifyMessage.textContent = resolveAuthError(err, 'verify');
    } finally {
      verifyInFlight = false;
    }
  }

  async function handleOauthCallback() {
    if (!oauthStatus || oauthInFlight) return;
    const token = readTokenFromHash();
    if (!token) {
      setOauthStatus('error', 'Token fehlt', 'Bitte erneut anmelden.', '!');
      clearUrlHash();
      auth.clearSession();
      auth.navigate('/login?oauth_error=1');
      return;
    }
    if (token === lastOauthToken) return;
    lastOauthToken = token;
    oauthInFlight = true;
    setOauthStatus('loading', 'Anmeldung abschliessen...', 'Wir melden dich an und laden dein Profil.', '...');
    clearUrlHash();
    auth.setToken(token);
    try {
      const me = await auth.fetchMe();
      if (!me) throw new Error('oauth_me_failed');
      await auth.fetchBalance(true);
      setOauthStatus('success', 'Angemeldet', 'Weiterleitung...', 'OK');
      const target = consumeReturnPath();
      auth.navigate(target);
    } catch (err) {
      auth.clearSession();
      setOauthStatus('error', 'Anmeldung fehlgeschlagen', 'Bitte erneut anmelden.', '!');
      auth.navigate('/login?oauth_error=1');
    } finally {
      oauthInFlight = false;
    }
  }

  router?.subscribe((path) => {
    if (path === '/verify-email') {
      handleVerifyRoute();
    }
    if (path === '/register') {
      registerSuccess?.classList.add('ac-hide');
      registerForm?.classList.remove('ac-hide');
    }
    if (path === '/reset-password') {
      resetSuccess?.classList.add('ac-hide');
      resetForm?.classList.remove('ac-hide');
    }
    if (path === '/forgot-password') {
      forgotSuccess?.classList.add('ac-hide');
    }
  });

  googleLoginBtn?.addEventListener('click', () => startGoogleLogin());
  googleRegisterBtn?.addEventListener('click', () => {
    if (!registerConsent?.checked) {
      setAlert(registerNotice, 'Bitte AGB und Datenschutz akzeptieren.', 'error');
      return;
    }
    startGoogleLogin();
  });
  bindPasswordToggles();
}
