import { createAuth } from './auth.js';
import { initUI, updateProfileView, updateCreditsUI, updateAnalyzeButtons } from './ui.js';
import { initAnalyze } from './analyze.js';
import { initAdminPanel } from './admin.js';

document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = 'http://127.0.0.1:5001';
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
