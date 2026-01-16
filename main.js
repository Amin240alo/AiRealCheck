import { createAuth } from './auth.js';
import { initUI, updateProfileView, updateCreditsUI, updateAnalyzeButtons } from './ui.js';
import { initAnalyze } from './analyze.js';
import { initAdminPanel } from './admin.js';

// ← NEUE ZEILE HIER:
if (window.ws) window.ws.close();

document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = 'https://airealcheck.onrender.com';
  const auth = createAuth(API_BASE);
  const adminPanel = initAdminPanel(auth, API_BASE);

  initUI(auth, { onOpenAdmin: adminPanel.openAdminPanel });

  initAnalyze(auth, {
    updateCreditsUI: () => updateCreditsUI(auth),
    updateAnalyzeButtons: (state, analyzing) => updateAnalyzeButtons(auth, analyzing),
    renderProfileView: () => updateProfileView(auth),
    apiBase: API_BASE,
  });

  await auth.bootstrap();
});
