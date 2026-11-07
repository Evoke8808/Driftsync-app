// DriftSync warning popup: askUser({...}) shows a card with OK / Cancel and resolves true or false.
//   askUser({ title, points: ["...", "..."], ok: "Turn on", cancel: "Cancel", danger: false })
// Used by Setup and the timer page so every warning looks the same.
(function () {
    const css = `
    .ds-dialog-back { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
        background: rgba(0, 0, 0, .55); backdrop-filter: blur(4px); padding: 16px; }
    .ds-dialog { width: 100%; max-width: 440px; padding: 26px 26px 22px; border-radius: 24px;
        background: var(--surface, #181B1F); border: 1px solid var(--line-2, rgba(255,255,255,.12));
        box-shadow: 0 24px 80px rgba(0,0,0,.5); color: var(--text, #EDE8E0); }
    .ds-dialog h3 { margin: 0 0 12px; font-size: 19px; font-weight: 650; display: flex; gap: 10px; align-items: center; }
    .ds-dialog h3 .ds-icon { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
        background: rgba(232, 182, 92, .15); color: #E8B65C; font-size: 15px; }
    .ds-dialog.danger h3 .ds-icon { background: rgba(240, 135, 124, .15); color: var(--coral, #F0877C); }
    .ds-dialog ul { margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.55; color: var(--muted, #A9A49C); }
    .ds-dialog li + li { margin-top: 6px; }
    .ds-dialog .ds-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
    .ds-dialog button { font: inherit; font-size: 14px; font-weight: 600; padding: 9px 18px; border-radius: 999px; cursor: pointer;
        border: 1px solid var(--line-2, rgba(255,255,255,.14)); background: transparent; color: var(--text, #EDE8E0); }
    .ds-dialog button.ds-ok { background: var(--teal, #2DD4BF); border-color: transparent; color: #0B1414; }
    .ds-dialog.danger button.ds-ok { background: var(--coral, #F0877C); }`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const esc = t => String(t ?? '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    window.askUser = function ({ title, points = [], ok = "OK", cancel = "Cancel", danger = false }) {
        return new Promise(resolve => {
            const back = document.createElement('div');
            back.className = 'ds-dialog-back';
            back.innerHTML = `
                <div class="ds-dialog ${danger ? 'danger' : ''}" role="alertdialog" aria-modal="true">
                    <h3><span class="ds-icon">!</span>${esc(title)}</h3>
                    <ul>${points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
                    <div class="ds-actions">
                        ${cancel ? `<button type="button" class="ds-cancel">${esc(cancel)}</button>` : ''}
                        <button type="button" class="ds-ok">${esc(ok)}</button>
                    </div>
                </div>`;
            const done = answer => { back.remove(); document.removeEventListener('keydown', onKey, true); resolve(answer); };
            const onKey = e => {
                if (e.key === 'Escape') { e.preventDefault(); done(false); }
                if (e.key === 'Enter') { e.preventDefault(); done(true); }
            };
            back.querySelector('.ds-ok').onclick = () => done(true);
            const c = back.querySelector('.ds-cancel');
            if (c) c.onclick = () => done(false);
            document.addEventListener('keydown', onKey, true);
            document.body.appendChild(back);
            back.querySelector('.ds-ok').focus();
        });
    };
})();
