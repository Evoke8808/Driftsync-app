const view = document.getElementById('view');

const PERSONAS = [
  { name: 'Priya', age: 34, city: 'Indore', color: '#f97316', tag: 'Returning after a career break',
    quote: 'Back after a 6-year childcare break; the gap gets me auto-rejected.',
    story: 'I am 34 and took a 6-year break to raise my 3 children. In that time I managed our household budget, coordinated school schedules, organized community events and negotiated with vendors for school functions.' },
  { name: 'Ravi', age: 38, city: 'Pune', color: '#0d9488', tag: 'Displaced by automation',
    quote: 'My BPO voice role was replaced by a chatbot. The job title no longer exists.',
    story: 'I worked as a BPO voice agent for 5 years, handled customer complaints, solved billing problems, led a team of 5 agents and trained new joiners. I communicate well in Hindi and English.' },
  { name: 'Arjun', age: 26, city: 'Lucknow', color: '#6366f1', tag: 'Wheelchair user, B.Com',
    quote: 'Employers aren’t accessibility-ready, so I never get to the interview.',
    story: 'I am a B.Com graduate and a wheelchair user. I am skilled in Excel spreadsheets and data entry, kept records for a local shop, organized college events and managed the student council budget.' }
];

const VIKRAM = 'I served 22 years in the Indian Army and retired as a Havildar in the Army Service Corps. I was a storekeeper: kept the stock register for rations and fuel, made the duty roster for my section of 10 jawans, and trained new recruits. I also helped run our unit canteen accounts.';
const VIKRAM_HINDI = 'मैं 18 साल फ़ौज में रहा और हवलदार बनकर रिटायर हुआ। मैं ड्राइवर था, काफ़िले की ड्यूटी रोस्टर बनाता था और नए जवानों को सिखाता था।';
const MEENA = 'I have worked at ServiceFirst in Hyderabad for 4 years as a customer service representative. I handle angry customers on calls, solve billing problems, and explain bills in Hindi and Telugu. Last year I started training new joiners and making the shift roster for our team of 8. Now the company is bringing in an AI chatbot and I am scared about my job.';
const PRIYA_HINGLISH = 'Maine bachon ke liye 6 saal ka break liya. Us dauraan ghar ka budget sambhala, 3 bachon ke school schedule manage kiye, society ke events organize kiye aur school functions ke liye vendors se bargaining ki.';

const AGENTS = [
  ['🔎', 'Skills Discovery', '“My experience doesn’t fit a job title.”', 'A chat in your own language turns life and work experience into skills.'],
  ['📈', 'Market Intelligence', '“Which jobs even exist now?”', 'Growing roles near your skills, with pay, demand and automation risk.'],
  ['🎓', 'Learning Pathway', '“I can’t afford a long course.”', 'The shortest gap-closing plan: bite-sized courses on a phone.'],
  ['🤝', 'Inclusive Matching', '“I need income while I learn.”', 'Skills-first, anonymised matches: part-time, remote, apprenticeships.'],
  ['🛡️', 'Bias Audit & Readiness', '“They reject me before they meet me.”', 'Flags gap, age, college and access barriers; coaches employers to hire on skills.'],
  ['🧑‍⚖️', 'Human-in-the-Loop', '“Who checks the AI?”', 'A counsellor approves plans, recruiters decide hires, users can dispute the AI.'],
  ['💡', 'Why-Not Explainer', '“Nobody tells me why I was rejected.”', 'Explains a “no”: the missing skill, an unfair filter or a job that doesn’t fit, and the smallest change that turns it into a “yes”.'],
  ['📡', 'Job Risk Radar', '“Will AI take my job?”', 'Spots jobs at risk of automation early and finds safer roles, first inside the same company.'],
  ['🌱', 'After-Hire Companion', '“What happens after I’m hired?”', 'Check-ins at day 7, 30 and 90, the next step up, and alerts when a better job matches.']
];

const PROVIDER_COLORS = { 'SAP Learning Hub': '#0a6ed1', 'SWAYAM': '#ea580c', 'NPTEL': '#16a34a' };


/* ---------- helpers ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = (name) => { const s = String(name || '').replace(/-/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };
const initials = (p) => p.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
const prettyModel = (m) => String(m || '').replace(/^anthropic--/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const hours = (d) => { const n = parseFloat(d); return /week/i.test(d) ? n * 5 : n || 0; };

async function get(path) {
  const res = await fetch('/api/' + path);
  if (!res.ok) throw new Error('GET ' + path + ' failed: ' + res.status);
  return (await res.json()).value;
}
async function act(name, body) {
  const res = await fetch('/api/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(name + ' failed: ' + res.status);
  return (await res.json()).value;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2800);
}

function ring(pct, size = 74) {
  const r = size / 2 - 6, c = 2 * Math.PI * r;
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}"><circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="7"/>
    <circle class="val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="7" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-target="${c * (1 - pct / 100)}"/></svg>
    <div class="pct" style="font-size:${size < 70 ? 14 : 17}px">${pct}%</div></div>`;
}
function animateRings() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('.ring .val').forEach((el) => { el.style.strokeDashoffset = el.dataset.target; });
  }));
}

/* ---------- pages ---------- */
// The hero picture: life experience on one bank, jobs on the other, skills walking across the setu (bridge).
function setuArt() {
  const x0 = 96, x1 = 424, deck = 196, top = 112;
  const archY = (x) => { const t = (x - x0) / (x1 - x0); return (1 - t) * (1 - t) * 262 + 2 * (1 - t) * t * top + t * t * 262; };
  const hangers = [140, 180, 220, 260, 300, 340, 380].map((x, i) => {
    const y = archY(x); return y < deck ? '' : `<line class="hanger" x1="${x}" y1="${deck}" x2="${x}" y2="${y}" style="animation-delay:${1.2 + i * .08}s"/>`;
  }).join('');
  const hang2 = [140, 180, 220, 260, 300, 340, 380].map((x, i) => {
    const y = archY(x); return y >= deck ? '' : `<line class="hanger" x1="${x}" y1="${y}" x2="${x}" y2="${deck}" style="animation-delay:${1.2 + i * .08}s"/>`;
  }).join('');
  const skills = ['Budget management', 'Negotiation', 'Team leadership', 'Event planning', 'हिसाब · Accounts'];
  const chips = skills.map((s, i) => { const w = s.length * 7.4 + 22; return `<g opacity="0">
      <rect class="chip-r" x="${-w / 2}" y="-30" width="${w}" height="26" rx="13"/><text class="chip-t" x="0" y="-12.5" text-anchor="middle">${s}</text>
      <animateMotion dur="20s" begin="${1.6 + i * 4}s" repeatCount="indefinite" path="M40 ${deck} L480 ${deck}" keyPoints="0;1;1" keyTimes="0;.42;1" calcMode="linear"/>
      <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.05;.36;.42;1" dur="20s" begin="${1.6 + i * 4}s" repeatCount="indefinite"/></g>`; }).join('');
  return `<div class="setu"><svg viewBox="0 0 520 340" role="img" aria-label="Skills from everyday life crossing a bridge to jobs">
    <defs><radialGradient id="sunGrad"><stop offset="0" stop-color="#ffd27a"/><stop offset=".6" stop-color="#f5a524" stop-opacity=".55"/><stop offset="1" stop-color="#f5a524" stop-opacity="0"/></radialGradient></defs>
    <circle class="sun" cx="260" cy="110" r="70"/>
    <path class="bank" d="M-10 340 L-10 200 Q46 176 112 198 Q132 262 116 340 Z"/>
    <path class="bank r" d="M530 340 L530 200 Q474 176 408 198 Q388 262 404 340 Z"/>
    <path class="wave" d="M120 290 q20 -10 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>
    <path class="wave" d="M140 314 q20 -10 40 0 t40 0 t40 0 t40 0 t40 0 t40 0" style="animation-duration:8s"/>
    <path class="arch" d="M${x0} 262 Q260 ${top} ${x1} 262"/>
    ${hangers}${hang2}
    <line class="deck" x1="70" y1="${deck}" x2="450" y2="${deck}"/>
    <text class="emoji" x="14" y="168">🍲</text><text class="emoji" x="50" y="150">🧵</text><text class="emoji" x="86" y="170">🪔</text>
    <text class="emoji" x="414" y="170">🏢</text><text class="emoji" x="450" y="150">🏦</text><text class="emoji" x="486" y="168">🎪</text>
    <text class="bank-label" x="56" y="236" text-anchor="middle">Life</text><text class="bank-label" x="56" y="256" text-anchor="middle">experience</text>
    <text class="bank-label" x="466" y="246" text-anchor="middle">Jobs</text>
    ${chips}
  </svg><div class="cap">Setu means bridge. Every skill crosses on evidence, never on a name, age or college.</div></div>`;
}

// Home page "other services": each card opens a live demo of that agent.
// demo = start a fresh chat with this story, then press this button for the person.
const SERVICES = [
  { agent: 6, who: 'For job seekers', cta: 'See why Priya got a no',
    demo: { name: 'Priya', message: PERSONAS[0].story, then: { intent: 'explain', roleID: '2a2b3c4d-0001-0001-0001-000000000001', labelText: 'Why didn’t I get the Operations Coordinator job?' } } },
  { agent: 7, who: 'For workers today', cta: 'Check Meena’s job',
    demo: { name: 'Meena', message: MEENA, then: { intent: 'shield', labelText: 'Is my job safe from AI?' } } },
  { agent: 8, who: 'After the hire', cta: 'Vikram’s first 90 days',
    demo: { name: 'Vikram', message: VIKRAM, then: { intent: 'growth', roleID: '2a2b3c4d-0001-0001-0001-000000000021', labelText: 'I got the Warehouse and Stores Supervisor job!' } } }
];

function home() {
  return `<div class="page">
  <section class="hero"><div class="jaali"></div><div class="container hero-grid">
    <div>
      <span class="eyebrow"><span class="dot"></span>SAP Hackfest 2026 · Inclusive Workforce</span>
      <h1>Find the skills you already have, and <span class="grad">a job that fits them.</span></h1>
      <p class="hero-hindi">हुनर से रोज़गार तक, आपका सेतु।</p>
      <p class="lead">Tell SkillSetu about your life and work in any language. It finds your skills, shows jobs you can get on skills alone, and the shortest free courses to fill any gap.</p>
      <div class="hero-cta">
        <a href="#/journey" class="btn btn-primary">Start your journey →</a>
        <a href="#/about" class="btn btn-ghost">How it works</a>
      </div>
    </div>
    ${setuArt()}
  </div></section>

  <section class="block alt"><div class="container">
    <div class="section-head"><h2>Why we built this</h2></div>
    <div class="grid grid-3">
      ${[['88%', 'of employers say filters reject qualified talent'], ['92M', 'jobs displaced worldwide by 2030'], ['41.7%', 'of Indian women are in the labour force']]
        .map(([n, l], i) => `<div class="stat reveal" style="--i:${i}"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('')}
    </div>
  </div></section>

  <section class="block"><div class="container">
    <div class="section-head"><h2>How it works</h2>
      <p>It’s one chat. Behind it, SkillSetu brings in the right helper at each step, and a real counsellor checks your plan.</p></div>
    <div class="grid grid-4">
      ${[['💬', 'Tell your story', 'Describe your life and work in plain words.'], ['🧩', 'Discover skills', 'We turn your story into skills employers recognise.'], ['🎯', 'Match fairly', 'Roles ranked on skills only, profile anonymised.'], ['📚', 'Close the gap', 'Short courses from SAP Learning Hub, SWAYAM and NPTEL.']]
        .map(([ic, t, d], i) => `<div class="card hover reveal" style="--i:${i}"><div class="icon-tile">${ic}</div><div class="step-num" style="margin-top:14px">STEP ${i + 1}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div>
  </div></section>

  <section class="block alt"><div class="container">
    <div class="section-head"><h2>Try a demo story</h2><p>Pick a person and watch their whole journey in the chat.</p></div>
    <div class="grid grid-3">
      ${PERSONAS.map((p, i) => `<div class="card hover persona reveal" style="--i:${i}" data-persona="${i}">
        <div class="head"><div class="avatar" style="background:${p.color}">${p.name[0]}</div>
          <div><b>${p.name}, ${p.age}</b> · ${p.city}<div class="muted" style="font-size:14px">${p.tag}</div></div></div>
        <div class="quote">${p.quote}</div><div class="go">Walk ${p.name}’s journey</div></div>`).join('')}
    </div>
  </div></section>

  <section class="block"><div class="container">
    <div class="section-head"><h2>Check out our other services</h2>
      <p>Help before a job, while you work, and after you’re hired. Click a card to see it work.</p></div>
    <div class="grid grid-3">
      ${SERVICES.map((sv, i) => { const [ic, t, q, d] = AGENTS[sv.agent]; return `<div class="card hover service reveal" style="--i:${i}" data-service="${i}" role="button" tabindex="0">
        <div class="row between"><div class="icon-tile">${ic}</div><span class="badge">${sv.who}</span></div>
        <h3>${esc(t)}</h3><p class="q">${q}</p><p>${d}</p><div class="go">${sv.cta}</div></div>`; }).join('')}
    </div>
  </div></section>
  </div>`;
}

/* ---------- My Journey: one chat, nine agents ---------- */
const AGENT_META = {
  orchestrator: { name: 'Setu', icon: '🌉', color: '#7c3aed' },
  skills: { name: 'Skills Discovery', icon: '🔎', color: '#4f46e5' },
  market: { name: 'Market Intelligence', icon: '📈', color: '#0891b2' },
  pathway: { name: 'Learning Pathway', icon: '🎓', color: '#16a34a' },
  matching: { name: 'Inclusive Matching', icon: '🤝', color: '#db2777' },
  readiness: { name: 'Bias Audit & Readiness', icon: '🛡️', color: '#d97706' },
  human: { name: 'Human-in-the-Loop', icon: '🧑‍⚖️', color: '#64748b' },
  explain: { name: 'Why-Not Explainer', icon: '💡', color: '#ca8a04' },
  shield: { name: 'Job Risk Radar', icon: '📡', color: '#dc2626' },
  growth: { name: 'After-Hire Companion', icon: '🌱', color: '#059669' }
};
const SKILL_ICON = { financial: '💰', organizational: '🗓️', interpersonal: '🤝', technical: '💻', analytical: '🧠' };
const STATUS_TEXT = { active: 'In progress', sent: 'With counsellor', approved: 'Approved', changes: 'Changes requested' };
const ROUTE_TEXT = { button: 'Button', rules: 'Rules', ai: 'AI router', api: 'Integration API' };

const chat = { caseID: null, messages: [], trace: [], suggestions: [], caseFile: null, busy: false, active: [], pending: null };
try { chat.caseID = localStorage.getItem('ss-case'); } catch (e) {}
chat.name = '';
// Chat history on this device: case IDs, newest first. The server holds the chats themselves.
const chatHistory = {
  ids() { try { return JSON.parse(localStorage.getItem('ss-history') || '[]'); } catch (e) { return []; } },
  add(id) { const l = [id, ...chatHistory.ids().filter((x) => x !== id)].slice(0, 30); try { localStorage.setItem('ss-history', JSON.stringify(l)); } catch (e) {} },
  list: []
};

const agentColor = (id) => (AGENT_META[id] || AGENT_META.orchestrator).color;
const risk = (r) => `<span class="pill ${r === 'Low' ? 'good' : r === 'High' ? 'bad' : 'warn'}">Automation risk: ${esc(r || 'n/a')}</span>`;
const demand = (d) => `<span class="pill ${d === 'High' ? 'good' : d === 'Low' ? 'bad' : 'warn'}">Demand: ${esc(d || 'n/a')}</span>`;
const aiTag = (provider, model) => provider ? `<span class="ai-badge">✨ ${esc(provider)}${model ? ' · ' + esc(prettyModel(model)) : ''}</span>` : '<span class="badge">Rules (AI offline)</span>';

function journey() {
  view.innerHTML = `<div class="page journey-page"><div class="container">
    <div class="page-head"><div class="row between"><h1>Talk to SkillSetu</h1><div class="row"><button class="btn btn-ghost btn-sm" id="wideChat" title="Hide the side panels and give the chat the whole screen">⤢ Focus chat</button><button class="btn btn-ghost btn-sm" id="newChat" title="Clear this chat and start a new person">↺ New chat</button></div></div>
      <p>One conversation, nine specialist agents. Setu, the orchestrator, picks who helps you next, every step is logged, and a person signs off.</p></div>
    <div class="agent-strip" id="agentStrip">${Object.entries(AGENT_META).map(([id, a]) =>
      `<span class="agent-pill" data-agent="${id}" style="--ag:${a.color}">${a.icon} ${esc(a.name)}</span>`).join('')}</div>
    <div class="chat-layout">
      <section class="chat-box">
        <div class="chat-head" id="chatHead"></div>
        <div class="chat-log" id="chatLog"></div>
        <div class="suggest" id="suggest"></div>
        <form class="composer" id="composer">
          <textarea id="msg" rows="1" placeholder="Type in any language: English, हिंदी, Hinglish…"></textarea>
          <button class="btn btn-primary" id="sendBtn" type="submit" aria-label="Send">Send</button>
        </form>
      </section>
      <aside class="side">
        <div class="side-card" id="caseCard"></div>
        <div class="side-card" id="histCard"></div>
        <div class="side-card" id="traceCard"></div>
      </aside>
    </div>
  </div></div>`;
  const ta = document.getElementById('msg');
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat({ message: ta.value }); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; });
  document.getElementById('composer').addEventListener('submit', (e) => { e.preventDefault(); sendChat({ message: ta.value }); });

  if (chat.pending) {
    const p = chat.pending; chat.pending = null; resetChat(); chat.name = p.name || ''; drawChat();
    return sendChat({ message: p.message }).then(() => p.then && sendChat(p.then));
  }
  loadHistory();
  if (chat.caseID && !chat.messages.length) return loadCase();
  drawChat();
}

async function loadHistory() {
  const ids = chatHistory.ids();
  if (chat.caseID && !ids.includes(chat.caseID)) { chatHistory.add(chat.caseID); ids.unshift(chat.caseID); }
  try { chatHistory.list = ids.length ? JSON.parse((await (await fetch(`/api/myCases(ids='${encodeURIComponent(ids.join(','))}')`)).json()).value) : []; }
  catch (e) { chatHistory.list = []; }
  drawHistory();
}

function drawHistory() {
  const el = document.getElementById('histCard');
  if (!el) return;
  el.innerHTML = `<div class="row between"><h4 style="margin:0">Your chats</h4><button class="link-btn" id="newChat3">+ New</button></div>
    <div class="history" style="margin-top:8px">${chatHistory.list.length ? chatHistory.list.map((c) => `<button class="hist ${c.ID === chat.caseID ? 'on' : ''}" data-hist="${esc(c.ID)}">
      <span class="av">${esc((c.name || 'G')[0].toUpperCase())}</span>
      <span><b>${esc(c.name || 'Guest')}</b><span class="meta">${esc(STATUS_TEXT[c.status] || c.status)} · ${plural(c.skills, 'skill')}${c.role ? ' · ' + esc(c.role) : ''}</span></span>
      <span class="case-id">${esc(c.code)}</span></button>`).join('') : '<p class="muted" style="font-size:14px;margin:0">Your past chats on this device show up here.</p>'}</div>`;
}

function drawHead() {
  const el = document.getElementById('chatHead');
  if (!el) return;
  const c = chat.caseFile;
  el.innerHTML = c
    ? `<span class="me">${esc((c.name || 'G')[0].toUpperCase())}</span><span class="who-am"><b>${esc(c.name || 'Guest')}</b>
        <span class="muted" style="font-size:12px">${esc(STATUS_TEXT[c.status] || c.status)} · employers only see your ID</span></span>
        <span class="case-id" id="copyId" title="Your unique case ID. Click to copy.">🆔 ${esc(c.code)}</span>`
    : `<span class="me">+</span><span class="who-am"><b>New chat</b><span class="muted" style="font-size:12px">Your unique case ID appears after your first message</span></span>`;
}

async function loadCase() {
  try {
    const res = await fetch(`/api/caseView(caseID='${encodeURIComponent(chat.caseID)}')`);
    if (!res.ok) throw new Error('not found');
    const v = JSON.parse((await res.json()).value);
    chat.messages = v.messages;
    chat.caseFile = v.caseFile;
    chat.trace = v.log.slice().reverse().map((l) => ({ ...l, to: null }));
    chat.suggestions = [];
  } catch (e) { resetChat(); }
  drawChat();
}

function resetChat() {
  chat.caseID = null; chat.messages = []; chat.trace = []; chat.suggestions = []; chat.caseFile = null; chat.active = []; chat.name = '';
  try { localStorage.removeItem('ss-case'); } catch (e) {}
}

async function sendChat({ message = '', intent = null, roleID = null, labelText = null }) {
  const text = String(message || '').trim();
  if (chat.busy || (!text && !intent)) return;
  chat.busy = true;
  const nameIn = document.getElementById('nameIn');
  if (nameIn) chat.name = nameIn.value.trim().slice(0, 60);
  chat.messages.push({ role: 'user', text: labelText || text });
  chat.suggestions = [];
  const ta = document.getElementById('msg');
  if (ta) { ta.value = ''; ta.style.height = 'auto'; }
  drawChat(true);
  try {
    const out = JSON.parse(await act('chat', { caseID: chat.caseID, message: labelText || text, intent, roleID, name: chat.caseID ? null : chat.name || null }));
    chat.caseID = out.caseID;
    try { localStorage.setItem('ss-case', out.caseID); } catch (e) {}
    chatHistory.add(out.caseID);
    chat.active = out.trace.map((t) => t.agent);
    chat.trace = [{ turn: labelText || text }, ...out.trace, ...chat.trace].slice(0, 60);
    chat.messages.push(...out.replies.map((r) => ({ role: 'agent', ...r })));
    chat.suggestions = out.suggestions;
    chat.caseFile = out.caseFile;
  } catch (e) {
    chat.messages.push({ role: 'agent', agent: 'orchestrator', name: 'Setu', icon: '🌉', text: 'I couldn’t reach the server. Is cds watch running? If you just updated, run cds deploy first.' });
  }
  chat.busy = false;
  drawChat();
  loadHistory();
}

function drawChat(thinking = false) {
  const log = document.getElementById('chatLog');
  if (!log) return;
  const welcome = `<div class="msg agent" style="--ag:${agentColor('orchestrator')}">
      <div class="who"><span class="av">🌉</span>Setu · orchestrator</div>
      <div class="bubble"><p>Namaste! Tell me about your life and work so far, paid or unpaid. Home, family and community work all count. Write in any language.</p>
        ${chat.caseID ? '' : `<div class="name-ask"><input id="nameIn" maxlength="60" placeholder="Your first name (optional)" value="${esc(chat.name)}">
          <span class="fine">Only your counsellor sees your name. Employers see your case ID and skills, nothing else.</span></div>`}
        <p class="muted" style="margin-top:8px;font-size:14px">Or try a real story:</p>
        <div class="row">${PERSONAS.map((p, i) => `<button class="chip" data-say="${i}">${p.name}’s story</button>`).join('')}
          <button class="chip" data-say="hi">Priya in Hinglish</button><button class="chip" data-say="army">🎖️ Vikram, ex-Army</button><button class="chip" data-say="army-hi">🎖️ Vikram in Hindi</button><button class="chip" data-say="meena">💼 Meena, job at risk</button></div></div></div>`;
  log.innerHTML = welcome + chat.messages.map(drawMsg).join('') + (thinking ? `<div class="msg agent thinking" style="--ag:${agentColor('orchestrator')}">
      <div class="who"><span class="av">🌉</span>Setu · orchestrator</div><div class="bubble"><span class="dots"><i></i><i></i><i></i></span> choosing the right agent…</div></div>` : '');
  log.scrollTop = log.scrollHeight;
  document.getElementById('suggest').innerHTML = chat.suggestions.map((s, i) =>
    `<button class="chip sugg" data-sugg="${i}">${esc(s.label)} →</button>`).join('');
  document.getElementById('sendBtn').disabled = chat.busy;
  document.querySelectorAll('.agent-pill').forEach((el) => el.classList.toggle('on', chat.active.includes(el.dataset.agent)));
  drawHead();
  drawCase();
  drawTrace();
  drawHistory();
  animateRings();
}

function drawMsg(m) {
  if (m.role === 'user') return `<div class="msg user"><div class="bubble">${esc(m.text)}</div></div>`;
  const id = m.agent || 'orchestrator', a = AGENT_META[id] || AGENT_META.orchestrator;
  const who = m.role === 'counsellor' ? 'Counsellor (a person)' : a.name;
  return `<div class="msg agent" style="--ag:${a.color}"><div class="who"><span class="av">${m.role === 'counsellor' ? '🧑‍💼' : a.icon}</span>${esc(who)}</div>
    <div class="bubble"><p>${esc(m.text)}</p>${m.card ? drawCard(m.card) : ''}</div></div>`;
}

function drawCard(c) {
  if (c.type === 'skills') return `<div class="card-in skills-card">
      <div class="row between"><b class="sc-title">Your skills (${c.skills.length})</b>${c.source === 'file' ? '' : c.source === 'ai' ? aiTag(c.provider, c.model) : aiTag()}</div>
      <p class="sc-intro">I turned your story into skills employers look for. Each one shows <b>what it means</b>, <b>the words from your story that prove it</b>, and <b>which jobs ask for it</b>, so a counsellor or employer can check it.</p>
      ${c.jobsOpened ? `<div class="sc-sum"><span class="n">${c.jobsOpened}</span> of ${c.totalJobs} jobs on SkillSetu ask for at least one of these skills.</div>` : ''}
      <div class="skill-grid">${c.skills.map((s, i) => `<div class="skill-tile pop" style="--i:${i}">
        <div class="st-head"><span class="st-ic">${SKILL_ICON[s.category] || '⭐'}</span><span class="st-name">${esc(label(s.skill))}</span>${s.isNew ? '<b class="new">new</b>' : ''}</div>
        ${s.desc ? `<div class="st-row"><span class="st-k">What it means</span><span>${esc(s.desc)}</span></div>` : ''}
        <div class="st-row"><span class="st-k">Your proof</span><span class="st-q">${s.reason ? `“${esc(s.reason)}”` : 'Added by you'}</span></div>
        ${s.jobs ? `<div class="st-row"><span class="st-k">Opens doors to</span><span>${plural(s.jobs, 'job')}, like ${esc(s.jobTitles.join(', '))}</span></div>` : ''}
        <div class="st-by">${s.by === 'ai' ? '✨ Found by the AI' : s.by === 'keywords' ? '🔤 Found by keyword check' : s.by === 'service' ? '🎖️ From your service record' : '✍️ From your profile'}</div></div>`).join('')}</div></div>`;

  if (c.type === 'military') return `<div class="card-in mil-card">
      <div class="row between"><b class="sc-title">🎖️ Service translator</b><span class="badge">${esc(c.service || 'Armed forces')}${c.years ? ` · ${c.years} years` : ''}</span></div>
      <p class="sc-intro">Keyword filters don’t understand ranks and trades, so I rewrote your service in civilian job language. Employers see the right-hand side.</p>
      <div class="mil-rows">${c.rows.map((r, i) => `<div class="mil-row pop" style="--i:${i}">
        <div class="mil-from"><span class="st-k">${r.kind === 'rank' ? 'Rank' : r.kind === 'trade' ? 'Trade / duty' : 'Service'}</span><b>${esc(r.term)}</b>${r.quote ? `<span class="st-q">“${esc(r.quote)}”</span>` : ''}</div>
        <div class="mil-arrow" aria-hidden="true">➜</div>
        <div class="mil-to"><span class="st-k">Civilian</span><b>${esc(r.civilian)}</b><span class="mil-detail">${esc(r.detail)}</span>
          <div class="row">${r.skills.map((s) => `<span class="chip on sm">${esc(s)}</span>`).join('')}</div></div></div>`).join('')}</div>
      ${c.jobs?.length ? `<div class="mil-jobs"><span class="st-k">Job titles to search for</span><div class="row">${c.jobs.map((j) => `<span class="chip">${esc(j)}</span>`).join('')}</div></div>` : ''}</div>`;

  if (c.type === 'roles') return `<div class="card-in">${c.roles.map((r, i) => `
      <div class="mrole reveal" style="--i:${i}">${ring(r.matchPercent, 58)}
        <div class="mr-body"><b>${esc(r.title)}</b><div class="meta">${esc(r.company)} · ${esc(r.location)} · ${esc(r.salary)} · ${esc(r.type)}</div>
          <div class="row">${demand(r.demand)}${risk(r.automationRisk)}</div>
          <div class="row" style="margin-top:6px">${r.matchedSkills.map((s) => `<span class="chip good">✓ ${esc(label(s))}</span>`).join('')}${r.missingSkills.map((s) => `<span class="chip warn">+ ${esc(label(s))}</span>`).join('')}</div></div>
        <div class="mr-acts"><button class="btn btn-ghost btn-sm" data-intent="pathway" data-role-id="${esc(r.ID)}" data-label="Plan for ${esc(r.title)}">Plan →</button>
          ${r.matchPercent < 100 ? `<button class="link-btn" data-intent="explain" data-role-id="${esc(r.ID)}" data-label="Why wouldn’t I get ${esc(r.title)}?">Why not?</button>` : ''}</div></div>`).join('')}
      <p class="fine">Demand and automation risk are illustrative demo values.</p></div>`;

  if (c.type === 'path') return `<div class="card-in">
      ${c.readyFor ? `<div class="barrier"><span class="st ok">✓ Ready now</span> ${esc(c.readyFor)}: you can apply today</div><p class="fine" style="margin:0 0 8px">Next step up:</p>` : ''}
      <div class="row between"><b>${esc(c.role.title)} · ${esc(c.role.company)}</b><span class="badge type">${c.matchPercent}% today</span></div>
      <div class="mini-stats"><div><b>${c.steps.length}</b><span>${c.steps.length === 1 ? 'course' : 'courses'}</span></div><div><b>${c.totalHours}h</b><span>learning</span></div><div><b>${c.weeks} wk</b><span>at 5h/week</span></div></div>
      ${c.steps.length ? `<div class="timeline compact">${c.steps.map((s, i) => `<div class="t-item reveal" style="--i:${i}"><div class="course">
        <div class="thumb" style="background:${PROVIDER_COLORS[s.course.provider] || '#6366f1'}">${initials(s.course.provider)}</div>
        <div style="flex:1"><h4>${esc(s.course.title)}</h4><div class="meta"><span>${esc(s.course.provider)}</span><span>⏱ ${esc(s.course.duration)}</span><span>Closes: ${esc(label(s.skill))} (${esc(s.importance === 'requested' ? 'you asked' : s.importance)})</span></div></div>
        <a class="btn btn-ghost btn-sm" href="${esc(s.course.url)}" target="_blank" rel="noopener">Open</a></div></div>`).join('')}</div>` : '<div class="empty" style="padding:16px">🎉 No gaps. You can apply today.</div>'}</div>`;

  if (c.type === 'matches') return `<div class="card-in">
      <div class="anon-card"><div class="row between"><b>What employers see</b><span class="badge type">${esc(c.alias)}</span></div>
        <div class="row" style="margin-top:8px">${c.skills.map((s) => `<span class="chip on">${esc(label(s))}</span>`).join('')}</div>
        <div class="row" style="margin-top:8px"><span class="muted" style="font-size:13px">Hidden:</span>${c.hidden.map((h) => `<span class="chip struck">${esc(h)}</span>`).join('')}</div></div>
      ${c.filters.length ? `<div class="row" style="margin:10px 0 4px"><span class="muted" style="font-size:13px">Filters:</span>${c.filters.map((f) => `<span class="chip ${c.relaxed ? 'warn' : 'good'}">${esc(f)}${c.relaxed ? ' (relaxed)' : ''}</span>`).join('')}</div>` : ''}
      ${c.roles.map((r, i) => `<div class="mrole reveal" style="--i:${i}">${ring(r.matchPercent, 58)}
        <div class="mr-body"><b>${esc(r.title)}</b><div class="meta">${esc(r.company)} · ${esc(r.location)} · ${esc(r.salary)} · ${esc(r.type)}</div></div>
        <button class="btn btn-ghost btn-sm" data-intent="human" data-label="Ask a counsellor to introduce me for ${esc(r.title)}">Request intro</button></div>`).join('')}</div>`;

  if (c.type === 'readiness') return `<div class="card-in">
      ${c.barriers.length ? c.barriers.map((b) => `<div class="barrier"><span class="st no">⚠ Résumé filter</span> rejects for <b>${esc(b)}</b><span class="st ok">SkillSetu ignores it</span></div>`).join('')
        : '<div class="barrier"><span class="st ok">✓</span> No common filter barriers found.</div>'}
      <div class="mini-stats"><div><b class="bad">${c.audit.resumeFilterFailingGroups}/${c.audit.groups}</b><span>groups fail with a résumé filter</span></div>
        <div><b class="good">${c.audit.skillsFirstFailingGroups}/${c.audit.groups}</b><span>fail with SkillSetu</span></div>
        <div><b>${c.audit.rejected}/${c.audit.qualified}</b><span>qualified people dropped by filters</span></div></div>
      <div class="row between" style="margin-top:6px"><b>Readiness tips</b>${c.tipsBy === 'ai' ? aiTag(c.provider, c.model) : aiTag()}</div>
      <ol class="tips">${c.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      <p class="fine">Four-fifths rule audit for ${esc(c.role)} on the synthetic pool of 140 applicants.</p></div>`;

  if (c.type === 'whynot') {
    const pass = c.matchPercent >= c.passMark;
    return `<div class="card-in why-card">
      <div class="row between"><b class="sc-title">💡 Why not: ${esc(c.role.title)}</b><span class="badge">${esc(c.role.company)}</span></div>
      <div class="why-meter"><div class="wm-track">${c.fix ? `<i class="ghost" style="width:${c.fix.newPercent}%"></i>` : ''}<i class="${pass ? 'ok' : 'no'}" style="width:${c.matchPercent}%"></i><em style="left:${c.passMark}%"></em></div>
        <div class="wm-lab"><span><b>You: ${c.matchPercent}%</b></span><span>Bar: ${c.passMark}%</span>${c.fix ? `<span class="good-t">After ${c.fix.hours}h of learning: ${c.fix.newPercent}%</span>` : ''}</div></div>
      ${c.worked.length ? `<div class="why-sec"><span class="st-k">What counted for you</span><div class="row">${c.worked.map((s) => `<span class="chip good">✓ ${esc(label(s))}</span>`).join('')}</div></div>` : ''}
      ${c.missing.length ? `<div class="why-sec"><span class="st-k">${c.skillsPass ? 'Nice to have' : 'What held you back'}</span><div class="row">${c.missing.map((s) => `<span class="chip ${s.importance === 'required' ? 'bad' : 'warn'}">✗ ${esc(label(s.skill))} · ${esc(s.importance)}</span>`).join('')}</div></div>` : ''}
      ${c.fit.map((f) => `<div class="barrier"><span class="st warn">Job fit</span> ${esc(f)}</div>`).join('')}
      ${c.barriers.map((b) => `<div class="barrier"><span class="st no">Unfair filter</span> ${esc(b)} <span class="st ok">not about your ability</span></div>`).join('')}
      ${c.audit ? `<p class="fine" style="margin:4px 0 0">On this job, a résumé filter drops <b>${c.audit.rejected} of ${c.audit.qualified}</b> qualified applicants and fails the four-fifths rule for ${c.audit.failing} of ${c.audit.groups} groups.</p>` : ''}
      ${c.flagged ? `<div class="barrier"><span class="st ok">🚩 Flagged</span> Sent to your counsellor to ask ${esc(c.role.company)} for a skills-based review.</div>` : ''}
      ${c.fix ? `<div class="why-sec"><span class="st-k">What would change the answer</span>${c.fix.skills.map((s) => `<div class="why-fix"><span class="chip on sm">+ ${esc(label(s.skill))}</span>${s.course ? `<span>${esc(s.course.title)} <span class="muted">· ${esc(s.course.provider)} · ${esc(s.course.duration)}</span></span>` : '<span class="muted">no course yet</span>'}</div>`).join('')}</div>` : ''}
      <p class="fine">Every reason above is computed from your skills and the job’s requirements, not guessed by AI. The bar is the ${c.passMark}% skills match SkillSetu uses to shortlist.</p></div>`;
  }

  if (c.type === 'shield') {
    const moves = (list, title, inside) => list.length ? `<div class="why-sec"><span class="st-k">${title}</span>${list.map((r, i) => `<div class="mrole reveal" style="--i:${i}">${ring(r.matchPercent, 52)}
        <div class="mr-body"><b>${esc(r.title)}</b><div class="meta">${esc(r.company)} · ${esc(r.salary)}</div>
          <div class="row">${risk(r.risk)}${r.missing.length ? r.missing.map((m) => `<span class="chip warn">+ ${esc(label(m))}</span>`).join('') + `<span class="pill">~${r.hours}h to learn</span>` : '<span class="pill good">Ready now</span>'}</div></div>
        <div class="mr-acts">${r.missing.length ? `<button class="btn btn-ghost btn-sm" data-intent="pathway" data-role-id="${esc(r.ID)}" data-label="Plan for ${esc(r.title)}">Plan →</button>` : `<button class="btn btn-ghost btn-sm" data-intent="human" data-label="Ask a counsellor ${inside ? 'about moving' : 'for an intro'} to ${esc(r.title)}">${inside ? 'Move →' : 'Intro →'}</button>`}</div></div>`).join('')}</div>` : '';
    return `<div class="card-in shield-card">
      <div class="row between"><b class="sc-title">📡 Job risk radar</b>${risk(c.job.risk)}</div>
      <div class="sh-job"><span class="st-k">Your job now</span><b>${esc(c.job.title)}</b><span class="meta">${esc(c.job.company || 'Employer not given')} · ${esc(c.job.salary)}</span></div>
      <div class="sh-split"><div><span class="st-k">Tasks AI already does well</span><div class="row">${c.exposed.map((s) => `<span class="chip bad">${esc(label(s))}</span>`).join('') || '<span class="muted">none</span>'}</div></div>
        <div><span class="st-k">Tasks that need a person</span><div class="row">${c.human.map((s) => `<span class="chip good">${esc(label(s))}</span>`).join('') || '<span class="muted">none</span>'}</div></div></div>
      ${c.carry.length ? `<div class="why-sec"><span class="st-k">Your skills AI can’t easily replace</span><div class="row">${c.carry.map((s) => `<span class="chip on sm">${esc(label(s))}</span>`).join('')}</div></div>` : ''}
      ${moves(c.internal, `Safer roles inside ${esc(c.job.company || 'your company')}`, true)}${moves(c.external, c.internal.length ? 'Safer roles elsewhere' : 'Safer roles', false)}
      ${!c.internal.length && !c.external.length ? '<div class="barrier"><span class="st ok">✓</span> No safer role beats your current one right now.</div>' : ''}
      <div class="watch-note">👀 <span><b>Watching your job.</b> If its risk rises or a better role opens, you’ll hear from me. Your employer never sees that you asked.</span></div>
      <p class="fine">Automation risk and task exposure are illustrative demo values.</p></div>`;
  }

  if (c.type === 'growth') return `<div class="card-in growth-card">
      <div class="row between"><b class="sc-title">🌱 After-hire companion</b><span class="badge">Hired ${esc(c.hiredAt)}</span></div>
      <div class="sh-job"><span class="st-k">Your job</span><b>${esc(c.job.title)}</b><span class="meta">${esc(c.job.company)} · ${esc(c.job.salary)}</span></div>
      <div class="why-sec"><span class="st-k">Check-ins</span><div class="checkins">${c.checkins.map((k) => `<div class="ci ${k.done ? 'done' : ''}"><b>Day ${k.day}</b><span>${esc(k.text)}</span><span class="meta">${k.done ? '✓ done' : esc(k.due)}</span></div>`).join('')}</div></div>
      ${c.next.length ? `<div class="why-sec"><span class="st-k">Your next step up</span>${c.next.map((r, i) => `<div class="mrole reveal" style="--i:${i}">${ring(r.matchPercent, 52)}
        <div class="mr-body"><b>${esc(r.title)}</b><div class="meta">${esc(r.company)}${r.sameCompany ? ' (same company)' : ''} · ${esc(r.salary)}</div>
          <div class="row">${risk(r.risk)}${r.missing.map((m) => `<span class="chip warn">+ ${esc(label(m))}</span>`).join('')}${r.missing.length ? `<span class="pill">~${r.hours}h</span>` : '<span class="pill good">Ready now</span>'}</div></div>
        <div class="mr-acts"><button class="btn btn-ghost btn-sm" data-intent="pathway" data-role-id="${esc(r.ID)}" data-label="Plan for ${esc(r.title)}">Plan →</button></div></div>`).join('')}</div>` : ''}
      <div class="watch-note">📬 <span>Check-ins and better-match alerts come here and, if you opt in, by email or WhatsApp. <b>Demo:</b> emails go to the counsellor’s outbox, nothing is sent.</span></div></div>`;

  if (c.type === 'alert') return `<div class="card-in alert-card"><div class="row between"><span class="pill ${c.kind === 'risk' ? 'bad' : c.kind === 'match' || c.kind === 'newjob' ? 'good' : ''}">${{ match: '✨ Better match', risk: '⚠ Job risk', checkin: '📅 Check-in', newjob: '📣 New job for you' }[c.kind] || 'Alert'}</span><span class="meta">${esc(c.on || '')}</span></div>
      <b style="display:block;margin-top:6px">${esc(c.subject)}</b>
      ${c.roleID ? `<div class="row" style="margin-top:8px"><button class="btn btn-ghost btn-sm" data-intent="pathway" data-role-id="${esc(c.roleID)}" data-label="Plan for this role">Plan →</button><button class="link-btn" data-intent="explain" data-role-id="${esc(c.roleID)}" data-label="What’s missing for this role?">What’s missing?</button></div>` : ''}
      <p class="fine" style="margin:6px 0 0">Also emailed (demo: not sent).</p></div>`;

  if (c.type === 'handoff') {
    const steps = ['Sent', 'Counsellor review', c.status === 'changes' ? 'Changes requested' : 'Approved'];
    const at = c.status === 'sent' ? 1 : 2;
    return `<div class="card-in">
      <div class="hsteps">${steps.map((s, i) => `<div class="hs ${i < at ? 'done' : i === at ? (c.status === 'sent' ? 'now' : c.status === 'changes' ? 'warn' : 'done') : ''}"><i></i>${esc(s)}</div>`).join('')}</div>
      ${c.dispute ? `<div class="barrier"><span class="st no">Dispute</span> “${esc(c.dispute)}”</div>` : ''}
      ${c.removed?.length ? `<div class="barrier"><span class="st warn">Removed</span> ${esc(c.removed.join(', '))}</div>` : ''}
      ${c.note ? `<div class="barrier"><span class="st ok">Counsellor</span> ${esc(c.note)}</div>` : ''}
      ${c.plan ? `<p class="fine">Shared for review: ${c.plan.skills.length} skills${c.plan.role ? `, plan for ${esc(c.plan.role)} (${plural(c.plan.courses, 'course')}, ${c.plan.hours}h)` : ''}. Nothing goes to an employer without approval.</p>` : ''}</div>`;
  }
  return '';
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
// The plan comes in two shapes: a summary after a chat turn, the full plan when a case is reloaded.
const planText = (p) => `${plural(p.courses ?? p.steps?.length ?? 0, 'course')} · ${p.hours ?? p.totalHours ?? 0}h`;

function drawCase() {
  const el = document.getElementById('caseCard');
  if (!el) return;
  const c = chat.caseFile;
  if (!c) { el.innerHTML = `<h4>Case file</h4><p class="muted" style="font-size:14px;margin:0">Starts when you send your first message. Every agent reads and updates it.</p>`; return; }
  const p = c.profile || {}, private_ = [p.age && `Age ${p.age}`, p.gapYears && `${p.gapYears}-year gap`, p.education && `Education: ${p.education}`, p.pastTitle && `Past title: ${p.pastTitle}`, p.needsAccommodation && 'Needs accessibility'].filter(Boolean);
  el.innerHTML = `<div class="row between"><h4>Case file</h4><span class="pill ${c.status === 'approved' ? 'good' : c.status === 'changes' ? 'warn' : ''}">${esc(STATUS_TEXT[c.status] || c.status)}</span></div>
    <div class="kv"><span>Skills</span><div class="row">${c.skills.length ? c.skills.map((s) => `<span class="chip on sm">${esc(label(s.skill))}</span>`).join('') : '<span class="muted">none yet</span>'}</div></div>
    ${p.forces ? `<div class="kv"><span>🎖️ Service</span><b>${esc([p.forces.service, p.forces.rank, p.forces.years && p.forces.years + ' yrs'].filter(Boolean).join(' · ') || 'Ex-serviceman')}</b></div>` : ''}
    ${c.job ? `<div class="kv"><span>💼 Job now</span><b>${esc(c.job.title)}${c.job.company ? ' · ' + esc(c.job.company) : ''}</b></div>` : ''}
    ${c.watch?.on ? `<div class="kv"><span>👀 Watch</span><b>${c.watch.hiredAt ? 'After-hire, since ' + esc(c.watch.hiredAt) : 'Job risk, on'}${c.watch.alerts ? ` · ${plural(c.watch.alerts, 'alert')}` : ''}</b></div>` : ''}
    <div class="kv"><span>Target role</span><b>${esc(c.targetRole || '—')}</b></div>
    <div class="kv"><span>Plan</span><b>${c.plan ? planText(c.plan) : '—'}</b></div>
    <div class="kv"><span>Wants</span><b>${esc([c.prefs?.type && label(c.prefs.type), c.prefs?.remote && c.prefs?.type !== 'remote' && 'Remote', c.prefs?.location].filter(Boolean).join(' · ') || '—')}</b></div>
    ${private_.length ? `<div class="kv"><span>🔒 Private</span><div><div class="row">${private_.map((x) => `<span class="chip sm">${esc(x)}</span>`).join('')}</div>
      <div class="fine" style="margin-top:4px">Used only to check for bias. Never shown to employers.</div></div></div>` : ''}
    <div class="row between" style="margin-top:12px"><a class="link-btn" href="#/counsellor">Counsellor view</a><button class="link-btn" id="newChat2">New chat</button></div>`;
}

function drawTrace() {
  const el = document.getElementById('traceCard');
  if (!el) return;
  el.innerHTML = `<div class="row between"><h4>Agent trace</h4><span class="muted" style="font-size:12px">why the AI did what it did</span></div>
    <div class="trace">${chat.trace.length ? chat.trace.map((t) => t.turn !== undefined
      ? `<div class="tr-turn">“${esc(String(t.turn).slice(0, 60))}${String(t.turn).length > 60 ? '…' : ''}”</div>`
      : `<div class="tr" style="--ag:${agentColor(t.agent)}"><div class="tr-h"><span>${(AGENT_META[t.agent] || {}).icon || '•'} ${esc(t.name || t.agent)}</span>
          ${t.routedBy && t.routedBy !== '-' ? `<span class="pill">${esc(ROUTE_TEXT[t.routedBy] || t.routedBy)}</span>` : ''}</div>
          <div class="tr-r">${t.to ? '→ ' + esc(t.to.join(' + ')) + ' · ' : ''}${esc(t.reason || '')}</div>
          <div class="tr-m">${t.provider === 'rules' ? 'Code, no AI' : t.provider === 'person' ? 'A person' : esc(t.provider) + (t.model ? ' · ' + esc(prettyModel(t.model)) : '')}${t.ms ? ` · ${t.ms} ms` : ''}</div>
          ${t.aiError ? `<div class="tr-m ai-down">⚠ AI unavailable: ${esc(t.aiError)}. Used rules instead.</div>` : ''}</div>`).join('')
      : '<p class="muted" style="font-size:14px;margin:0">Each routing decision and agent run shows up here.</p>'}</div>`;
}

/* ---------- Counsellor view (Human-in-the-Loop) ---------- */
const desk = { cases: [], id: null, view: null };

async function counsellor() {
  view.innerHTML = `<div class="page"><div class="container">
    <div class="page-head"><h1>Counsellor desk</h1>
      <p>A person reviews every plan before anything reaches an employer. You see the skills with evidence, the plan, the fairness check and every AI decision.</p></div>
    <div class="desk"><div class="side-card" id="caseList"><div class="skeleton" style="height:200px"></div></div><div id="caseDetail"></div></div>
  </div></div>`;
  try {
    desk.cases = JSON.parse((await (await fetch('/api/cases()')).json()).value);
  } catch (e) {
    document.getElementById('caseList').innerHTML = '<div class="empty">Could not load cases. Is <code>cds watch</code> running?</div>'; return;
  }
  const order = { sent: 0, changes: 1, active: 2, approved: 3 };
  desk.cases.sort((a, b) => order[a.status] - order[b.status]);
  desk.id = desk.id && desk.cases.some((c) => c.ID === desk.id) ? desk.id : desk.cases[0]?.ID;
  drawDeskList();
  if (desk.id) openCase(desk.id);
  else document.getElementById('caseDetail').innerHTML = '<div class="side-card empty">No cases yet. Start a chat in <a href="#/journey">My Journey</a>.</div>';
}

function drawDeskList() {
  document.getElementById('caseList').innerHTML = `<h4>Cases (${desk.cases.length})</h4>` + desk.cases.map((c) => `
    <button class="case-row ${c.ID === desk.id ? 'on' : ''}" data-case="${esc(c.ID)}"><b>${esc(c.name || 'Guest')}<small>${esc(c.code)}</small></b>
      <span class="pill ${c.status === 'approved' ? 'good' : c.status === 'sent' ? 'warn' : ''}">${esc(STATUS_TEXT[c.status] || c.status)}</span>
      <span class="muted">${c.skills} skills${c.role ? ' · ' + esc(c.role) : ''}</span></button>`).join('');
}

async function openCase(id) {
  desk.id = id; drawDeskList();
  const el = document.getElementById('caseDetail');
  el.innerHTML = '<div class="skeleton" style="height:400px"></div>';
  const v = JSON.parse((await (await fetch(`/api/caseView(caseID='${encodeURIComponent(id)}')`)).json()).value);
  const c = v.caseFile, p = c.profile || {};
  const disputes = v.messages.filter((m) => m.card?.type === 'handoff' && m.card.dispute).map((m) => m.card.dispute);
  const readiness = [...v.messages].reverse().find((m) => m.card?.type === 'readiness')?.card;
  const flags = v.messages.filter((m) => m.card?.type === 'whynot' && m.card.flagged).map((m) => m.card);
  el.innerHTML = `
    <div class="side-card"><div class="row between"><h3 style="margin:0">${esc(c.name || 'Guest')} <span class="case-id" style="vertical-align:middle">${esc(c.code)}</span></h3><span class="pill ${c.status === 'approved' ? 'good' : c.status === 'sent' ? 'warn' : ''}">${esc(STATUS_TEXT[c.status] || c.status)}</span></div>
      ${disputes.map((d) => `<div class="barrier" style="margin-top:12px"><span class="st no">Disputed by the person</span> “${esc(d)}”</div>`).join('')}
      ${p.forces ? `<p style="margin:12px 0 0">🎖️ <b>Ex-serviceman</b>: ${esc([p.forces.service, p.forces.rank, p.forces.years && p.forces.years + ' years'].filter(Boolean).join(', '))}. Skills below are translated from rank and trade.</p>` : ''}
      ${flags.map((f) => `<div class="barrier" style="margin-top:12px"><span class="st no">🚩 Possible unfair rejection</span> ${esc(f.role.title)} at ${esc(f.role.company)}: ${f.matchPercent}% skills match, but a résumé filter would reject for ${esc(f.barriers.join(', '))}. Ask the employer for a skills-based review.</div>`).join('')}
      ${c.job ? `<p style="margin:12px 0 0">💼 <b>Works now as</b> ${esc(c.job.title)}${c.job.company ? ' at ' + esc(c.job.company) : ''}.${c.watch?.on ? ' The watch is on.' : ''}</p>` : ''}
      <h4 style="margin-top:18px">Skills and evidence</h4>
      <div class="evidence">${c.skills.map((s) => `<div class="ev"><span class="chip on">${esc(label(s.skill))}</span><span class="why">${s.reason ? '“' + esc(s.reason) + '”' : ''}</span><span class="badge">${s.by === 'ai' ? 'AI' : s.by === 'service' ? 'service record' : 'keywords'}</span></div>`).join('') || '<span class="muted">None yet</span>'}</div>
      <h4>Plan</h4>${c.plan ? `<p style="margin:0 0 6px"><b>${esc(c.plan.roleTitle)}</b> · ${c.plan.matchToday}% match today · ${plural(c.plan.steps.length, 'course')} · ${c.plan.totalHours}h (~${plural(c.plan.weeks, 'week')})</p>
        <ul class="plain">${c.plan.steps.map((s) => `<li>${esc(s.course.title)} <span class="muted">(${esc(s.course.provider)}, ${esc(s.course.duration)}) closes ${esc(label(s.skill))}</span></li>`).join('')}</ul>` : '<p class="muted">No plan yet.</p>'}
      <h4>Fairness check</h4><p style="margin:0">${(() => { const b = readiness ? readiness.barriers : c.barriers || []; return b.length ? `A résumé filter would reject this person for: <b>${esc(b.join(', '))}</b>. SkillSetu ignores these.` : 'No filter barriers found.'; })()}
        ${[p.age && 'age ' + p.age, p.gapYears && p.gapYears + '-year gap', p.needsAccommodation && 'needs accessibility'].filter(Boolean).length ? `<br><span class="fine">Private facts on file: ${esc([p.age && 'age ' + p.age, p.gapYears && p.gapYears + '-year gap', p.needsAccommodation && 'needs accessibility'].filter(Boolean).join(', '))}</span>` : ''}</p>
      <h4>Decision</h4>
      <textarea id="note" rows="2" placeholder="Note for the person (optional)">${esc(c.counsellorNote || '')}</textarea>
      <div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm" data-decide="approved" ${c.plan ? '' : 'disabled title="There is no plan to approve yet. Ask for changes, or wait for the person to pick a job."'}>✓ Approve plan</button>${c.plan ? '' : '<span class="fine">No plan yet, so there is nothing to approve.</span>'}<button class="btn btn-ghost btn-sm" data-decide="changes">Request changes</button></div>
      <h4 style="margin-top:18px">SAP SuccessFactors</h4>
      <div id="sfBox"><p class="muted" style="margin:0">${c.status === 'approved' ? 'Ready to hand over.' : 'Approve the plan first. Only approved, anonymised candidates go to SuccessFactors.'}</p></div>
      <h4 style="margin-top:18px">After the hire</h4>
      ${c.watch?.hiredAt ? `<p style="margin:0">🌱 Hired${c.job ? ` as <b>${esc(c.job.title)}</b>` : ''} on ${esc(c.watch.hiredAt)}. Check-ins at day 7, 30 and 90.</p>`
        : `<div class="row"><button class="btn btn-ghost btn-sm" id="markHired" ${c.targetRole ? '' : 'disabled title="Pick a target role first"'}>🎉 Mark as hired${c.targetRole ? ': ' + esc(c.targetRole) : ''}</button></div>`}
      <div class="row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" data-watch="0">👀 Run the watch now</button><button class="btn btn-ghost btn-sm" data-watch="30">⏩ As if 30 days passed</button><button class="btn btn-ghost btn-sm" data-watch="95">⏩ 3 months</button></div>
      <p class="fine">The watch also runs by itself every 6 hours. It looks for better matches, rising job risk and due check-ins for every watched person.</p>
      <div id="outboxBox"></div>
    </div>
    <div class="side-card" style="margin-top:16px"><h4>Audit trail</h4>
      <table class="data"><thead><tr><th>Agent</th><th>Routed by</th><th>What happened</th><th>Engine</th></tr></thead><tbody>
      ${v.log.map((l) => `<tr><td>${(AGENT_META[l.agent] || {}).icon || ''} ${esc(l.name)}</td><td>${esc(ROUTE_TEXT[l.routedBy] || '')}</td><td>${esc(l.reason)}</td>
        <td>${l.provider === 'rules' ? 'Code' : l.provider === 'person' ? 'Person' : esc(l.provider) + (l.model ? ' · ' + esc(prettyModel(l.model)) : '')}</td></tr>`).join('')}</tbody></table></div>
    <details class="side-card" style="margin-top:16px"><summary><b>Conversation (${v.messages.length} messages)</b></summary>
      <div class="transcript">${v.messages.map((m) => `<p><b>${m.role === 'user' ? 'Person' : m.role === 'counsellor' ? 'Counsellor' : esc(m.name || m.agent)}:</b> ${esc(m.text)}</p>`).join('')}</div></details>`;
  drawSF(id, c.status);
  drawOutbox(id);
}

async function drawOutbox(id) {
  const el = document.getElementById('outboxBox');
  if (!el) return;
  let mails = [];
  try { mails = JSON.parse((await (await fetch(`/api/outbox(caseID='${encodeURIComponent(id)}')`)).json()).value); } catch (e) {}
  el.innerHTML = mails.length ? `<div class="outbox"><div class="row between"><b>📬 Outbox</b><span class="pill warn">Demo: not sent</span></div>
    ${mails.map((m) => `<details class="mail"><summary><span class="pill ${m.kind === 'risk' ? 'bad' : m.kind === 'match' ? 'good' : ''}">${esc(m.kind)}</span> ${esc(m.subject)}</summary><p>${esc(m.body)}</p><span class="meta">${esc(m.channel)} · ${esc(String(m.at || '').slice(0, 16).replace('T', ' '))}</span></details>`).join('')}</div>` : '';
}

async function runWatch(days) {
  try {
    const r = JSON.parse(await act('runWatch', { days: +days }));
    toast(r.alerts.length ? `${plural(r.alerts.length, 'alert')} for ${new Set(r.alerts.map((a) => a.code)).size} people (as of ${r.asOf})` : `Nothing new for ${r.scanned} watched ${r.scanned === 1 ? 'person' : 'people'} as of ${r.asOf}`);
    chat.messages = [];   // the person's chat reloads with the new alerts
    openCase(desk.id);
  } catch (e) { toast('The watch could not run. Did you run cds deploy?'); }
}

async function markHired() {
  try {
    await act('markHired', { caseID: desk.id });
    toast('Marked as hired. The after-hire companion is on.');
    if (desk.id === chat.caseID) chat.messages = [];
    openCase(desk.id);
  } catch (e) { toast('Could not mark as hired. Pick a target role first.'); }
}

async function drawSF(id, status) {
  const el = document.getElementById('sfBox');
  if (!el) return;
  let pushes = [];
  try { pushes = JSON.parse((await (await fetch(`/api/sfPushes(caseID='${encodeURIComponent(id)}')`)).json()).value); } catch (e) {}
  el.innerHTML = `${pushes.length ? `<div class="sf-list">${pushes.map((p) => `<div class="sf-row"><span class="st ${p.status === 'sent' ? 'ok' : 'no'}">${p.status === 'sent' ? '✓ Sent' : 'Failed'}</span>
      <span><b>${esc(p.message || '')}</b><span class="meta">Application ${esc(p.applicationId)} · Candidate ${esc(p.candidateId)} · Req ${esc(p.jobReqId)}</span></span></div>`).join('')}</div>` : ''}
    ${status === 'approved' ? `<div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm" id="sfPush"><span class="sf-logo">SF</span> ${pushes.some((p) => p.status === 'sent') ? 'Send again' : 'Send to SAP SuccessFactors'}</button>
      <span class="fine">Creates a Candidate and a Job Application with the match % and a "fairness checked" flag. The name is not shared.</span></div>` : `<p class="muted" style="margin:0">Approve the plan first. Only approved, anonymised candidates go to SuccessFactors.</p>`}`;
}

async function sendSF() {
  const b = document.getElementById('sfPush'); if (b) b.disabled = true;
  try {
    const r = JSON.parse(await act('sendToSuccessFactors', { caseID: desk.id }));
    toast(`Sent to ${r.target}: application ${r.applicationId}`);
  } catch (e) { toast('SuccessFactors did not accept it. Is the case approved?'); }
  const c = desk.cases.find((x) => x.ID === desk.id);
  drawSF(desk.id, c?.status);
}

async function decide(decision) {
  const note = document.getElementById('note')?.value || '';
  try {
    await act('reviewCase', { caseID: desk.id, decision, note });
    toast(decision === 'approved' ? 'Approved. The person sees it in their chat.' : 'Sent back with your note.');
    if (desk.id === chat.caseID) chat.messages = [];   // reload their chat next time
    counsellor();
  } catch (e) { toast('Could not save the decision.'); }
}

async function catalog(kind) {
  const isJobs = kind === 'jobs';
  view.innerHTML = `<div class="page"><div class="container">
    <div class="page-head"><h1>${isJobs ? 'Roles hiring on skills' : 'Short courses that close gaps'}</h1>
      <p>${isJobs ? 'Every role lists the skills it needs. No degree filters, no keyword games.' : 'Free and bite-sized, from SAP Learning Hub, SWAYAM and NPTEL. Learn on your phone.'}</p>
      ${isJobs ? '<div class="row" style="margin-top:12px;font-size:13px;color:var(--muted)"><span class="chip on" style="pointer-events:none">Required skill</span><span class="chip" style="pointer-events:none">Nice to have</span><span>Demand and automation risk are illustrative demo values.</span></div>' : ''}</div>
    <div class="row" style="margin-bottom:22px"><input type="search" id="q" placeholder="Search ${isJobs ? 'roles, companies, cities' : 'courses or skills'}…">
      <div class="row" id="filters"></div></div>
    <div class="grid grid-3" id="list">${'<div class="skeleton"></div>'.repeat(6)}</div>
  </div></div>`;

  let items;
  try {
    items = isJobs ? await get('Roles?$expand=requiredSkills($expand=skill)') : await get('Courses?$expand=skill');
  } catch (e) {
    document.getElementById('list').innerHTML = '<div class="empty">Could not load data. Is <code>cds watch</code> running?</div>';
    return;
  }
  const facets = ['All', ...new Set(items.map((x) => (isJobs ? x.type : x.provider)))];
  let facet = 'All';
  const filters = document.getElementById('filters');
  const draw = () => {
    const q = document.getElementById('q').value.toLowerCase();
    const list = items.filter((x) => (facet === 'All' || (isJobs ? x.type : x.provider) === facet) && JSON.stringify(x).toLowerCase().includes(q));
    filters.innerHTML = facets.map((f) => `<button class="chip ${f === facet ? 'on' : ''}" data-facet="${esc(f)}">${esc(label(f))}</button>`).join('');
    document.getElementById('list').innerHTML = list.length ? list.map((x, i) => isJobs ? `
      <div class="card hover reveal" style="--i:${i}">
        <div class="row between"><div class="icon-tile">💼</div><span class="badge type">${esc(x.type)}</span></div>
        <h3>${esc(x.title)}</h3><div class="muted" style="font-size:14px;margin-bottom:8px">${esc(x.company)} · ${esc(x.location)} · ${esc(x.salary)}</div>
        ${x.demand || x.automationRisk ? `<div class="row" style="margin-bottom:8px">${demand(x.demand)}${risk(x.automationRisk)}</div>` : ''}
        <p>${esc(String(x.description || '').slice(0, 200))}${String(x.description || '').length > 200 ? '…' : ''}</p>
        <div class="row" style="margin-top:14px">${(x.requiredSkills || []).map((rs) => `<span class="chip ${rs.importance === 'required' ? 'on' : ''}">${esc(label(rs.skill?.name))}</span>`).join('')}</div>
      </div>` : `
      <div class="card hover reveal" style="--i:${i}">
        <div class="row between"><div class="course"><div class="thumb" style="background:${PROVIDER_COLORS[x.provider] || '#6366f1'}">${initials(x.provider)}</div></div><span class="badge">${esc(x.level)}</span></div>
        <h3>${esc(x.title)}</h3><div class="muted" style="font-size:14px">${esc(x.provider)} · ⏱ ${esc(x.duration)}</div>
        <div class="row between" style="margin-top:16px"><span class="chip on">${esc(label(x.skill?.name))}</span>
          <a class="btn btn-ghost btn-sm" href="${esc(x.url)}" target="_blank" rel="noopener">Open →</a></div>
      </div>`).join('') : '<div class="empty" style="grid-column:1/-1">Nothing matches your search.</div>';
  };
  filters.onclick = (e) => { const b = e.target.closest('[data-facet]'); if (b) { facet = b.dataset.facet; draw(); } };
  document.getElementById('q').oninput = draw;
  draw();
}

view.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-service], [data-persona]')) e.target.click(); });

function about() {
  return `<div class="page"><div class="container">
    <div class="page-head"><h1>How SkillSetu works</h1>
      <p>SkillSetu is one chat with nine helpers behind it (we call them agents). Setu, the main agent, picks which one helps you next. A real counsellor checks every plan, and every AI decision is written down so anyone can check it.</p></div>
    <div class="grid grid-3">${AGENTS.map(([ic, t, q, d], i) => `<div class="card hover reveal" style="--i:${i}">
      <div class="icon-tile">${ic}</div><h3>${t}</h3><p style="color:var(--primary);font-style:italic;margin-bottom:8px">${q}</p><p>${d}</p></div>`).join('')}</div>
    <section class="block" style="padding-bottom:0"><div class="card" style="text-align:center;padding:40px">
      <h2 style="margin:0 0 8px;letter-spacing:-.02em">Built on SAP BTP</h2>
      <p style="max-width:640px;margin:0 auto 20px">CAP (Node.js) backend with an agent orchestrator · SAP HANA Cloud · Generative AI Hub-ready AI layer with a swappable provider · skill names modelled on the ESCO taxonomy · SAP Learning Hub courses.</p>
      <a href="#/journey" class="btn btn-primary">Try it now →</a></div></section>
  </div></div>`;
}


/* ---------- Impact dashboard (CSR / government) ---------- */
const nf = (n) => Number(n || 0).toLocaleString('en-IN');
let impactData = null;
async function impact() {
  view.innerHTML = `<div class="page"><div class="container">
    <div class="page-head"><h1>Impact</h1>
      <p>How many people SkillSetu helps back into work, the skills it finds and how much fairer hiring gets, district by district.</p></div>
    <div id="impactBody"><div class="skeleton" style="height:320px"></div></div></div></div>`;
  try { impactData = JSON.parse((await (await fetch('/api/impact()')).json()).value); }
  catch (e) { document.getElementById('impactBody').innerHTML = '<div class="empty">Could not load. Run <code>cds deploy</code> and restart <code>cds watch</code>.</div>'; return; }
  const { live, districts } = impactData;
  const T = districts.reduce((a, d) => { for (const k of ['people', 'hiddenSkills', 'approved', 'placed', 'women', 'coursesDone']) a[k] = (a[k] || 0) + d[k]; return a; }, {});
  const avg = (k) => districts.reduce((a, d) => a + +d[k], 0) / (districts.length || 1);
  const before = avg('filterAIR'), after = avg('skillsetuAIR');
  const maxPeople = Math.max(...districts.map((d) => d.people));
  document.getElementById('impactBody').innerHTML = `
    <div class="live-strip"><span class="live-dot"></span><b>Live from this system</b>
      ${[[live.cases, 'people told their story'], [live.hiddenSkills, 'skills found'], [live.sentToCounsellor, 'sent to a counsellor'], [live.approved, 'approved'], [live.pushedToSuccessFactors, 'sent to SuccessFactors']]
        .map(([n, l]) => `<span class="ls"><b>${nf(n)}</b> ${l}</span>`).join('')}</div>

    <div class="synth-note">⚠ Below: <b>synthetic pilot data</b> for 12 districts, made up to show what a funder would see. Not real results.</div>
    <div class="stats impact-kpis">
      ${[[nf(T.people), 'people reached', ''], [nf(T.hiddenSkills), 'hidden skills found', `${(T.hiddenSkills / T.people).toFixed(1)} per person, none of them on a CV`],
         [nf(T.placed), 'placed in jobs', `${Math.round(T.placed / T.people * 100)}% of people reached`], [Math.round(T.women / T.people * 100) + '%', 'women', `${nf(T.women)} women`]]
        .map(([n, l, s], i) => `<div class="stat reveal" style="--i:${i}"><div class="n">${n}</div><div class="l">${l}</div>${s ? `<div class="fine">${s}</div>` : ''}</div>`).join('')}
    </div>

    <div class="grid grid-2" style="margin-top:20px">
      <div class="panel"><h2 style="font-size:22px">Fairness gap closed</h2>
        <p class="sub">Worst group's adverse impact ratio (four-fifths rule: 0.80 or more is fair). Average across districts.</p>
        <div class="gap-viz">
          <div class="gap-row"><span>Résumé filter</span><div class="gap-track"><i class="gap-bar old" style="width:${before * 100}%"></i><em style="left:80%"></em></div><b class="bad-t">${before.toFixed(2)}</b></div>
          <div class="gap-row"><span>SkillSetu</span><div class="gap-track"><i class="gap-bar new" style="width:${after * 100}%"></i><em style="left:80%"></em></div><b class="good-t">${after.toFixed(2)}</b></div>
          <div class="gap-axis"><span style="left:0">0</span><span style="left:80%">0.80 fair line</span><span style="left:100%">1.0</span></div>
        </div>
        <p class="fine" style="margin-top:14px">Every district moves from failing the four-fifths rule to passing it.</p></div>
      <div class="panel"><h2 style="font-size:22px">The funnel</h2><p class="sub">From first conversation to a job, all districts.</p>
        ${[['Told their story', T.people], ['Plan approved by a counsellor', T.approved], ['Finished a course', Math.min(T.coursesDone, T.approved)], ['Placed in a job', T.placed]]
          .map(([l, n], i) => `<div class="fun-row"><span>${l}</span><div class="fun-bar" style="--w:${n / T.people * 100}%;--i:${i}"><b>${nf(n)}</b></div></div>`).join('')}</div>
    </div>

    <div class="panel" style="margin-top:20px"><div class="row between"><h2 style="font-size:22px;margin:0">By district</h2><button class="btn btn-ghost btn-sm" id="impactCsv">⬇ Download CSV</button></div>
      <div class="table-wrap"><table class="data impact-table"><thead><tr><th>District</th><th>People</th><th>Hidden skills</th><th>Placed</th><th>Women</th><th>Fairness (worst group AIR)</th></tr></thead><tbody>
      ${districts.map((d) => `<tr><td><b>${esc(d.district)}</b><span class="meta">${esc(d.state)}</span></td>
        <td><div class="mini-h"><i style="width:${Math.max(4, Math.round(d.people / maxPeople * 80))}px"></i><span>${nf(d.people)}</span></div></td>
        <td>${nf(d.hiddenSkills)}</td><td>${nf(d.placed)} <span class="meta">${Math.round(d.placed / d.people * 100)}%</span></td>
        <td>${Math.round(d.women / d.people * 100)}%</td>
        <td><span class="air bad-t">${(+d.filterAIR).toFixed(2)}</span> → <span class="air good-t">${(+d.skillsetuAIR).toFixed(2)}</span></td></tr>`).join('')}
      </tbody></table></div>
      <p class="fine">Synthetic pilot data. In production these figures come from the case files, grouped by the district each person gives.</p></div>`;
}
function impactCsv() {
  if (!impactData) return;
  const cols = ['district', 'state', 'people', 'hiddenSkills', 'approved', 'placed', 'women', 'coursesDone', 'filterAIR', 'skillsetuAIR'];
  const csv = [cols.join(','), ...impactData.districts.map((d) => cols.map((c) => d[c]).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['# SYNTHETIC pilot data (illustration)\n' + csv], { type: 'text/csv' }));
  a.download = 'skillsetu-impact-synthetic.csv'; a.click();
}

/* ---------- router ---------- */
function route() {
  const r = (location.hash.replace('#/', '') || 'home').split('?')[0];
  document.querySelectorAll('#navLinks a').forEach((a) => a.classList.toggle('active', a.dataset.route === r));
  document.getElementById('navLinks').classList.remove('open');
  window.scrollTo({ top: 0 });
  if (r === 'journey') journey();
  else if (r === 'counsellor') counsellor();
  else if (r === 'jobs' || r === 'courses') catalog(r);
  else if (r === 'impact') impact();
  else if (r === 'about') view.innerHTML = about();
  else view.innerHTML = home();
}

/* ---------- events ---------- */
view.addEventListener('click', (e) => {
  const t = e.target;
  const persona = t.closest('[data-persona]');
  if (persona) { const p = PERSONAS[+persona.dataset.persona]; chat.pending = { message: p.story, name: p.name }; location.hash = '#/journey'; return; }
  const sv = t.closest('[data-service]');
  if (sv) { const x = SERVICES[+sv.dataset.service]; if (x.demo) chat.pending = x.demo; location.hash = x.href || '#/journey'; return; }
  const say = t.closest('[data-say]');
  if (say) {
    const k = say.dataset.say;
    const demo = { hi: ['Priya', PRIYA_HINGLISH], army: ['Vikram', VIKRAM], 'army-hi': ['Vikram', VIKRAM_HINDI], meena: ['Meena', MEENA] }[k] || [PERSONAS[+k].name, PERSONAS[+k].story];
    resetChat(); chat.name = demo[0]; drawChat();
    return sendChat({ message: demo[1] });
  }
  const sg = t.closest('[data-sugg]');
  if (sg) {
    const s = chat.suggestions[+sg.dataset.sugg];
    if (s.href) { location.hash = s.href; return; }
    return sendChat({ intent: s.intent, roleID: s.roleID, labelText: s.label });
  }
  const it = t.closest('[data-intent]');
  if (it) return sendChat({ intent: it.dataset.intent, roleID: it.dataset.roleId || null, labelText: it.dataset.label });
  const h = t.closest('[data-hist]');
  if (h) { if (h.dataset.hist !== chat.caseID) { resetChat(); chat.caseID = h.dataset.hist; try { localStorage.setItem('ss-case', chat.caseID); } catch (e) {} loadCase(); } return; }
  if (t.closest('#copyId')) { const code = chat.caseFile?.code; navigator.clipboard?.writeText(code).catch(() => {}); toast('Case ID ' + code + ' copied'); return; }
  if (t.closest('#wideChat')) { const on = document.querySelector('.journey-page').classList.toggle('focus'); t.closest('#wideChat').textContent = on ? '⤡ Show panels' : '⤢ Focus chat'; return; }
  if (t.closest('#newChat, #newChat2, #newChat3')) { resetChat(); drawChat(); document.getElementById('msg')?.focus(); return; }
  const cs = t.closest('[data-case]');
  if (cs) return openCase(cs.dataset.case);
  const dc = t.closest('[data-decide]');
  if (dc) return decide(dc.dataset.decide);
  if (t.closest('#sfPush')) return sendSF();
  if (t.closest('#markHired')) return markHired();
  const wt = t.closest('[data-watch]');
  if (wt) return runWatch(wt.dataset.watch);
  if (t.closest('#impactCsv')) return impactCsv();
});

document.getElementById('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('ss-theme', next); } catch (e) {}
});
document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('navLinks').classList.toggle('open'));

document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute"><defs>
  <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ef6c1a"/><stop offset="1" stop-color="#6d3fd8"/></linearGradient></defs></svg>`);

window.addEventListener('hashchange', route);
route();
