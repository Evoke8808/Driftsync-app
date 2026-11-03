/* SkillSetu sign-in state, shared by every look. Keeps the session in localStorage ('ss-auth') and adds the
   X-SkillSetu-Token header to every call to /api/, so the server knows who is asking. */
(function () {
  const KEY = 'ss-auth';
  window.ssAuth = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
    set(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
  const plainFetch = window.fetch.bind(window);
  window.fetch = (url, opts = {}) => {
    const a = window.ssAuth.get();
    const api = typeof url === 'string' && url.startsWith('/api/');
    if (api && a?.token) opts = { ...opts, headers: { ...(opts.headers || {}), 'X-SkillSetu-Token': a.token } };
    return plainFetch(url, opts).then((res) => {
      // An expired session: forget it so the app asks the person to sign in again.
      if (api && a?.token && res.status === 401) {
        window.ssAuth.clear();
        // Back to the right sign-in page, once.
        const to = a.role === 'counsellor' ? '#/counsellor-login' : '#/login';
        if (location.hash !== to) setTimeout(() => { location.hash = to; }, 0);
      }
      return res;
    });
  };
})();
