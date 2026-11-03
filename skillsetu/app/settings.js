/* SkillSetu settings: light or dark mode for the SAP Fiori (Horizon) look. */
(function () {
  const css = `
  .ss-set-back { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 999; display: none; }
  .ss-set-back.open { display: block; }
  .ss-set { position: fixed; top: 64px; right: 16px; width: min(380px, calc(100vw - 32px)); z-index: 1000; display: none; font: 14px/1.45 system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
    background: #fff; color: #1d2d3e; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,.25); padding: 16px; }
  html[data-theme="dark"] .ss-set { background: #1d232a; color: #eaecee; }
  .ss-set.open { display: block; }
  .ss-set h3 { margin: 0 0 2px; font-size: 17px; font-weight: 700; }
  .ss-set .ss-k { margin: 14px 0 8px; font-size: 12px; font-weight: 700; opacity: .7; text-transform: uppercase; letter-spacing: .04em; }
  .ss-modes { display: flex; gap: 8px; }
  .ss-mode { flex: 1; padding: 8px; border-radius: 8px; border: 1px solid rgba(128,128,128,.35); background: transparent; color: inherit; font: inherit; cursor: pointer; }
  .ss-mode.on { background: #0070f2; border-color: #0070f2; color: #fff; font-weight: 700; }
  .ss-close { float: right; background: none; border: 0; color: inherit; font-size: 22px; line-height: 1; cursor: pointer; opacity: .7; }`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const back = document.createElement('div'); back.className = 'ss-set-back';
  const panel = document.createElement('div'); panel.className = 'ss-set'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Settings');
  document.body.append(back, panel);
  const draw = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    panel.innerHTML = `<button class="ss-close" aria-label="Close">×</button><h3>Settings</h3>
      <div class="ss-k">Mode</div>
      <div class="ss-modes"><button class="ss-mode ${dark ? '' : 'on'}" data-mode="light">Light</button><button class="ss-mode ${dark ? 'on' : ''}" data-mode="dark">Dark</button></div>`;
  };
  const open = () => { draw(); back.classList.add('open'); panel.classList.add('open'); };
  const close = () => { back.classList.remove('open'); panel.classList.remove('open'); };
  back.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.ss-close')) return close();
    const md = e.target.closest('[data-mode]');
    if (md) {
      const wantDark = md.dataset.mode === 'dark', isDark = document.documentElement.dataset.theme === 'dark';
      if (wantDark !== isDark) document.getElementById('themeToggle')?.click();
      setTimeout(draw, 50);
    }
  });
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#settingsBtn')) open(); });
  window.ssOpenSettings = open;
})();
