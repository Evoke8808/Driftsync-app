/* SkillSetu settings: switch between the three looks (SAP Fiori, Passport, Original) and light or dark mode.
   Each look is a full copy of the front end: Fiori at /, Passport at /passport/, Original at /original/.
   The choice is remembered in localStorage ('ss-look'), and the chat and theme carry over. */
(function () {
  const LOOKS = [
    { id: 'fiori', name: 'SAP Fiori', desc: 'SAP UI5 Web Components, Horizon theme', path: '', sw: ['#f5f6f7', '#ffffff', '#0070f2', '#1d2d3e'] },
    { id: 'passport', name: 'Skills Passport', desc: 'Paper, stamps and a metro line', path: 'passport/', sw: ['#f3ead6', '#1f4e3d', '#d9381e', '#f2a516'] },
    { id: 'original', name: 'Original', desc: 'The first colourful look', path: 'original/', sw: ['#fffaf2', '#3b2fb0', '#ef6c1a', '#0e8a86'] }
  ];
  const current = location.pathname.includes('/passport/') ? 'passport' : location.pathname.includes('/original/') ? 'original' : 'fiori';
  const root = new URL(current === 'fiori' ? './' : '../', location.href);
  const css = `
  .ss-set-back { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 999; display: none; }
  .ss-set-back.open { display: block; }
  .ss-set { position: fixed; top: 64px; right: 16px; width: min(380px, calc(100vw - 32px)); z-index: 1000; display: none; font: 14px/1.45 system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
    background: #fff; color: #1d2d3e; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,.25); padding: 16px; }
  html[data-theme="dark"] .ss-set { background: #1d232a; color: #eaecee; }
  .ss-set.open { display: block; }
  .ss-set h3 { margin: 0 0 2px; font-size: 17px; font-weight: 700; }
  .ss-set .ss-k { margin: 14px 0 8px; font-size: 12px; font-weight: 700; opacity: .7; text-transform: uppercase; letter-spacing: .04em; }
  .ss-look { display: flex; gap: 12px; align-items: center; width: 100%; text-align: left; padding: 10px; margin-bottom: 8px; border-radius: 10px; cursor: pointer;
    background: transparent; color: inherit; border: 1px solid rgba(128,128,128,.35); font: inherit; }
  .ss-look:hover { border-color: #0070f2; }
  .ss-look.on { border: 2px solid #0070f2; padding: 9px; }
  .ss-look b { display: block; }
  .ss-look small { opacity: .7; }
  .ss-sw { display: grid; grid-template-columns: 1fr 1fr; width: 40px; height: 40px; border-radius: 8px; overflow: hidden; flex: none; border: 1px solid rgba(128,128,128,.3); }
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
      <div class="ss-k">Look</div>
      ${LOOKS.map((l) => `<button class="ss-look ${l.id === current ? 'on' : ''}" data-look="${l.id}"><span class="ss-sw">${l.sw.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
        <span><b>${l.name}${l.id === current ? ' · in use' : ''}</b><small>${l.desc}</small></span></button>`).join('')}
      <div class="ss-k">Mode</div>
      <div class="ss-modes"><button class="ss-mode ${dark ? '' : 'on'}" data-mode="light">Light</button><button class="ss-mode ${dark ? 'on' : ''}" data-mode="dark">Dark</button></div>`;
  };
  const open = () => { draw(); back.classList.add('open'); panel.classList.add('open'); };
  const close = () => { back.classList.remove('open'); panel.classList.remove('open'); };
  back.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.ss-close')) return close();
    const lk = e.target.closest('[data-look]');
    if (lk) {
      const l = LOOKS.find((x) => x.id === lk.dataset.look);
      try { localStorage.setItem('ss-look', l.id); } catch (err) {}
      if (l.id !== current) location.href = new URL(l.path, root).href + location.hash;
      return close();
    }
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
