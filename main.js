import { createAuth, initAuthPages } from './auth.js';
import { initUI, updateProfileView, updateCreditsUI, updateAnalyzeButtons, initRouter } from '/ui.js?v=20260307_3';
import { initAnalyze } from './analyze.js';
import { initAdminPanel } from './admin.js';

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(v)) return true;
    if (['0', 'false', 'no', 'off'].includes(v)) return false;
  }
  return fallback;
}

async function loadConfig() {
  const defaults = {
    apiBase: 'http://127.0.0.1:5001',
    enableGuestAnalyze: false,
    persistToken: true,
  };
  let fileConfig = {};
  try {
    const resp = await fetch('/CONFIG', { cache: 'no-store' });
    if (resp.ok) fileConfig = await resp.json();
  } catch (err) {
    fileConfig = {};
  }
  const windowConfig = window.AIREALCHECK_CONFIG || {};
  const apiBase = windowConfig.apiBase || windowConfig.api_base || fileConfig.api_base || defaults.apiBase;
  const enableGuestAnalyze = parseBoolean(
    windowConfig.enableGuestAnalyze ?? windowConfig.enable_guest_analyze ?? fileConfig.enable_guest_analyze,
    defaults.enableGuestAnalyze,
  );
  const persistToken = parseBoolean(
    windowConfig.persistToken ?? windowConfig.persist_token,
    defaults.persistToken,
  );

  const normalized = { apiBase, enableGuestAnalyze, persistToken };
  window.AIREALCHECK_CONFIG = Object.assign({}, fileConfig, windowConfig, normalized);
  return normalized;
}

document.addEventListener('DOMContentLoaded', async () => {
  const config = await loadConfig();
  const auth = createAuth(config.apiBase, config);
  const adminPanel = initAdminPanel(auth, config.apiBase);
  const router = initRouter(auth);

  auth.setNavigator(router.navigate);

  initUI(auth, { onOpenAdmin: adminPanel.openAdminPanel, navigate: router.navigate, router });
  initAuthPages(auth, router);

  initAnalyze(auth, {
    updateCreditsUI: () => updateCreditsUI(auth),
    updateAnalyzeButtons: (state, analyzing) => updateAnalyzeButtons(auth, analyzing),
    renderProfileView: () => updateProfileView(auth),
    apiBase: config.apiBase,
  });

  await auth.bootstrap();
  router.render();
});
