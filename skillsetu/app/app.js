const view = document.getElementById('view');

const PERSONAS = [
  { name: 'Priya', age: 34, city: 'Indore', color: 'var(--sapAccentColor1)', tag: 'Returning after a career break',
    quote: 'Back after a 6-year childcare break; the gap gets me auto-rejected.',
    story: 'I am 34 and took a 6-year break to raise my 3 children. In that time I managed our household budget, coordinated school schedules, organized community events and negotiated with vendors for school functions.' },
  { name: 'Ravi', age: 38, city: 'Pune', color: 'var(--sapAccentColor7)', tag: 'Displaced by automation',
    quote: 'My BPO voice role was replaced by a chatbot. The job title no longer exists.',
    story: 'I worked as a BPO voice agent for 5 years, handled customer complaints, solved billing problems, led a team of 5 agents and trained new joiners. I communicate well in Hindi and English.' },
  { name: 'Arjun', age: 26, city: 'Lucknow', color: 'var(--sapAccentColor5)', tag: 'Wheelchair user, B.Com',
    quote: 'Employers aren’t accessibility-ready, so I never get to the interview.',
    story: 'I am a B.Com graduate and a wheelchair user. I am skilled in Excel spreadsheets and data entry, kept records for a local shop, organized college events and managed the student council budget.' }
];

const VIKRAM = 'I served 22 years in the Indian Army and retired as a Havildar in the Army Service Corps. I was a storekeeper: kept the stock register for rations and fuel, made the duty roster for my section of 10 jawans, and trained new recruits. I also helped run our unit canteen accounts.';
const VIKRAM_HINDI = 'मैं 18 साल फ़ौज में रहा और हवलदार बनकर रिटायर हुआ। मैं ड्राइवर था, काफ़िले की ड्यूटी रोस्टर बनाता था और नए जवानों को सिखाता था।';
const MEENA = 'I have worked at ServiceFirst in Hyderabad for 4 years as a customer service representative. I handle angry customers on calls, solve billing problems, and explain bills in Hindi and Telugu. Last year I started training new joiners and making the shift roster for our team of 8. Now the company is bringing in an AI chatbot and I am scared about my job.';
const PRIYA_HINGLISH = 'Maine bachon ke liye 6 saal ka break liya. Us dauraan ghar ka budget sambhala, 3 bachon ke school schedule manage kiye, society ke events organize kiye aur school functions ke liye vendors se bargaining ki.';

/* ---------- icons: SAP Fiori icon font via <ui5-icon> ---------- */
const SAP_ICON = {
  bridge: 'chain-link', search: 'search', chart: 'line-chart', cap: 'education', match: 'group', shield: 'shield',
  human: 'employee', bulb: 'lightbulb', radar: 'radar-chart', sprout: 'trend-up', chat: 'discussion', puzzle: 'puzzle',
  target: 'target-group', book: 'course-book', briefcase: 'suitcase', coins: 'money-bills', calendar: 'calendar',
  laptop: 'laptop', spark: 'ai', star: 'favorite', medal: 'official-service', lock: 'private', eye: 'show',
  clock: 'history', id: 'badge', arrow: 'arrow-right', check: 'accept', download: 'download', flag: 'flag'
};
const ic = (n, s = 18) => `<ui5-icon class="ico" name="${SAP_ICON[n] || n}" style="width:${s}px;height:${s}px" aria-hidden="true"></ui5-icon>`;

const AGENTS = [
  [ic('search', 22), 'Skills Discovery', '“My experience doesn’t fit a job title.”', 'A chat in your own language turns life and work experience into skills.'],
  [ic('chart', 22), 'Market Intelligence', '“Which jobs even exist now?”', 'Growing roles near your skills, with pay, demand and automation risk.'],
  [ic('cap', 22), 'Learning Pathway', '“I can’t afford a long course.”', 'The shortest gap-closing plan: bite-sized courses on a phone.'],
  [ic('match', 22), 'Inclusive Matching', '“I need income while I learn.”', 'Skills-first, anonymised matches: part-time, remote, apprenticeships.'],
  [ic('shield', 22), 'Readiness Check', '“They reject me before they meet me.”', 'Shows what a résumé filter would reject you for, and how to present your skills.'],
  [ic('human', 22), 'Human-in-the-Loop', '“Who checks the AI?”', 'A counsellor approves plans, recruiters decide hires, users can dispute the AI.'],
  [ic('bulb', 22), 'Why-Not Explainer', '“Nobody tells me why I was rejected.”', 'Explains a “no”: the missing skill, an unfair filter or a job that doesn’t fit, and the smallest change that turns it into a “yes”.'],
  [ic('radar', 22), 'Job Risk Radar', '“Will AI take my job?”', 'Spots jobs at risk of automation early and finds safer roles, first inside the same company.'],
  [ic('sprout', 22), 'After-Hire Companion', '“What happens after I’m hired?”', 'Check-ins at day 7, 30 and 90, the next step up, and alerts when a better job matches.'],
  [ic('globe', 22), 'Web Research', '“What’s true right now?”', 'Looks up current facts on the web, such as schemes, salaries and courses, and shows the sources.'],
  [ic('company-view', 22), 'Company Connect', '“Can I move to another team instead?”', 'With your OK, reads your work profile from your employer over MCP and finds open roles inside your own company.']
];

const TOOL_NAMES = new Set(['Learning Pathway', 'Inclusive Matching', 'Human-in-the-Loop', 'Why-Not Explainer', 'After-Hire Companion']);

const PROVIDER_COLORS = { 'SAP Learning Hub': 'var(--sapAvatar_6_Background)', 'SWAYAM': 'var(--sapAvatar_1_Background)', 'NPTEL': 'var(--sapAvatar_8_Background)' };


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

// Open jobs read live from SAP (SuccessFactors / HANA Cloud) through the SAP MCP server.
const sapJobs = (s) => !s?.jobs?.length ? '' : `<div class="sap-jobs"><div class="row between"><b>Open now in SAP</b><span class="badge" title="Read through the SAP MCP server">${esc(s.source)}</span></div>
      ${s.jobs.map((j, i) => `<div class="mrole reveal" style="--i:${i}">${ring(j.matchPercent, 52)}
        <div class="mr-body"><b>${esc(j.title)}</b><div class="meta">${[j.department, j.location, `${j.openings} opening${j.openings === 1 ? '' : 's'}`, `Req ${j.jobReqId}`].filter(Boolean).map(esc).join(' · ')}</div>
          <div class="row" style="margin-top:6px">${j.matchedSkills.map((x) => `<span class="chip good">✓ ${esc(label(x))}</span>`).join('')}${j.missingSkills.map((x) => `<span class="chip warn">+ ${esc(label(x))}</span>`).join('')}</div></div>
        ${j.roleID ? `<div class="mr-acts">${j.missingSkills.length ? `<button class="btn btn-ghost btn-sm" data-intent="pathway" data-role-id="${esc(j.roleID)}" data-label="Plan for ${esc(j.title)} (SAP)">Plan →</button>` : ''}
          <button class="link-btn" data-intent="human" data-role-id="${esc(j.roleID)}" data-label="Apply for ${esc(j.title)} through a counsellor">Apply via counsellor</button></div>` : ''}</div>`).join('')}
      <p class="fine">${s.total} open requisitions read through the SAP MCP server. Skills come from each job’s own description, matched on skills only.</p></div>`;

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

// Demo stories shown as launchpad tiles on the home page.
const STORIES = [
  { name: 'Priya', sub: 'Back after a 6-year career break', message: () => PERSONAS[0].story, color: 'Accent1' },
  { name: 'Ravi', sub: 'BPO job replaced by a chatbot', message: () => PERSONAS[1].story, color: 'Accent6' },
  { name: 'Arjun', sub: 'Wheelchair user, B.Com', message: () => PERSONAS[2].story, color: 'Accent5' },
  { name: 'Vikram', sub: '22 years in the Indian Army', message: () => VIKRAM, color: 'Accent8' },
  { name: 'Meena', sub: 'Her job is at risk from AI', message: () => MEENA, color: 'Accent2' }
];

const tile = ({ title, sub = '', icon, foot = '', attrs = '', num = '', unit = '' }) => `<div class="tile" role="button" tabindex="0" ${attrs}>
    <div class="tile-h"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>
    <div class="tile-c">${num ? `<span class="tile-num">${num}</span>${unit ? `<span class="tile-unit">${unit}</span>` : ''}` : icon ? ic(icon, 32) : ''}</div>
    ${foot ? `<div class="tile-f">${foot}</div>` : ''}</div>`;

function home() {
  return `<div class="page home"><div class="container">
  <section class="dp-head">
    <div>
      <h1>Welcome to SkillSetu</h1>
      <p class="dp-sub">Turn real-life experience into skills, match to jobs on skills alone, and close the gap with short free courses.</p>
    </div>
    <div class="dp-actions">
      <ui5-button design="Emphasized" icon="discussion" data-href="#/journey">Start my journey</ui5-button>
      <ui5-button design="Transparent" data-href="#/about">How it works</ui5-button>
    </div>
  </section>
  <ui5-message-strip design="Information" hide-close-button>SAP Hackfest 2026 · Inclusive Workforce. Built on SAP CAP, SAP HANA Cloud and SAP BTP, with a swappable AI layer ready for Generative AI Hub.</ui5-message-strip>

  <h2 class="grp">Why it matters</h2>
  <div class="tiles">
    ${tile({ title: 'Qualified people rejected', sub: 'by automated résumé filters', num: '88', unit: '%', foot: 'Harvard Business School, 2021' })}
    ${tile({ title: 'Jobs displaced', sub: 'worldwide by 2030', num: '92', unit: 'M', foot: 'WEF Future of Jobs 2025' })}
    ${tile({ title: 'Women in the workforce', sub: 'India, labour force participation', num: '41.7', unit: '%', foot: 'PLFS 2023-24' })}
    ${tile({ title: 'Names shown to employers', sub: 'only the case ID and skills', num: '0', foot: 'By design' })}
  </div>

  <h2 class="grp">For job seekers</h2>
  <div class="tiles">
    ${tile({ title: 'My Journey', sub: 'Setu + 6 agents', icon: 'discussion', foot: 'Any language', attrs: 'data-href="#/journey"' })}
    ${SERVICES.map((sv, i) => { const [, t] = AGENTS[sv.agent]; return tile({ title: esc(t), sub: esc(sv.cta), icon: ['lightbulb', 'radar-chart', 'trend-up'][i], foot: esc(sv.who), attrs: `data-service="${i}"` }); }).join('')}
    ${tile({ title: 'Jobs', sub: 'Roles hiring on skills', icon: 'suitcase', foot: 'No degree filters', attrs: 'data-href="#/jobs"' })}
    ${tile({ title: 'Courses', sub: 'Short and free', icon: 'course-book', foot: 'SAP Learning Hub, SWAYAM, NPTEL', attrs: 'data-href="#/courses"' })}
  </div>

  <h2 class="grp">For counsellors and employers</h2>
  <div class="tiles">
    ${tile({ title: 'Counsellor Desk', sub: 'Approve plans, see every AI step', icon: 'employee-approvals', foot: 'Human in the loop', attrs: 'data-href="#/counsellor"' })}
    ${tile({ title: 'Impact', sub: 'Districts, placements, fairness', icon: 'bar-chart', foot: 'For CSR and government', attrs: 'data-href="#/impact"' })}
    ${tile({ title: 'Integration API', sub: 'REST, webhooks, MCP', icon: 'chain-link', foot: 'OpenAPI 3', attrs: 'data-href="api-docs.html"' })}
    ${tile({ title: 'SAP SuccessFactors', sub: 'Send approved candidates', icon: 'sap-box', foot: 'Recruiting connector', attrs: 'data-href="#/counsellor"' })}
  </div>

  <h2 class="grp">Demo stories</h2>
  <div class="tiles">
    ${STORIES.map((p, i) => `<div class="tile story" role="button" tabindex="0" data-story="${i}">
      <div class="tile-h"><b>${p.name}</b><span>${esc(p.sub)}</span></div>
      <div class="tile-c"><ui5-avatar size="S" initials="${p.name[0]}" color-scheme="${p.color}"></ui5-avatar></div>
      <div class="tile-f">Walk the journey</div></div>`).join('')}
  </div>
  </div></div>`;
}

/* ---------- My Journey: Setu (main agent) + 6 specialist agents + 5 tools ---------- */
const AGENT_META = {
  orchestrator: { name: 'Setu', stop: 'Setu', icon: ic('bridge'), color: 'var(--sapAccentColor6)' },
  skills: { name: 'Skills Discovery', stop: 'Skills', icon: ic('search'), color: 'var(--sapAccentColor5)' },
  market: { name: 'Market Intelligence', stop: 'Market', icon: ic('chart'), color: 'var(--sapAccentColor7)' },
  pathway: { name: 'Learning Pathway', stop: 'Learning', icon: ic('cap'), color: 'var(--sapAccentColor8)' },
  matching: { name: 'Inclusive Matching', stop: 'Matching', icon: ic('match'), color: 'var(--sapAccentColor3)' },
  readiness: { name: 'Readiness Check', stop: 'Readiness', icon: ic('shield'), color: 'var(--sapAccentColor2)' },
  human: { name: 'Human-in-the-Loop', stop: 'Counsellor', icon: ic('human'), color: 'var(--sapAccentColor10)' },
  explain: { name: 'Why-Not Explainer', stop: 'Why not?', icon: ic('bulb'), color: 'var(--sapAccentColor1)' },
  shield: { name: 'Job Risk Radar', stop: 'Risk radar', icon: ic('radar'), color: 'var(--sapAccentColor2)' },
  growth: { name: 'After-Hire Companion', stop: 'After hire', icon: ic('sprout'), color: 'var(--sapAccentColor8)' },
  'sap-mcp': { name: 'SAP MCP', stop: 'SAP', icon: ic('chain-link'), color: 'var(--sapAccentColor6)' },
  chat: { name: 'Setu', stop: 'Setu', icon: ic('bridge'), color: 'var(--sapAccentColor6)' },
  research: { name: 'Web Research', stop: 'Web', icon: ic('globe'), color: 'var(--sapAccentColor7)' },
  company: { name: 'Company Connect', stop: 'Company', icon: ic('company-view'), color: 'var(--sapAccentColor5)' },
  'company-mcp': { name: 'Company MCP', stop: 'MCP', icon: ic('chain-link'), color: 'var(--sapAccentColor5)' }
};
// Metro map: the main line is the usual journey, the branch line holds the help you can ask for any time.
// Status tags on the case file: one per agent that has worked on the case.
const STAMPS = {
  skills: ['Skills verified', 'var(--sapAccentColor5)'], market: ['Market checked', 'var(--sapAccentColor7)'], pathway: ['Plan issued', 'var(--sapAccentColor8)'],
  matching: ['Matched on skills', 'var(--sapAccentColor3)'], readiness: ['Readiness checked', 'var(--sapAccentColor2)'], explain: ['Why-not explained', 'var(--sapAccentColor1)'],
  shield: ['Risk scanned', 'var(--sapAccentColor2)'], growth: ['Hired', 'var(--sapAccentColor8)']
};
// Status tags already shown for a case, so only new ones animate in.
const shownTags = {};
const seenTag = (id, t) => { const s = shownTags[id] || (shownTags[id] = new Set()); const had = s.has(t); s.add(t); return had; };
const SKILL_ICON = { financial: ic('coins'), organizational: ic('calendar'), interpersonal: ic('match'), technical: ic('laptop'), analytical: ic('spark') };
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
const aiTag = (provider, model) => provider ? `<span class="ai-badge">${esc(provider)}${model ? ' · ' + esc(prettyModel(model)) : ''}</span>` : '<span class="badge">Rules (AI offline)</span>';

// The side panel shows one thing at a time (case file, agent trace or past chats), so the page stays calm.
const sideTab = () => { try { return localStorage.getItem('ss-side') || 'caseCard'; } catch (e) { return 'caseCard'; } };
function showSide(id, remember) {
  document.querySelectorAll('.side-tabs [data-side]').forEach((b) => { const on = b.dataset.side === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); if (on) b.classList.remove('dot'); });
  document.querySelectorAll('.side-pane').forEach((p) => p.classList.toggle('on', p.id === id));
  if (remember) try { localStorage.setItem('ss-side', id); } catch (e) {}
}

function journey() {
  view.innerHTML = `<div class="page journey-page"><div class="container">
    <div class="page-head"><div class="row between"><h1>Talk to SkillSetu</h1><div class="row"><button class="btn btn-ghost btn-sm" id="wideChat" title="Hide the side panels and give the chat the whole screen">Focus chat</button><button class="btn btn-ghost btn-sm" id="newChat" title="Clear this chat and start a new person">New chat</button></div></div>
      <p>Setu is the main agent: it reads your message and picks which of its 6 specialist agents and 5 tools help you next. Every step is logged, and a person signs off.</p></div>
    <div class="metro" id="agentStrip" aria-label="Your route through the agents"></div>
    <div class="chat-layout">
      <section class="chat-box">
        <div class="chat-head" id="chatHead"></div>
        <div class="connect-banner" id="connectBanner" hidden></div>
        <div class="chat-log" id="chatLog"></div>
        <div class="suggest" id="suggest"></div>
        <form class="composer" id="composer">
          <textarea id="msg" rows="1" placeholder="Message Setu in any language: English, Hindi, Hinglish…"></textarea>
          <button class="btn btn-primary" id="sendBtn" type="submit" aria-label="Send">Send</button>
        </form>
      </section>
      <aside class="side">
        <div class="side-tabs" role="tablist" aria-label="Side panel">
          <button role="tab" data-side="caseCard">Case file</button>
          <button role="tab" data-side="traceCard">Agent trace</button>
          <button role="tab" data-side="histCard">My chats</button>
        </div>
        <div class="side-card side-pane" id="caseCard" role="tabpanel"></div>
        <div class="side-card side-pane" id="traceCard" role="tabpanel"></div>
        <div class="side-card side-pane" id="histCard" role="tabpanel"></div>
      </aside>
    </div>
  </div></div>`;
  showSide(sideTab());
  document.querySelector('.side-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-side]'); if (b) showSide(b.dataset.side, true); });
  const ta = document.getElementById('msg');
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat({ message: ta.value }); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; });
  document.getElementById('composer').addEventListener('submit', (e) => { e.preventDefault(); sendChat({ message: ta.value }); });

  if (ssAuth.get()?.role === 'user' && !chat.name) chat.name = ssAuth.get().displayName;
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
        <span class="case-id" id="copyId" title="Your unique case ID. Click to copy.">${ic('id', 14)} ${esc(c.code)}</span>`
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
    chat.messages.push(...out.replies.map((r) => ({ role: 'agent', ...r, fresh: true })));
    chat.suggestions = out.suggestions;
    chat.caseFile = out.caseFile;
  } catch (e) {
    chat.messages.push({ role: 'agent', agent: 'orchestrator', name: 'Setu', text: 'I couldn’t reach SkillSetu just now. Please try again in a moment.' });
  }
  chat.busy = false;
  drawChat();
  loadHistory();
}

function drawChat(thinking = false) {
  const log = document.getElementById('chatLog');
  if (!log) return;
  const welcome = `<div class="msg agent" style="--ag:${agentColor('orchestrator')}">
      <div class="who"><span class="av">${ic('bridge')}</span>Setu</div>
      <div class="bubble"><p>Namaste${chat.name || ssAuth.get()?.role === 'user' ? ', ' + esc(chat.name || ssAuth.get().displayName) : ''}! Tell me about your life and work so far, paid or unpaid. Home, family and community work all count. Write in any language.</p>
        ${chat.caseID || ssAuth.get()?.username ? '' : `<div class="name-ask"><input id="nameIn" maxlength="60" placeholder="Your first name (optional)" value="${esc(chat.name)}">
          <span class="fine">Only your counsellor sees your name. Employers see your case ID and skills, nothing else.</span></div>`}
        <p class="muted" style="margin-top:8px;font-size:14px">Or try a real story:</p>
        <div class="row">${PERSONAS.map((p, i) => `<button class="chip" data-say="${i}">${p.name}’s story</button>`).join('')}
          <button class="chip" data-say="hi">Priya in Hinglish</button><button class="chip" data-say="army">Vikram, ex-Army</button><button class="chip" data-say="army-hi">Vikram in Hindi</button><button class="chip" data-say="meena">Meena, job at risk</button></div></div></div>`;
  log.innerHTML = welcome + chat.messages.map(drawMsg).join('') + (thinking ? `<div class="msg agent thinking" style="--ag:${agentColor('orchestrator')}">
      <div class="who"><span class="av">${ic('bridge')}</span>Setu</div><div class="bubble"><span class="dots"><i></i><i></i><i></i></span> Setu is typing…</div></div>` : '');
  log.scrollTop = log.scrollHeight;
  chat.messages.forEach((m) => { m.fresh = false; });
  typeOut(log);
  drawConnect();
  document.getElementById('suggest').innerHTML = chat.suggestions.map((s, i) =>
    `<button class="chip sugg" data-sugg="${i}">${esc(s.label)} →</button>`).join('');
  document.getElementById('sendBtn').disabled = chat.busy;
  drawMetro();
  drawHead();
  drawCase();
  drawTrace();
  drawHistory();
  animateRings();
}

// "Connect your company data?": shown to a signed-in job seeker whose work email belongs to a partner company.
const connectState = { checked: null, match: null };
async function drawConnect() {
  const el = document.getElementById('connectBanner');
  if (!el) return;
  const a = ssAuth.get();
  const key = `${a?.username || ''}|${chat.caseID || ''}`;
  if (a?.role !== 'user' || !a.username) { el.hidden = true; return; }
  let dismissed = false; try { dismissed = localStorage.getItem('ss-connect-no:' + a.username) === '1'; } catch (e) {}
  if (connectState.checked !== key) {
    connectState.checked = key; connectState.match = null;
    try { connectState.match = JSON.parse((await (await fetch(`/api/companyMatch(caseID='${encodeURIComponent(chat.caseID || '')}')`)).json()).value); } catch (e) {}
  }
  const m = connectState.match;
  const connected = m?.connected || chat.caseFile?.profile?.company?.connected;
  if (!m || connected || dismissed) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<div class="cb-ic">${ic('company-view', 22)}</div>
    <div class="cb-t"><b>You work at ${esc(m.company)}. Connect your work profile?</b>
      <span>Setu will read your role, skills and projects from ${esc(m.company)}'s data over the Company MCP, and show open roles inside the company. Your employer isn't told.</span></div>
    <div class="cb-a"><button class="btn btn-primary btn-sm" data-intent="company" data-label="Connect my ${esc(m.company)} data">Connect</button>
      <button class="btn btn-ghost btn-sm" id="cbNo">Not now</button></div>`;
  document.getElementById('cbNo').addEventListener('click', () => { try { localStorage.setItem('ss-connect-no:' + a.username, '1'); } catch (e) {} el.hidden = true; });
}

function visitedAgents() {
  const v = new Set(chat.trace.filter((t) => t.agent).map((t) => t.agent));
  chat.active.forEach((a) => v.add(a));
  chat.messages.forEach((m) => m.agent && v.add(m.agent));
  if (chat.caseFile) v.add('orchestrator');
  if (['sent', 'approved', 'changes'].includes(chat.caseFile?.status)) v.add('human');
  return v;
}

// Agent bar: the 6 agents (they use AI or call MCP / web tools), then the 5 tools (fixed code steps Setu can run).
// The ones that answered the last message light up ("working"); any of them can be used again with one click.
const AGENT_BAR = ['skills', 'market', 'readiness', 'shield', 'research', 'company'];
const TOOL_BAR = ['pathway', 'matching', 'explain', 'human', 'growth'];
function drawMetro() {
  const el = document.getElementById('agentStrip');
  if (!el) return;
  const v = visitedAgents();
  const chip = (id) => { const a = AGENT_META[id]; const on = chat.active.includes(id);
    return `<button class="ab-chip ${on ? 'on' : v.has(id) ? 'used' : ''}" style="--ag:${a.color}" data-agent="${id}" title="${on ? `${esc(a.name)} answered your last message` : `Ask ${esc(a.name)}`}">
      <i>${a.icon}</i><span>${esc(a.stop)}</span>${on ? '<em>working</em>' : ''}</button>`; };
  el.innerHTML = `<div class="ab-lead"><span class="ab-setu">${AGENT_META.orchestrator.icon}</span><span><b>Setu</b><small>${chat.busy ? 'Main agent · working…' : 'Main agent · picks the agent, or tap one'}</small></span></div>
    <div class="ab-list"><span class="ab-group">Agents</span>${AGENT_BAR.map(chip).join('')}<span class="ab-group">Tools</span>${TOOL_BAR.map(chip).join('')}</div>`;
  el.querySelectorAll('[data-agent]').forEach((b) => b.addEventListener('click', () => {
    if (chat.busy) return;
    const id = b.dataset.agent, a = AGENT_META[id];
    // Web Research needs a question, so it starts one in the message box.
    if (id === 'research') { const ta = document.getElementById('msg'); ta.value = 'Search the web: '; ta.focus(); return; }
    sendChat({ intent: id, labelText: `Ask ${a.name}` });
  }));
}

function drawMsg(m) {
  if (m.role === 'user') return `<div class="msg user"><div class="bubble">${esc(m.text)}</div></div>`;
  const id = m.agent || 'orchestrator', a = AGENT_META[id] || AGENT_META.orchestrator;
  const who = m.role === 'counsellor' ? 'Counsellor (a person)' : a.name;
  return `<div class="msg agent" style="--ag:${a.color}"><div class="who"><span class="av">${m.role === 'counsellor' ? ic('human') : a.icon}</span>${esc(who)}</div>
    <div class="bubble">${m.fresh ? `<p data-type="${esc(m.text)}"></p>` : `<p>${esc(m.text)}</p>`}${m.card ? (m.fresh ? `<div class="after-type" hidden>${drawCard(m.card)}</div>` : drawCard(m.card)) : ''}</div></div>`;
}

// New replies appear word by word, like a person typing; any card shows once its text is done.
let typingRun = 0;
async function typeOut(log) {
  const run = ++typingRun;
  const still = () => run === typingRun && document.body.contains(log);
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  for (const p of [...log.querySelectorAll('p[data-type]')]) {
    const text = p.dataset.type; p.removeAttribute('data-type');
    const after = p.parentElement.querySelector(':scope > .after-type');
    if (calm || !still()) { p.textContent = text; if (after) after.hidden = false; continue; }
    const words = text.split(/(\s+)/);
    const delay = Math.max(6, Math.min(30, 1500 / words.length));
    for (let i = 0; i < words.length; i++) {
      if (!still()) { p.textContent = text; break; }
      p.textContent += words[i];
      if (i % 2 === 0) { log.scrollTop = log.scrollHeight; await new Promise((r) => setTimeout(r, delay)); }
    }
    if (after) { after.hidden = false; animateRings(); }
    log.scrollTop = log.scrollHeight;
  }
}

function drawCard(c) {
  // Skills: one line each (skill + the words that prove it); meaning and matching jobs open on click.
  if (c.type === 'skills') return `<div class="card-in skills-card">
      <div class="row between"><b class="sc-title">Your skills (${c.skills.length})</b>${c.source === 'file' ? '' : c.source === 'ai' ? aiTag(c.provider, c.model) : aiTag()}</div>
      ${c.jobsOpened ? `<p class="sc-intro">${c.jobsOpened} of ${c.totalJobs} jobs on SkillSetu ask for at least one of these. Each skill shows the words that prove it.</p>` : ''}
      <div class="sk-list">${c.skills.map((s) => `<details class="sk-row">
        <summary><span class="chip good">✓ ${esc(label(s.skill))}</span>${s.isNew ? '<b class="new">new</b>' : ''}<span class="sk-proof">${s.reason ? `“${esc(s.reason)}”` : 'Added by you'}</span></summary>
        <div class="sk-more">${s.desc ? `<div><span class="st-k">What it means</span> ${esc(s.desc)}</div>` : ''}
          ${s.jobs ? `<div><span class="st-k">Opens doors to</span> ${plural(s.jobs, 'job')}, like ${esc(s.jobTitles.join(', '))}</div>` : ''}
          <div class="st-by">${s.by === 'ai' ? 'Found by the AI' : s.by === 'keywords' ? 'Found by keyword check' : s.by === 'service' ? 'From your service record' : 'From your profile'}</div></div>
      </details>`).join('')}</div></div>`;

  // Service translator: one line per rank or duty (army term → civilian job); quotes and skills open on click.
  if (c.type === 'military') return `<div class="card-in mil-card">
      <div class="row between"><b class="sc-title">${ic('medal')} Service in civilian words</b><span class="badge">${esc(c.service || 'Armed forces')}${c.years ? ` · ${c.years} years` : ''}</span></div>
      <div class="sk-list">${c.rows.map((r) => `<details class="sk-row">
        <summary><b class="mil-term">${esc(r.term)}</b><span class="mil-to-ic" aria-hidden="true">→</span><b>${esc(r.civilian)}</b></summary>
        <div class="sk-more"><div>${esc(r.detail)}</div>${r.quote ? `<div class="sk-proof">“${esc(r.quote)}”</div>` : ''}
          <div class="row">${r.skills.map((x) => `<span class="chip on sm">${esc(x)}</span>`).join('')}</div></div>
      </details>`).join('')}</div>
      ${c.jobs?.length ? `<p class="sc-intro" style="margin-top:10px">Job titles to search for: ${c.jobs.map(esc).join(' · ')}</p>` : ''}</div>`;

  if (c.type === 'roles') return `<div class="card-in">${c.roles.map((r, i) => `
      <div class="mrole reveal" style="--i:${i}">${ring(r.matchPercent, 58)}
        <div class="mr-body"><b>${esc(r.title)}</b><div class="meta">${esc(r.company)} · ${esc(r.location)} · ${esc(r.salary)} · ${esc(r.type)}</div>
          <div class="row">${demand(r.demand)}${risk(r.automationRisk)}</div>
          <div class="row" style="margin-top:6px">${r.matchedSkills.map((s) => `<span class="chip good">✓ ${esc(label(s))}</span>`).join('')}${r.missingSkills.map((s) => `<span class="chip warn">+ ${esc(label(s))}</span>`).join('')}</div></div>
        <div class="mr-acts"><button class="btn btn-ghost btn-sm" data-intent="pathway" data-role-id="${esc(r.ID)}" data-label="Plan for ${esc(r.title)}">Plan →</button>
          ${r.matchPercent < 100 ? `<button class="link-btn" data-intent="explain" data-role-id="${esc(r.ID)}" data-label="Why wouldn’t I get ${esc(r.title)}?">Why not?</button>` : ''}</div></div>`).join('')}
      <p class="fine">Demand and automation risk are illustrative demo values.</p>${sapJobs(c.sap)}</div>`;

  if (c.type === 'path') return `<div class="card-in">
      ${c.readyFor ? `<div class="barrier"><span class="st ok">✓ Ready now</span> ${esc(c.readyFor)}: you can apply today</div><p class="fine" style="margin:0 0 8px">Next step up:</p>` : ''}
      <div class="row between"><b>${esc(c.role.title)} · ${esc(c.role.company)}</b><span class="badge type">${c.matchPercent}% today</span></div>
      <div class="mini-stats"><div><b>${c.steps.length}</b><span>${c.steps.length === 1 ? 'course' : 'courses'}</span></div><div><b>${c.totalHours}h</b><span>learning</span></div><div><b>${c.weeks} wk</b><span>at 5h/week</span></div></div>
      ${c.steps.length ? `<div class="timeline compact">${c.steps.map((s, i) => `<div class="t-item reveal" style="--i:${i}"><div class="course">
        <div class="thumb" style="background:${PROVIDER_COLORS[s.course.provider] || 'var(--sapAvatar_10_Background)'}">${initials(s.course.provider)}</div>
        <div style="flex:1"><h4>${esc(s.course.title)}</h4><div class="meta"><span>${esc(s.course.provider)}</span><span>${esc(s.course.duration)}</span><span>Closes: ${esc(label(s.skill))} (${esc(s.importance === 'requested' ? 'you asked' : s.importance)})</span></div></div>
        <a class="btn btn-ghost btn-sm" href="${esc(s.course.url)}" target="_blank" rel="noopener">Open</a></div></div>`).join('')}</div>` : '<div class="empty" style="padding:16px">No gaps. You can apply today.</div>'}</div>`;

  if (c.type === 'matches') return `<div class="card-in">
      <div class="anon-card"><div class="row between"><b>What employers see</b><span class="badge type">${esc(c.alias)}</span></div>
        <div class="row" style="margin-top:8px">${c.skills.map((s) => `<span class="chip on">${esc(label(s))}</span>`).join('')}</div>
        <div class="row" style="margin-top:8px"><span class="muted" style="font-size:13px">Hidden:</span>${c.hidden.map((h) => `<span class="chip struck">${esc(h)}</span>`).join('')}</div></div>
      ${c.filters.length ? `<div class="row" style="margin:10px 0 4px"><span class="muted" style="font-size:13px">Filters:</span>${c.filters.map((f) => `<span class="chip ${c.relaxed ? 'warn' : 'good'}">${esc(f)}${c.relaxed ? ' (relaxed)' : ''}</span>`).join('')}</div>` : ''}
      ${c.roles.map((r, i) => `<div class="mrole reveal" style="--i:${i}">${ring(r.matchPercent, 58)}
        <div class="mr-body"><b>${esc(r.title)}</b><div class="meta">${esc(r.company)} · ${esc(r.location)} · ${esc(r.salary)} · ${esc(r.type)}</div></div>
        <button class="btn btn-ghost btn-sm" data-intent="human" data-label="Ask a counsellor to introduce me for ${esc(r.title)}">Request intro</button></div>`).join('')}</div>`;

  if (c.type === 'readiness') return `<div class="card-in">
      ${c.barriers.length ? c.barriers.map((b) => `<div class="barrier"><span class="st no">Résumé filter</span> rejects for <b>${esc(b)}</b><span class="st ok">SkillSetu ignores it</span></div>`).join('')
        : '<div class="barrier"><span class="st ok">✓</span> No common filter barriers found.</div>'}
      <div class="row between" style="margin-top:6px"><b>Readiness tips</b>${c.tipsBy === 'ai' ? aiTag(c.provider, c.model) : aiTag()}</div>
      <ol class="tips">${c.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      <p class="fine">SkillSetu matches on skills only. Counsellors and employers run the group bias audit (four-fifths rule) on their own screening.</p></div>`;

  if (c.type === 'whynot') {
    const pass = c.matchPercent >= c.passMark;
    return `<div class="card-in why-card">
      <div class="row between"><b class="sc-title">${ic('bulb')} Why not: ${esc(c.role.title)}</b><span class="badge">${esc(c.role.company)}</span></div>
      <div class="why-meter"><div class="wm-track">${c.fix ? `<i class="ghost" style="width:${c.fix.newPercent}%"></i>` : ''}<i class="${pass ? 'ok' : 'no'}" style="width:${c.matchPercent}%"></i><em style="left:${c.passMark}%"></em></div>
        <div class="wm-lab"><span><b>You: ${c.matchPercent}%</b></span><span>Bar: ${c.passMark}%</span>${c.fix ? `<span class="good-t">After ${c.fix.hours}h of learning: ${c.fix.newPercent}%</span>` : ''}</div></div>
      ${c.worked.length ? `<div class="why-sec"><span class="st-k">What counted for you</span><div class="row">${c.worked.map((s) => `<span class="chip good">✓ ${esc(label(s))}</span>`).join('')}</div></div>` : ''}
      ${c.missing.length ? `<div class="why-sec"><span class="st-k">${c.skillsPass ? 'Nice to have' : 'What held you back'}</span><div class="row">${c.missing.map((s) => `<span class="chip ${s.importance === 'required' ? 'bad' : 'warn'}">✗ ${esc(label(s.skill))} · ${esc(s.importance)}</span>`).join('')}</div></div>` : ''}
      ${c.fit.map((f) => `<div class="barrier"><span class="st warn">Job fit</span> ${esc(f)}</div>`).join('')}
      ${c.barriers.map((b) => `<div class="barrier"><span class="st no">Unfair filter</span> ${esc(b)} <span class="st ok">not about your ability</span></div>`).join('')}
      ${c.audit ? `<p class="fine" style="margin:4px 0 0">On this job, a résumé filter drops <b>${c.audit.rejected} of ${c.audit.qualified}</b> qualified applicants and fails the four-fifths rule for ${c.audit.failing} of ${c.audit.groups} groups.</p>` : ''}
      ${c.flagged ? `<div class="barrier"><span class="st ok">Flagged</span> Sent to your counsellor to ask ${esc(c.role.company)} for a skills-based review.</div>` : ''}
      ${c.fix ? `<div class="why-sec"><span class="st-k">What would change the answer</span>${c.fix.skills.map((s) => `<div class="why-fix"><span class="chip on sm">+ ${esc(label(s.skill))}</span>${s.course ? `<span>${esc(s.course.title)} <span class="muted">· ${esc(s.course.provider)} · ${esc(s.course.duration)}</span></span>` : '<span class="muted">no course yet</span>'}</div>`).join('')}</div>` : ''}
      <p class="fine">Every reason above is computed from your skills and the job’s requirements, not guessed by AI. The bar is the ${c.passMark}% skills match SkillSetu uses to shortlist.</p></div>`;
  }

  if (c.type === 'shield') {
    const moves = (list, title, inside) => list.length ? `<div class="why-sec"><span class="st-k">${title}</span>${list.map((r, i) => `<div class="mrole reveal" style="--i:${i}">${ring(r.matchPercent, 52)}
        <div class="mr-body"><b>${esc(r.title)}</b><div class="meta">${esc(r.company)} · ${esc(r.salary)}</div>
          <div class="row">${risk(r.risk)}${r.missing.length ? r.missing.map((m) => `<span class="chip warn">+ ${esc(label(m))}</span>`).join('') + `<span class="pill">~${r.hours}h to learn</span>` : '<span class="pill good">Ready now</span>'}</div></div>
        <div class="mr-acts">${r.missing.length ? `<button class="btn btn-ghost btn-sm" data-intent="pathway" data-role-id="${esc(r.ID)}" data-label="Plan for ${esc(r.title)}">Plan →</button>` : `<button class="btn btn-ghost btn-sm" data-intent="human" data-role-id="${esc(r.ID)}" data-label="Ask a counsellor ${inside ? 'about moving' : 'for an intro'} to ${esc(r.title)}">${inside ? 'Move →' : 'Intro →'}</button>`}</div></div>`).join('')}</div>` : '';
    return `<div class="card-in shield-card">
      <div class="row between"><b class="sc-title">${ic('radar')} Job risk radar</b>${risk(c.job.risk)}</div>
      <div class="sh-job"><span class="st-k">Your job now</span><b>${esc(c.job.title)}</b><span class="meta">${esc(c.job.company || 'Employer not given')} · ${esc(c.job.salary)}</span></div>
      <div class="sh-split"><div><span class="st-k">Tasks AI already does well</span><div class="row">${c.exposed.map((s) => `<span class="chip bad">${esc(label(s))}</span>`).join('') || '<span class="muted">none</span>'}</div></div>
        <div><span class="st-k">Tasks that need a person</span><div class="row">${c.human.map((s) => `<span class="chip good">${esc(label(s))}</span>`).join('') || '<span class="muted">none</span>'}</div></div></div>
      ${c.carry.length ? `<div class="why-sec"><span class="st-k">Your skills AI can’t easily replace</span><div class="row">${c.carry.map((s) => `<span class="chip on sm">${esc(label(s))}</span>`).join('')}</div></div>` : ''}
      ${moves(c.internal, `Safer roles inside ${esc(c.job.company || 'your company')}`, true)}${moves(c.external, c.internal.length ? 'Safer roles elsewhere' : 'Safer roles', false)}${moves(c.sap || [], 'Open now in SAP SuccessFactors', false)}
      ${!c.internal.length && !c.external.length ? '<div class="barrier"><span class="st ok">✓</span> No safer role beats your current one right now.</div>' : ''}
      <div class="watch-note">${ic('eye')} <span><b>Watching your job.</b> If its risk rises or a better role opens, you’ll hear from me. Your employer never sees that you asked.</span></div>
      <p class="fine">Automation risk and task exposure are illustrative demo values.</p></div>`;
  }

  if (c.type === 'growth') return `<div class="card-in growth-card">
      <div class="row between"><b class="sc-title">${ic('sprout')} After-hire companion</b><span class="badge">Hired ${esc(c.hiredAt)}</span></div>
      <div class="sh-job"><span class="st-k">Your job</span><b>${esc(c.job.title)}</b><span class="meta">${esc(c.job.company)} · ${esc(c.job.salary)}</span></div>
      <div class="why-sec"><span class="st-k">Check-ins</span><div class="checkins">${c.checkins.map((k) => `<div class="ci ${k.done ? 'done' : ''}"><b>Day ${k.day}</b><span>${esc(k.text)}</span><span class="meta">${k.done ? '✓ done' : esc(k.due)}</span></div>`).join('')}</div></div>
      ${c.next.length ? `<div class="why-sec"><span class="st-k">Your next step up</span>${c.next.map((r, i) => `<div class="mrole reveal" style="--i:${i}">${ring(r.matchPercent, 52)}
        <div class="mr-body"><b>${esc(r.title)}</b><div class="meta">${esc(r.company)}${r.sameCompany ? ' (same company)' : ''} · ${esc(r.salary)}</div>
          <div class="row">${risk(r.risk)}${r.missing.map((m) => `<span class="chip warn">+ ${esc(label(m))}</span>`).join('')}${r.missing.length ? `<span class="pill">~${r.hours}h</span>` : '<span class="pill good">Ready now</span>'}</div></div>
        <div class="mr-acts"><button class="btn btn-ghost btn-sm" data-intent="pathway" data-role-id="${esc(r.ID)}" data-label="Plan for ${esc(r.title)}">Plan →</button></div></div>`).join('')}</div>` : ''}
      <div class="watch-note">${ic('chat')} <span>Check-ins and better-match alerts come here and, if you opt in, by email or WhatsApp. <b>Demo:</b> emails go to the counsellor’s outbox, nothing is sent.</span></div></div>`;

  if (c.type === 'alert') return `<div class="card-in alert-card"><div class="row between"><span class="pill ${c.kind === 'risk' ? 'bad' : c.kind === 'match' || c.kind === 'newjob' ? 'good' : ''}">${{ match: 'Better match', risk: 'Job risk', checkin: 'Check-in', newjob: 'New job for you' }[c.kind] || 'Alert'}</span><span class="meta">${esc(c.on || '')}</span></div>
      <b style="display:block;margin-top:6px">${esc(c.subject)}</b>
      ${c.roleID ? `<div class="row" style="margin-top:8px"><button class="btn btn-ghost btn-sm" data-intent="pathway" data-role-id="${esc(c.roleID)}" data-label="Plan for this role">Plan →</button><button class="link-btn" data-intent="explain" data-role-id="${esc(c.roleID)}" data-label="What’s missing for this role?">What’s missing?</button></div>` : ''}
      <p class="fine" style="margin:6px 0 0">Also emailed (demo: not sent).</p></div>`;

  if (c.type === 'courseRec') return `<div class="card-in"><div class="course">
      <div class="thumb" style="background:${PROVIDER_COLORS[c.course.provider] || 'var(--sapAvatar_10_Background)'}">${initials(c.course.provider || '?')}</div>
      <div style="flex:1"><h4>${esc(c.course.title)}</h4><div class="meta"><span>${esc(c.course.provider)}</span><span>${esc(c.course.duration)}</span>${c.course.skill ? `<span>Closes: ${esc(label(c.course.skill))}</span>` : ''}</div></div></div>
      ${c.note ? `<div class="barrier"><span class="st ok">${esc(c.by || 'Counsellor')}</span> ${esc(c.note)}</div>` : ''}
      <div class="row" style="margin-top:8px"><a class="btn btn-primary btn-sm" href="#/my-courses">Accept in My assigned courses →</a></div></div>`;

  // Company Connect: the work profile read over the Company MCP, and the open roles inside the company.
  if (c.type === 'company') return `<div class="card-in company-card">
      <div class="row between"><b class="sc-title">${ic('company-view')} ${esc(c.company)} · work profile</b><span class="badge">via Company MCP</span></div>
      <p class="sc-intro">${esc(c.profile.title)} · ${esc(c.profile.department || '')} · ${c.profile.years ?? '?'} years${c.added?.length ? ` · added ${c.added.map((x) => esc(label(x))).join(', ')}` : ''}</p>
      ${c.profile.projects?.length ? `<div class="sk-list">${c.profile.projects.map((p) => `<details class="sk-row"><summary><b>${esc(p.name)}</b></summary><div class="sk-more">${esc(p.detail || '')}</div></details>`).join('')}</div>` : ''}
      ${c.tracks?.length ? `<span class="st-k" style="display:block;margin-top:12px">Open roles inside ${esc(c.company)}</span>
        ${c.tracks.map((t, i) => `<div class="mrole reveal" style="--i:${i}">${ring(t.matchPercent, 52)}
          <div class="mr-body"><b>${esc(t.title)}</b><div class="meta">${[t.department, t.location, `${t.openings} opening${t.openings === 1 ? '' : 's'}`].filter(Boolean).map(esc).join(' · ')}</div>
            <div class="row" style="margin-top:6px">${t.matched.map((x) => `<span class="chip good">✓ ${esc(label(x))}</span>`).join('')}${t.missing.map((x) => `<span class="chip warn">+ ${esc(label(x))}</span>`).join('')}${t.missing.length ? `<span class="pill">~${t.hours}h to learn</span>` : '<span class="pill good">Ready now</span>'}</div></div>
          <div class="mr-acts">${t.missing.length ? `<button class="btn btn-ghost btn-sm" data-intent="pathway" data-role-id="${esc(t.ID)}" data-label="Plan for ${esc(t.title)}">Plan →</button>` : ''}
            <button class="link-btn" data-intent="human" data-role-id="${esc(t.ID)}" data-label="Ask a counsellor about moving to ${esc(t.title)}">Ask a counsellor</button></div></div>`).join('')}` : ''}
      <p class="fine">Read with your OK from ${esc(c.company)}'s data over the Company MCP. Your employer isn't told that you looked.</p></div>`;

  // Web Research: the pages the answer came from, so every fact can be checked.
  if (c.type === 'web') return `<div class="card-in web-card"><span class="st-k">Sources</span>
      <ol class="web-src">${c.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a> <small>${esc(x.site || '')}</small></li>`).join('')}</ol>
      <p class="fine">Live web results via ${esc(c.provider || 'web search')}. Check the source before you rely on it.</p></div>`;

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
  if (!c) { el.innerHTML = `<h4>Case file</h4><p class="muted" style="font-size:14px;margin:0">Starts with your first message. Every agent reads it, updates it and adds a status here.</p>`; return; }
  const p = c.profile || {}, private_ = [p.age && `Age ${p.age}`, p.gapYears && `${p.gapYears}-year gap`, p.education && `Education: ${p.education}`, p.pastTitle && `Past title: ${p.pastTitle}`, p.needsAccommodation && 'Needs accessibility'].filter(Boolean);
  const v = visitedAgents();
  const tags = [['Name hidden', 'Information', 'private'], ...Object.keys(STAMPS).filter((k) => v.has(k)).map((k) => [STAMPS[k][0], 'Positive', 'accept'])];
  if (c.status === 'approved') tags.push(['Counsellor approved', 'Positive', 'employee-approvals']);
  else if (c.status === 'sent') tags.push(['With counsellor', 'Critical', 'history']);
  else if (c.status === 'changes') tags.push(['Changes requested', 'Negative', 'warning']);
  el.innerHTML = `<div class="obj-head"><ui5-avatar size="S" icon="person-placeholder" color-scheme="Accent6"></ui5-avatar>
      <div class="obj-t"><b>Case ${esc(c.code || '')}</b><span>Name, age and college hidden from employers</span></div>
      <ui5-tag design="${c.status === 'approved' ? 'Positive' : c.status === 'changes' ? 'Negative' : c.status === 'sent' ? 'Critical' : 'Information'}">${esc(STATUS_TEXT[c.status] || c.status)}</ui5-tag></div>
    <div class="obj-tags">${tags.map(([t, d, i]) => `<ui5-tag design="${d}" class="${seenTag(c.ID, t) ? '' : 'new-tag'}"><ui5-icon slot="icon" name="${i}"></ui5-icon>${esc(t)}</ui5-tag>`).join('')}</div>
    <div class="kv"><span>Skills</span><div class="row">${c.skills.length ? c.skills.map((s) => `<span class="chip on sm">${esc(label(s.skill))}</span>`).join('') : '<span class="muted">none yet</span>'}</div></div>
    ${p.forces ? `<div class="kv"><span>${ic('medal', 14)} Service</span><b>${esc([p.forces.service, p.forces.rank, p.forces.years && p.forces.years + ' yrs'].filter(Boolean).join(' · ') || 'Ex-serviceman')}</b></div>` : ''}
    ${c.job ? `<div class="kv"><span>${ic('briefcase', 14)} Job now</span><b>${esc(c.job.title)}${c.job.company ? ' · ' + esc(c.job.company) : ''}</b></div>` : ''}
    ${c.watch?.on ? `<div class="kv"><span>${ic('eye', 14)} Watch</span><b>${c.watch.hiredAt ? 'After-hire, since ' + esc(c.watch.hiredAt) : 'Job risk, on'}${c.watch.alerts ? ` · ${plural(c.watch.alerts, 'alert')}` : ''}</b></div>` : ''}
    <div class="kv"><span>Target role</span><b>${esc(c.targetRole || '—')}</b></div>
    <div class="kv"><span>Plan</span><b>${c.plan ? planText(c.plan) : '—'}</b></div>
    <div class="kv"><span>Wants</span><b>${esc([c.prefs?.type && label(c.prefs.type), c.prefs?.remote && c.prefs?.type !== 'remote' && 'Remote', c.prefs?.location].filter(Boolean).join(' · ') || '—')}</b></div>
    ${private_.length ? `<div class="kv"><span>${ic('lock', 14)} Private</span><div><div class="row">${private_.map((x) => `<span class="chip sm">${esc(x)}</span>`).join('')}</div>
      <div class="fine" style="margin-top:4px">Used only to check for bias. Never shown to employers.</div></div></div>` : ''}
    <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="link-btn" id="newChat2">New chat</button></div>`;
}

function drawTrace() {
  const el = document.getElementById('traceCard');
  if (!el) return;
  if (!el.classList.contains('on') && chat.trace.length) document.querySelector('.side-tabs [data-side="traceCard"]')?.classList.add('dot');
  el.innerHTML = `<div class="row between"><h4>Agent trace</h4><span class="muted" style="font-size:12px">why the AI did what it did</span></div>
    <div class="trace">${chat.trace.length ? chat.trace.map((t) => t.turn !== undefined
      ? `<div class="tr-turn">“${esc(String(t.turn).slice(0, 60))}${String(t.turn).length > 60 ? '…' : ''}”</div>`
      : `<div class="tr" style="--ag:${agentColor(t.agent)}"><div class="tr-h"><span>${(AGENT_META[t.agent] || {}).icon || ''} ${esc(t.name || t.agent)}</span>
          ${t.routedBy && t.routedBy !== '-' ? `<span class="pill">${esc(ROUTE_TEXT[t.routedBy] || t.routedBy)}</span>` : ''}</div>
          <div class="tr-r">${t.to ? '→ ' + esc(t.to.join(' + ')) + ' · ' : ''}${esc(t.reason || '')}</div>
          <div class="tr-m">${t.provider === 'rules' ? 'Code, no AI' : t.provider === 'person' ? 'A person' : esc(t.provider) + (t.model ? ' · ' + esc(prettyModel(t.model)) : '')}${t.ms ? ` · ${t.ms} ms` : ''}</div>
          ${t.aiError ? `<div class="tr-m ai-down">AI unavailable: ${esc(t.aiError)}. Used rules instead.</div>` : ''}</div>`).join('')
      : '<p class="muted" style="font-size:14px;margin:0">Each routing decision and agent run shows up here.</p>'}</div>`;
}

/* ---------- Counsellor view (Human-in-the-Loop) ---------- */
const desk = { cases: [], id: null, view: null };

/* ---------- Bias audit (counsellors and employers): four-fifths rule on a job's screening ---------- */
const audit = { roleID: null, roles: [] };
async function biasAuditPage() {
  view.innerHTML = `<div class="page"><div class="container">
    <div class="page-head"><h1>Bias audit</h1>
      <p>For counsellors and employers: would this job's screening treat groups fairly? SkillSetu compares a typical résumé filter with skills-first screening on a test pool of 140 candidates, using the four-fifths rule: every group's selection rate must be at least 80% of the best group's.</p></div>
    <div class="side-card"><label class="ba-pick"><b>Job</b><select id="baRole"></select></label><div id="baBody"><div class="skeleton" style="height:240px"></div></div></div>
  </div></div>`;
  try { if (!audit.roles.length) audit.roles = (await get('Roles?$orderby=title&$select=ID,title,company,type')).filter((r) => r.type !== 'internal' && !String(r.ID).startsWith('5a900000-5a90-')); }
  catch (e) { document.getElementById('baBody').innerHTML = '<div class="empty">Could not load the jobs just now.</div>'; return; }
  audit.roleID = audit.roleID || audit.roles[0]?.ID;
  const sel = document.getElementById('baRole');
  sel.innerHTML = audit.roles.map((r) => `<option value="${esc(r.ID)}" ${r.ID === audit.roleID ? 'selected' : ''}>${esc(r.title)} · ${esc(r.company)}</option>`).join('');
  sel.addEventListener('change', () => { audit.roleID = sel.value; drawAudit(); });
  drawAudit();
}
async function drawAudit() {
  const el = document.getElementById('baBody');
  el.innerHTML = '<div class="skeleton" style="height:240px"></div>';
  let a;
  try { a = JSON.parse((await (await fetch(`/api/biasAudit(roleID='${encodeURIComponent(audit.roleID)}')`)).json()).value); }
  catch (e) { el.innerHTML = '<div class="empty">Could not run the audit just now.</div>'; return; }
  const s = a.summary, pct = (x) => `${Math.round(x * 100)}%`;
  const cell = (m) => `<td>${pct(m.rate)} <span class="muted">(${m.selected} people)</span></td><td><span class="pill ${m.pass ? 'good' : 'bad'}">${m.air === null ? '–' : m.air.toFixed(2)} ${m.pass ? 'pass' : 'fail'}</span></td>`;
  el.innerHTML = `
    <div class="ov-kpis" style="grid-template-columns:repeat(4,1fr);margin-top:14px">
      <div class="ov-kpi warn"><b>${s.resumeFilterFailingGroups}/${a.groups.length}</b><span>groups fail with a résumé filter</span></div>
      <div class="ov-kpi good"><b>${s.skillsFirstFailingGroups}/${a.groups.length}</b><span>groups fail with skills-first</span></div>
      <div class="ov-kpi"><b>${s.qualifiedRejectedByResumeFilter}/${s.qualified}</b><span>qualified people a résumé filter drops</span></div>
      <div class="ov-kpi"><b>${a.requiredSkills.length}</b><span>skills this job needs: ${esc(a.requiredSkills.map(label).join(', '))}</span></div></div>
    <div class="table-wrap"><table class="ba-table"><thead><tr><th>Group</th><th>People</th><th>Résumé filter: selected</th><th>Ratio vs best</th><th>Skills-first: selected</th><th>Ratio vs best</th></tr></thead>
      <tbody>${a.groups.map((g) => `<tr><td><b>${esc(g.label)}</b></td><td>${g.n}</td>${cell(g.resumeFilter)}${cell(g.skillsFirst)}</tr>`).join('')}</tbody></table></div>
    <h4 style="margin-top:18px">Skills-first shortlist (anonymous)</h4>
    <div class="cp-table">${a.shortlist.map((c) => `<div class="cp-row"><b>${esc(c.alias)}</b><span>${c.match}% skills match</span>
      <span>${c.wouldBeRejectedFor.length ? `A résumé filter would reject for: ${esc(c.wouldBeRejectedFor.join(', '))}` : 'Passes a résumé filter too'}</span><span></span></div>`).join('') || '<p class="muted">No one in the test pool clears the skills bar for this job.</p>'}</div>
    <p class="fine">Ratio = the group's selection rate ÷ the best group's rate; below 0.8 fails the four-fifths rule (US EEOC). Test pool of 140 synthetic candidates in ${a.groups.length} groups.</p>`;
}

/* ---------- Company portal: a partner company's data, served to the agents by the Company MCP ---------- */
const portal = { companies: [], id: null, skills: [] };
const odata = async (path, opt = {}) => {
  const res = await fetch('/company-admin/' + path, { ...opt, headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error?.message || `HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
};
async function companyPortal() {
  view.innerHTML = `<div class="page"><div class="container">
    <div class="page-head"><h1>Company data</h1>
      <p>Partner companies share their open roles and employee profiles here. SkillSetu's agents read them through the <b>Company MCP</b>, and only after the employee agrees to connect.</p></div>
    <div class="cp-grid"><section class="side-card" id="cpList"></section><section id="cpDetail"></section></div>
    <div class="side-card cp-mcp"><b>${ic('chain-link')} Company MCP</b>
      <span>Endpoint <code>POST /company-mcp</code> (header <code>x-api-key</code>) · tools <code>find_company_by_email</code>, <code>get_employee_profile</code>, <code>list_open_postings</code></span></div>
  </div></div>`;
  try {
    const [c, sk] = await Promise.all([odata('Companies?$orderby=name'), portal.skills.length ? null : get('Skills?$orderby=name')]);
    portal.companies = c.value; if (sk) portal.skills = sk.map((x) => x.name);
  } catch (e) { document.getElementById('cpList').innerHTML = `<div class="empty">Could not load company data: ${esc(e.message)}</div>`; return; }
  if (!portal.companies.some((x) => x.ID === portal.id)) portal.id = portal.companies[0]?.ID || null;
  drawCompanies();
}
function drawCompanies() {
  const el = document.getElementById('cpList');
  el.innerHTML = `<h4>Companies (${portal.companies.length})</h4>
    ${portal.companies.map((c) => `<button class="case-row ${c.ID === portal.id ? 'on' : ''}" data-cp="${esc(c.ID)}"><b>${esc(c.name)}<small>@${esc(c.domain)}</small></b></button>`).join('')}
    <form class="cp-form" id="cpNewCo"><span class="st-k">Add a company</span>
      <input name="name" placeholder="Company name" required><input name="domain" placeholder="Email domain, e.g. acme.in" required>
      <input name="about" placeholder="What the company does (optional)"><button class="btn btn-primary btn-sm">Add company</button></form>`;
  el.querySelectorAll('[data-cp]').forEach((b) => b.addEventListener('click', () => { portal.id = b.dataset.cp; drawCompanies(); }));
  el.querySelector('#cpNewCo').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    try { const c = await odata('Companies', { method: 'POST', body: JSON.stringify(f) }); portal.id = c.ID; toast(`${c.name} added`); companyPortal(); } catch (err) { toast('Could not add: ' + err.message); }
  });
  drawCompany();
}
const skillBoxes = (name) => `<div class="cp-skills">${portal.skills.map((s) => `<label><input type="checkbox" name="${name}" value="${esc(s)}"> ${esc(label(s))}</label>`).join('')}</div>`;
async function drawCompany() {
  const el = document.getElementById('cpDetail');
  const c = portal.companies.find((x) => x.ID === portal.id);
  if (!c) { el.innerHTML = '<div class="side-card empty">Add a company to start.</div>'; return; }
  el.innerHTML = '<div class="side-card"><div class="skeleton" style="height:200px"></div></div>';
  const [po, em] = await Promise.all([odata(`Postings?$filter=company_ID eq ${c.ID}&$orderby=title`), odata(`Employees?$filter=company_ID eq ${c.ID}&$orderby=name`)]);
  const del = (kind, id, what) => `<button class="link-btn" data-del="${kind}" data-id="${esc(id)}" title="Delete ${esc(what)}">Delete</button>`;
  el.innerHTML = `<div class="side-card">
    <div class="row between"><h4 style="margin:0">${esc(c.name)} <span class="muted" style="font-weight:400">@${esc(c.domain)}</span></h4>${del('Companies', c.ID, c.name)}</div>
    ${c.about ? `<p class="muted" style="margin:6px 0 0">${esc(c.about)}</p>` : ''}
    <h4 style="margin-top:18px">Employees (${em.value.length})</h4>
    <div class="sk-list">${em.value.map((x) => `<details class="sk-row emp-row"><summary><b>${esc(x.name)}</b><span class="muted">${esc(x.title || '')}${x.department ? ` · ${esc(x.department)}` : ''}${x.years != null ? ` · ${x.years} yrs` : ''}</span><span class="muted">${esc(x.email)}</span></summary>
      <div class="sk-more"><div class="row">${String(x.skills || '').split(',').filter((k) => k.trim()).map((k) => `<span class="chip on sm">${esc(label(k.trim()))}</span>`).join('') || '<span class="muted">No skills listed</span>'}</div>
        <span class="st-k">Projects</span><ul class="emp-proj">${String(x.projects || '').split('\n').filter(Boolean).map((p) => `<li>${esc(p)}</li>`).join('') || '<li class="muted">No projects listed</li>'}</ul>
        <div>${del('Employees', x.ID, x.name)}</div></div></details>`).join('') || '<p class="muted">No employees yet.</p>'}</div>
    <details class="cp-add"><summary class="btn btn-ghost btn-sm">+ Add an employee</summary>
      <form class="cp-form" id="cpNewEm"><input name="name" placeholder="Full name" required><input name="email" type="email" placeholder="Work email @${esc(c.domain)}" required>
        <input name="title" placeholder="Current role"><input name="department" placeholder="Department"><input name="years" type="number" min="0" placeholder="Years at the company">
        <span class="st-k">Skills</span>${skillBoxes('skills')}
        <textarea name="projects" rows="4" placeholder="Projects, one per line: Project name: what they did"></textarea><button class="btn btn-primary btn-sm">Save employee</button></form></details>
    <h4 style="margin-top:18px">Open postings (${po.value.length})</h4>
    <div class="cp-table">${po.value.map((p) => `<div class="cp-row"><b>${esc(p.title)}</b><span>${esc([p.department, p.location, `${p.openings} opening(s)`].filter(Boolean).join(' · '))}</span>
      <span class="row">${String(p.skills || '').split(',').filter((x) => x.trim()).map((x) => `<span class="chip on sm">${esc(label(x.trim()))}</span>`).join('')}</span>${del('Postings', p.ID, p.title)}</div>`).join('') || '<p class="muted">No postings yet.</p>'}</div>
    <details class="cp-add"><summary class="btn btn-ghost btn-sm">+ Add a posting</summary>
      <form class="cp-form" id="cpNewPo"><input name="title" placeholder="Job title" required><input name="department" placeholder="Department"><input name="location" placeholder="Location">
        <input name="openings" type="number" min="1" value="1"><textarea name="description" rows="2" placeholder="What the job involves"></textarea>
        <span class="st-k">Skills it needs</span>${skillBoxes('skills')}<button class="btn btn-primary btn-sm">Save posting</button></form></details>
  </div>`;
  const save = (id, entity, shape) => el.querySelector(id).addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const body = { ...Object.fromEntries([...fd.entries()].filter(([k]) => k !== 'skills')), skills: fd.getAll('skills').join(', '), company_ID: c.ID };
    shape(body);
    try { await odata(entity, { method: 'POST', body: JSON.stringify(body) }); toast('Saved'); drawCompany(); } catch (err) { toast('Could not save: ' + err.message); }
  });
  save('#cpNewPo', 'Postings', (b) => { b.openings = +b.openings || 1; });
  save('#cpNewEm', 'Employees', (b) => { b.years = b.years === '' ? null : +b.years; });
  el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Delete this?')) return;
    try { await odata(`${b.dataset.del}(${b.dataset.id})`, { method: 'DELETE' }); toast('Deleted'); b.dataset.del === 'Companies' ? companyPortal() : drawCompany(); } catch (err) { toast('Could not delete: ' + err.message); }
  }));
}

/* ---------- Counsellor overview: the counsellor's home page ---------- */
async function overview() {
  const me = ssAuth.get();
  view.innerHTML = `<div class="page"><div class="container">
    <div class="page-head"><div class="row between"><h1>Good to see you, ${esc((me?.displayName || '').replace(/\s*\(.*\)$/, '') || 'counsellor')}</h1>
      <span class="signed-as">${ic('employee', 16)} Counsellor · ${esc(me?.username || '')}</span></div>
      <p>Your queue at a glance: who is waiting for a review, what you approved, and which applications went to SAP SuccessFactors.</p></div>
    <div id="ovBody"><div class="skeleton" style="height:320px"></div></div></div></div>`;
  let cases = [], pushes = [];
  try {
    [cases, pushes] = await Promise.all([
      fetch('/api/cases()').then((r) => r.json()).then((b) => JSON.parse(b.value)),
      fetch('/api/sfPushes()').then((r) => r.json()).then((b) => JSON.parse(b.value)).catch(() => [])
    ]);
  } catch (e) { document.getElementById('ovBody').innerHTML = '<div class="empty">Could not load your cases. Try again in a moment.</div>'; return; }
  const n = (st) => cases.filter((c) => c.status === st).length;
  const sent = pushes.filter((p) => p.status === 'sent');
  const waiting = cases.filter((c) => c.status === 'sent' || c.status === 'changes');
  const byId = Object.fromEntries(cases.map((c) => [c.ID, c]));
  const when = (d) => (d ? new Date(d).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  document.getElementById('ovBody').innerHTML = `
    <div class="ov-kpis">
      ${[[n('sent'), 'Waiting for your review', 'warn', '#/counsellor'], [n('changes'), 'Changes requested', '', '#/counsellor'], [n('approved'), 'Approved', 'good', '#/counsellor'],
        [sent.length, 'Sent to SAP SuccessFactors', 'sap', '#/counsellor'], [cases.length, 'All cases', '', '#/counsellor']]
        .map(([v, l, k, h]) => `<button class="ov-kpi ${k}" data-href="${h}"><b>${v}</b><span>${l}</span></button>`).join('')}
    </div>
    <div class="ov-grid">
      <section class="side-card"><div class="row between"><h4>Needs your review</h4><a class="link-btn" href="#/counsellor">Open review queue →</a></div>
        ${waiting.length ? waiting.slice(0, 8).map((c) => `<button class="case-row" data-open-case="${esc(c.ID)}"><b>${esc(c.name || 'Guest')}<small>${esc(c.code)}</small></b>
          <span class="pill ${c.status === 'sent' ? 'warn' : ''}">${esc(STATUS_TEXT[c.status] || c.status)}</span>
          <span class="muted">${c.skills} skills${c.role ? ' · ' + esc(c.role) : ''} · ${when(c.modifiedAt)}</span></button>`).join('')
          : '<div class="empty" style="padding:18px">Nothing waiting. New cases appear here when a job seeker asks for a review.</div>'}
      </section>
      <section class="side-card"><div class="row between"><h4>Sent to SAP SuccessFactors</h4><span class="badge">SAP SuccessFactors</span></div>
        ${pushes.length ? pushes.slice(0, 8).map((p) => `<div class="ov-push"><span class="pill ${p.status === 'sent' ? 'good' : 'bad'}">${p.status === 'sent' ? 'Sent' : 'Failed'}</span>
          <span><b>${esc(byId[p.caseFile_ID]?.code || p.candidateId || '')}</b> · ${esc(p.message || '')}<br><small class="muted">Req ${esc(p.jobReqId || '')} · ${esc(p.applicationId || '')} · ${when(p.createdAt)}</small></span></div>`).join('')
          : '<div class="empty" style="padding:18px">No applications yet. Approve a case, then use “Send to SuccessFactors” in the review queue.</div>'}
      </section>
    </div>
    <div class="ov-links">
      <button class="ov-link" data-href="#/counsellor">${ic('employee-approvals', 20)}<b>Review queue</b><span>Skills with evidence, plan, fairness check, AI trace</span></button>
      <button class="ov-link" data-href="counsellor-fe/index.html">${ic('sap-box', 20)}<b>Counsellor Review (SAP Fiori app)</b><span>The same cases as a Fiori Elements list report and object page</span></button>
      <button class="ov-link" data-href="#/impact">${ic('chart', 20)}<b>Impact</b><span>People helped and fairness, district by district</span></button>
      <button class="ov-link" data-href="#/jobs">${ic('suitcase', 20)}<b>Jobs</b><span>The role catalog, including open SAP jobs</span></button>
    </div>`;
}

async function counsellor() {
  view.innerHTML = `<div class="page"><div class="container">
    <div class="page-head"><div class="row between"><h1>Counsellor desk</h1><a class="link-btn" href="counsellor-fe/index.html">Open in the SAP Fiori app →</a><span class="signed-as">${ic('employee', 16)} ${esc(ssAuth.get()?.displayName || '')} · ${esc(ssAuth.get()?.username || '')}</span></div>
      <p>A person reviews every plan before anything reaches an employer. You see the skills with evidence, the plan, the fairness check and every AI decision.</p></div>
    <div class="desk"><div class="side-card" id="caseList"><div class="skeleton" style="height:200px"></div></div><div id="caseDetail"></div></div>
  </div></div>`;
  try {
    desk.cases = JSON.parse((await (await fetch('/api/cases()')).json()).value);
  } catch (e) {
    document.getElementById('caseList').innerHTML = '<div class="empty">Could not load the cases just now. Please try again in a moment.</div>'; return;
  }
  const order = { sent: 0, changes: 1, active: 2, approved: 3 };
  desk.cases.sort((a, b) => order[a.status] - order[b.status]);
  desk.id = desk.id && desk.cases.some((c) => c.ID === desk.id) ? desk.id : desk.cases[0]?.ID;
  drawDeskList();
  if (desk.id) openCase(desk.id);
  else document.getElementById('caseDetail').innerHTML = '<div class="side-card empty">No cases yet. They appear here when a job seeker starts a chat.</div>';
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
      ${p.forces ? `<p style="margin:12px 0 0"><b>Ex-serviceman</b>: ${esc([p.forces.service, p.forces.rank, p.forces.years && p.forces.years + ' years'].filter(Boolean).join(', '))}. Skills below are translated from rank and trade.</p>` : ''}
      ${flags.map((f) => `<div class="barrier" style="margin-top:12px"><span class="st no">Possible unfair rejection</span> ${esc(f.role.title)} at ${esc(f.role.company)}: ${f.matchPercent}% skills match, but a résumé filter would reject for ${esc(f.barriers.join(', '))}. Ask the employer for a skills-based review.</div>`).join('')}
      ${c.job ? `<p style="margin:12px 0 0"><b>Works now as</b> ${esc(c.job.title)}${c.job.company ? ' at ' + esc(c.job.company) : ''}.${c.watch?.on ? ' The watch is on.' : ''}</p>` : ''}
      <h4 style="margin-top:18px">Skills and evidence</h4>
      <div class="evidence">${c.skills.map((s) => `<div class="ev"><span class="chip on">${esc(label(s.skill))}</span><span class="why">${s.reason ? '“' + esc(s.reason) + '”' : ''}</span><span class="badge">${s.by === 'ai' ? 'AI' : s.by === 'service' ? 'service record' : 'keywords'}</span></div>`).join('') || '<span class="muted">None yet</span>'}</div>
      <h4>Plan</h4>${c.plan ? `<p style="margin:0 0 6px"><b>${esc(c.plan.roleTitle)}</b> · ${c.plan.matchToday}% match today · ${plural(c.plan.steps.length, 'course')} · ${c.plan.totalHours}h (~${plural(c.plan.weeks, 'week')})</p>
        <ul class="plain">${c.plan.steps.map((s) => `<li>${esc(s.course.title)} <span class="muted">(${esc(s.course.provider)}, ${esc(s.course.duration)}) closes ${esc(label(s.skill))}</span></li>`).join('')}</ul>` : '<p class="muted">No plan yet.</p>'}
      <h4>Courses for this person</h4><div id="recBox"><div class="skeleton" style="height:60px"></div></div>
      <h4>Fairness check</h4><p style="margin:0">${(() => { const b = readiness ? readiness.barriers : c.barriers || []; return b.length ? `A résumé filter would reject this person for: <b>${esc(b.join(', '))}</b>. SkillSetu ignores these.` : 'No filter barriers found.'; })()}
        ${[p.age && 'age ' + p.age, p.gapYears && p.gapYears + '-year gap', p.needsAccommodation && 'needs accessibility'].filter(Boolean).length ? `<br><span class="fine">Private facts on file: ${esc([p.age && 'age ' + p.age, p.gapYears && p.gapYears + '-year gap', p.needsAccommodation && 'needs accessibility'].filter(Boolean).join(', '))}</span>` : ''}</p>
      <h4>Decision</h4>
      <textarea id="note" rows="2" placeholder="Note for the person (optional)">${esc(c.counsellorNote || '')}</textarea>
      <div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm" data-decide="approved" ${c.plan ? '' : 'disabled title="There is no plan to approve yet. Ask for changes, or wait for the person to pick a job."'}>✓ Approve plan</button>${c.plan ? '' : '<span class="fine">No plan yet, so there is nothing to approve.</span>'}<button class="btn btn-ghost btn-sm" data-decide="changes">Request changes</button></div>
      <h4 style="margin-top:18px">SAP SuccessFactors</h4>
      <div id="sfBox"><p class="muted" style="margin:0">${c.status === 'approved' ? 'Ready to hand over.' : 'Approve the plan first. Only approved, anonymised candidates go to SuccessFactors.'}</p></div>
      <h4 style="margin-top:18px">After the hire</h4>
      ${c.watch?.hiredAt ? `<p style="margin:0">Hired${c.job ? ` as <b>${esc(c.job.title)}</b>` : ''} on ${esc(c.watch.hiredAt)}. Check-ins at day 7, 30 and 90.</p>`
        : `<div class="row"><button class="btn btn-ghost btn-sm" id="markHired" ${c.targetRole ? '' : 'disabled title="Pick a target role first"'}>Mark as hired${c.targetRole ? ': ' + esc(c.targetRole) : ''}</button></div>`}
      <div class="row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" data-watch="0">Run the watch now</button><button class="btn btn-ghost btn-sm" data-watch="30">⏩ As if 30 days passed</button><button class="btn btn-ghost btn-sm" data-watch="95">⏩ 3 months</button></div>
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
  drawCaseCourses(id, c);
}

async function drawOutbox(id) {
  const el = document.getElementById('outboxBox');
  if (!el) return;
  let mails = [];
  try { mails = JSON.parse((await (await fetch(`/api/outbox(caseID='${encodeURIComponent(id)}')`)).json()).value); } catch (e) {}
  el.innerHTML = mails.length ? `<div class="outbox"><div class="row between"><b>${ic('chat', 16)} Outbox</b><span class="pill warn">Demo: not sent</span></div>
    ${mails.map((m) => `<details class="mail"><summary><span class="pill ${m.kind === 'risk' ? 'bad' : m.kind === 'match' ? 'good' : ''}">${esc(m.kind)}</span> ${esc(m.subject)}</summary><p>${esc(m.body)}</p><span class="meta">${esc(m.channel)} · ${esc(String(m.at || '').slice(0, 16).replace('T', ' '))}</span></details>`).join('')}</div>` : '';
}

async function runWatch(days) {
  try {
    const r = JSON.parse(await act('runWatch', { days: +days }));
    toast(r.alerts.length ? `${plural(r.alerts.length, 'alert')} for ${new Set(r.alerts.map((a) => a.code)).size} people (as of ${r.asOf})` : `Nothing new for ${r.scanned} watched ${r.scanned === 1 ? 'person' : 'people'} as of ${r.asOf}`);
    chat.messages = [];   // the person's chat reloads with the new alerts
    openCase(desk.id);
  } catch (e) { toast('The watch could not run just now. Please try again.'); }
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

/* ---------- My assigned courses ---------- */
// AI plan suggestions and counsellor recommendations; a course counts as assigned once the person accepts it.
const COURSE_STATUS = { suggested: ['Waiting for you', 'warn'], accepted: ['Assigned', 'good'], declined: ['Declined', 'bad'], done: ['Done', 'good'] };
const myCourses = { list: null };
async function loadMyCourses() {
  const ids = ssAuth.get()?.username ? [] : chatHistory.ids();
  try { myCourses.list = JSON.parse((await (await fetch(`/api/myCourses(ids='${encodeURIComponent(ids.join(','))}')`)).json()).value); }
  catch (e) { myCourses.list = null; }
  return myCourses.list;
}
function courseTabs(active) {
  if (ssAuth.get()?.role === 'counsellor') return '';
  const n = (myCourses.list || []).filter((x) => x.status === 'suggested').length;
  return `<div class="ctabs" role="tablist">
    <a href="#/courses" role="tab" class="${active === 'all' ? 'on' : ''}">${ic('course-book', 16)} All courses</a>
    <a href="#/my-courses" role="tab" class="${active === 'mine' ? 'on' : ''}">${ic('employee-approvals', 16)} My assigned courses${n ? `<span class="ctab-n" title="${plural(n, 'suggestion')} waiting for you">${n}</span>` : ''}</a></div>`;
}
const sourceText = (x) => x.source === 'counsellor' ? `${ic('human', 14)} ${esc(String(x.assignedBy || 'Counsellor').replace(/ \(.*\)$/, ''))}, your counsellor · personal recommendation` : `${ic('ai', 14)} SkillSetu AI`;
function assignedCard(x, i) {
  const c = x.course || {}, [st, tone] = COURSE_STATUS[x.status] || [x.status, ''];
  const btns = x.status === 'suggested'
    ? `<button class="btn btn-primary btn-sm" data-course-do="accept" data-id="${esc(x.ID)}">✓ Accept</button><button class="btn btn-ghost btn-sm" data-course-do="decline" data-id="${esc(x.ID)}">Not for me</button>`
    : x.status === 'accepted' ? `<a class="btn btn-primary btn-sm" href="${esc(c.url)}" target="_blank" rel="noopener">Start course →</a><button class="btn btn-ghost btn-sm" data-course-do="done" data-id="${esc(x.ID)}">Mark as done</button>`
    : x.status === 'declined' ? `<button class="btn btn-ghost btn-sm" data-course-do="accept" data-id="${esc(x.ID)}">Accept after all</button>`
    : `<a class="btn btn-ghost btn-sm" href="${esc(c.url)}" target="_blank" rel="noopener">Open again</a>`;
  return `<div class="card hover reveal assigned ${x.source}" style="--i:${i}">
    <div class="row between"><div class="course"><div class="thumb" style="background:${PROVIDER_COLORS[c.provider] || 'var(--sapAvatar_10_Background)'}">${initials(c.provider || '?')}</div></div><span class="pill ${tone}">${esc(st)}</span></div>
    <h3>${esc(c.title)}</h3><div class="muted" style="font-size:14px">${esc(c.provider)} · ${esc(c.duration)} · ${esc(c.level)}</div>
    <div class="assigned-by">${sourceText(x)}</div>
    ${x.note ? `<p class="assigned-note">${x.source === 'counsellor' ? '“' + esc(x.note) + '”' : esc(x.note)}</p>` : ''}
    ${x.skill ? `<div class="row" style="margin-top:8px"><span class="chip on">Closes: ${esc(label(x.skill))}</span></div>` : ''}
    <div class="row" style="margin-top:14px">${btns}</div></div>`;
}
async function myCoursesPage() {
  const a = ssAuth.get();
  view.innerHTML = `<div class="page"><div class="container">
    <div class="page-head"><h1>My assigned courses</h1>
      <p>Courses picked for you by the SkillSetu AI plan or by your counsellor. A course is assigned only when you accept it.</p>${courseTabs('mine')}</div>
    <div id="mineBox">${'<div class="skeleton"></div>'.repeat(3)}</div></div></div>`;
  if (!a) { document.getElementById('mineBox').innerHTML = `<div class="empty">Sign in to see the courses assigned to you. <a href="#/login">Job seeker sign-in</a></div>`; return; }
  const list = await loadMyCourses();
  const box = document.getElementById('mineBox');
  document.querySelector('.ctabs')?.replaceWith(Object.assign(document.createElement('div'), { innerHTML: courseTabs('mine') }).firstElementChild);
  if (!list) { box.innerHTML = '<div class="empty">Could not load your courses just now. Please try again in a moment.</div>'; return; }
  const by = (st) => list.filter((x) => x.status === st);
  const waiting = by('suggested'), mine = by('accepted'), done = by('done'), declined = by('declined');
  const hrs = mine.reduce((n, x) => n + hours(x.course?.duration || ''), 0);
  if (!list.length) { box.innerHTML = `<div class="empty">Nothing here yet. Tell your story in <a href="#/journey">My Journey</a> and pick a job: the AI will suggest courses, and your counsellor can add their own.</div>`; return; }
  const grid = (xs) => `<div class="grid grid-3">${xs.map(assignedCard).join('')}</div>`;
  box.innerHTML = `
    <div class="mini-stats mine-stats"><div><b>${mine.length}</b><span>assigned</span></div><div><b>${hrs}h</b><span>to learn</span></div><div><b>${done.length}</b><span>done</span></div><div><b>${waiting.length}</b><span>waiting for you</span></div></div>
    ${waiting.length ? `<h2 class="mine-h">Waiting for your OK <span class="muted">(${waiting.length})</span></h2><p class="fine">Accept a course to add it to your list. Saying no is fine: your counsellor sees it and can suggest another.</p>${grid(waiting)}` : ''}
    <h2 class="mine-h">Assigned to me <span class="muted">(${mine.length})</span></h2>
    ${mine.length ? grid(mine) : '<div class="empty" style="padding:16px">No accepted courses yet.</div>'}
    ${done.length ? `<h2 class="mine-h">Finished <span class="muted">(${done.length})</span></h2>${grid(done)}` : ''}
    ${declined.length ? `<details class="mine-declined"><summary>Declined (${declined.length})</summary>${grid(declined)}</details>` : ''}`;
}
async function respondCourse(id, decision) {
  try {
    await act('respondCourse', { id, decision });
    toast({ accept: 'Added to your assigned courses', decline: 'Removed. Your counsellor will see it.', done: 'Well done! Marked as finished.' }[decision]);
  } catch (e) { toast('Could not save that. Please try again.'); }
  myCoursesPage();
}

/* Counsellor: personal course recommendations for one case */
let courseCatalog = null;
async function drawCaseCourses(id, c) {
  const el = document.getElementById('recBox');
  if (!el) return;
  let list = [];
  try {
    const [l, cat] = await Promise.all([fetch(`/api/caseCourses(caseID='${encodeURIComponent(id)}')`).then((r) => r.json()), courseCatalog || get('Courses?$expand=skill&$orderby=title')]);
    list = JSON.parse(l.value); courseCatalog = cat;
  } catch (e) { el.innerHTML = '<p class="muted">Could not load courses.</p>'; return; }
  if (desk.id !== id) return;
  const gaps = new Set((c.plan?.steps || []).map((s) => s.skill));
  const have = new Set(list.map((x) => x.course?.ID));
  const groups = {};
  for (const k of courseCatalog) (groups[k.skill?.name || 'other'] ||= []).push(k);
  const names = Object.keys(groups).sort((a, b) => (gaps.has(b) - gaps.has(a)) || a.localeCompare(b));
  el.innerHTML = `
    ${list.length ? `<div class="rec-list">${list.map((x) => { const [st, tone] = COURSE_STATUS[x.status] || [x.status, '']; return `<div class="rec-row">
      <span class="pill ${tone}">${esc(x.status === 'suggested' ? 'Waiting for person' : st)}</span>
      <span><b>${esc(x.course?.title)}</b><span class="meta">${esc(x.course?.provider)} · ${esc(x.course?.duration)} · ${x.source === 'counsellor' ? 'by ' + esc(x.assignedBy) : 'AI plan'}${x.note && x.source === 'counsellor' ? ' · “' + esc(x.note) + '”' : ''}</span></span>
      ${x.source === 'counsellor' && x.status === 'suggested' ? `<button class="link-btn" data-withdraw="${esc(x.ID)}">Withdraw</button>` : '<span></span>'}</div>`; }).join('')}</div>`
      : '<p class="muted" style="margin:0 0 8px">No courses on this person’s list yet.</p>'}
    <div class="rec-form">
      <label class="fine" for="recCourse"><b>Add a personal course recommendation</b></label>
      <select id="recCourse"><option value="">Choose a course…</option>${names.map((n) => `<optgroup label="${esc(label(n))}${gaps.has(n) ? ' (gap in plan)' : ''}">${groups[n].map((k) => `<option value="${esc(k.ID)}" ${have.has(k.ID) ? 'disabled' : ''}>${esc(k.title)} · ${esc(k.provider)} · ${esc(k.duration)}${have.has(k.ID) ? ' (on list)' : ''}</option>`).join('')}</optgroup>`).join('')}</select>
      <textarea id="recNote" rows="2" placeholder="Why this course? The person sees your note (optional)"></textarea>
      <div class="row"><button class="btn btn-primary btn-sm" id="recSend">${ic('add', 16)} Recommend course</button><span class="fine">It appears in their chat and under My assigned courses, waiting for them to accept.</span></div>
    </div>`;
}
async function recommendCourse() {
  const courseID = document.getElementById('recCourse')?.value, note = document.getElementById('recNote')?.value || '';
  if (!courseID) { toast('Choose a course first'); return; }
  try {
    const r = JSON.parse(await act('recommendCourse', { caseID: desk.id, courseID, note }));
    toast(`Recommended: ${r.course}. The person sees it now.`);
    if (desk.id === chat.caseID) chat.messages = [];
  } catch (e) { toast('Could not send the recommendation.'); }
  openCase(desk.id);
}
async function withdrawCourse(id) {
  try { await act('withdrawCourse', { id }); toast('Recommendation withdrawn'); } catch (e) { toast('Could not withdraw it. The person may have answered already.'); }
  openCase(desk.id);
}

async function catalog(kind) {
  const isJobs = kind === 'jobs';
  view.innerHTML = `<div class="page"><div class="container">
    <div class="page-head"><h1>${isJobs ? 'Roles hiring on skills' : 'Short courses that close gaps'}</h1>
      <p>${isJobs ? 'Every role lists the skills it needs. No degree filters, no keyword games.' : 'Free and bite-sized, from SAP Learning Hub, SWAYAM and NPTEL. Learn on your phone.'}</p>
      ${isJobs ? '<div class="row" style="margin-top:12px;font-size:13px;color:var(--muted)"><span class="chip on" style="pointer-events:none">Required skill</span><span class="chip" style="pointer-events:none">Nice to have</span><span>Demand and automation risk are illustrative demo values.</span></div>' : courseTabs('all')}</div>
    <div class="row" style="margin-bottom:22px"><input type="search" id="q" placeholder="Search ${isJobs ? 'roles, companies, cities' : 'courses or skills'}…">
      <div class="row" id="filters"></div></div>
    <div class="grid grid-3" id="list">${'<div class="skeleton"></div>'.repeat(6)}</div>
  </div></div>`;

  let items;
  try {
    items = isJobs ? await get('Roles?$expand=requiredSkills($expand=skill)') : await get('Courses?$expand=skill');
    if (!isJobs && ssAuth.get() && ssAuth.get().role !== 'counsellor') loadMyCourses().then(() => { const t = document.querySelector('.ctabs'); if (t) t.outerHTML = courseTabs('all'); });
  } catch (e) {
    document.getElementById('list').innerHTML = '<div class="empty">Could not load this page just now. Please try again in a moment.</div>';
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
        <div class="tk-top"><span>${ic('suitcase', 16)} Open role</span><span class="badge type">${esc(x.type)}</span></div>
        <h3>${esc(x.title)}</h3><div class="muted" style="font-size:14px;margin-bottom:8px">${esc(x.company)} · ${esc(x.location)} · ${esc(x.salary)}</div>
        ${x.demand || x.automationRisk ? `<div class="row" style="margin-bottom:8px">${demand(x.demand)}${risk(x.automationRisk)}</div>` : ''}
        <p>${esc(String(x.description || '').slice(0, 200))}${String(x.description || '').length > 200 ? '…' : ''}</p>
        <div class="row" style="margin-top:14px">${(x.requiredSkills || []).map((rs) => `<span class="chip ${rs.importance === 'required' ? 'on' : ''}">${esc(label(rs.skill?.name))}</span>`).join('')}</div>
      </div>` : `
      <div class="card hover reveal" style="--i:${i}">
        <div class="row between"><div class="course"><div class="thumb" style="background:${PROVIDER_COLORS[x.provider] || 'var(--sapAvatar_10_Background)'}">${initials(x.provider)}</div></div><span class="badge">${esc(x.level)}</span></div>
        <h3>${esc(x.title)}</h3><div class="muted" style="font-size:14px">${esc(x.provider)} · ${esc(x.duration)}</div>
        <div class="row between" style="margin-top:16px"><span class="chip on">${esc(label(x.skill?.name))}</span>
          <a class="btn btn-ghost btn-sm" href="${esc(x.url)}" target="_blank" rel="noopener">Open →</a></div>
      </div>`).join('') : '<div class="empty" style="grid-column:1/-1">Nothing matches your search.</div>';
  };
  filters.onclick = (e) => { const b = e.target.closest('[data-facet]'); if (b) { facet = b.dataset.facet; draw(); } };
  document.getElementById('q').oninput = draw;
  draw();
}

view.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-service], [data-persona], [data-story], [data-href]')) e.target.click(); });

function about() {
  return `<div class="page"><div class="container">
    <div class="page-head"><h1>How SkillSetu works</h1>
      <p>SkillSetu is one chat. Behind it, Setu, the main agent, reads every message and picks which of its 6 specialist agents and 5 tools help you next, and can chain several in one go. A real counsellor checks every plan, and every AI decision is written down so anyone can check it.</p></div>
    <div class="card setu-main reveal"><div class="icon-tile">${ic('bridge', 26)}</div>
      <div><span class="badge">Main agent · orchestrator</span><h2>Setu</h2>
      <p>Reads each message in any language, decides which specialists to run (by rules for clear requests, by an AI router for unclear ones, up to 4 in a row), passes results between them, and answers small talk itself.</p></div></div>
    <h3 class="setu-sub">6 specialist agents <small>(each uses AI or calls tools over MCP or the web)</small></h3>
    <div class="grid grid-3">${AGENTS.filter((a) => !TOOL_NAMES.has(a[1])).map(([ic, t, q, d], i) => `<div class="card hover reveal" style="--i:${i}">
      <div class="icon-tile">${ic}</div><h3>${t}</h3><p class="q">${q}</p><p>${d}</p></div>`).join('')}</div>
    <h3 class="setu-sub" style="margin-top:28px">5 tools Setu uses <small>(fixed steps in code, no AI)</small></h3>
    <div class="grid grid-3">${AGENTS.filter((a) => TOOL_NAMES.has(a[1])).map(([ic, t, q, d], i) => `<div class="card hover reveal" style="--i:${i}">
      <div class="icon-tile">${ic}</div><h3>${t}</h3><p class="q">${q}</p><p>${d}</p></div>`).join('')}</div>
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
  catch (e) { document.getElementById('impactBody').innerHTML = '<div class="empty">Could not load the impact data just now. Please try again in a moment.</div>'; return; }
  const { live, districts } = impactData;
  const T = districts.reduce((a, d) => { for (const k of ['people', 'hiddenSkills', 'approved', 'placed', 'women', 'coursesDone']) a[k] = (a[k] || 0) + d[k]; return a; }, {});
  const avg = (k) => districts.reduce((a, d) => a + +d[k], 0) / (districts.length || 1);
  const before = avg('filterAIR'), after = avg('skillsetuAIR');
  const maxPeople = Math.max(...districts.map((d) => d.people));
  document.getElementById('impactBody').innerHTML = `
    <div class="live-strip"><span class="live-dot"></span><b>Live from this system</b>
      ${[[live.cases, 'people told their story'], [live.hiddenSkills, 'skills found'], [live.sentToCounsellor, 'sent to a counsellor'], [live.approved, 'approved'], [live.pushedToSuccessFactors, 'sent to SuccessFactors']]
        .map(([n, l]) => `<span class="ls"><b>${nf(n)}</b> ${l}</span>`).join('')}</div>

    <div class="synth-note">Below: <b>synthetic pilot data</b> for 12 districts, made up to show what a funder would see. Not real results.</div>
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

    <div class="panel" style="margin-top:20px"><div class="row between"><h2 style="font-size:22px;margin:0">By district</h2><button class="btn btn-ghost btn-sm" id="impactCsv">${ic('download', 16)} Download CSV</button></div>
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

/* ---------- Sign-in: one page for job seekers, another for counsellors ---------- */
const LOGIN = {
  user: {
    title: 'Sign in to SkillSetu', sub: 'From your skills to a fair job.', userPh: 'Your username', other: ['Are you a counsellor?', '#/counsellor-login', 'Counsellor sign-in'],
    eyebrow: 'Skills-first hiring on SAP BTP',
    headline: 'Your life experience is a skill.<br>Let it get you hired.',
    lead: 'Tell SkillSetu what you have done, at home, in your community or at work. It turns your story into skills employers understand and finds jobs that fit, on skills alone.',
    perks: [
      ['discussion', 'Any language', 'English, Hindi or Hinglish. Home and unpaid work count.'],
      ['target-group', 'Skills, not filters', 'No age, career-gap or college filters.'],
      ['course-book', 'Free short courses', 'Close the gap with SAP Learning Hub, SWAYAM, NPTEL.'],
      ['private', 'Your name stays private', 'Employers see a case code, until you agree.']
    ],
    stat: ['88%', 'of qualified people are rejected by automated résumé filters. SkillSetu was built so that never happens.', 'Harvard Business School, 2021']
  },
  counsellor: {
    title: 'Counsellor workspace', sub: 'Sign in with your counsellor username. It ends in “ccp”.', userPh: 'name.ccp', other: ['Looking for a job?', '#/login', 'Job seeker sign-in'],
    eyebrow: 'SkillSetu for counsellors',
    headline: 'AI does the legwork.<br>You make the call.',
    lead: 'Every plan the agents build comes to you first: the skills with proof, the job match, the fairness check and every AI step. Nothing reaches an employer without your approval.',
    perks: [
      ['employee-approvals', 'Review in one place', 'Skills with evidence, plan and fairness check.'],
      ['decision', 'Approve or ask for changes', 'The person sees your note in their chat.'],
      ['sap-box', 'Straight to SAP SuccessFactors', 'Approved candidates, without their name.'],
      ['history', 'Fully traceable', 'Every AI step and decision is logged.']
    ],
    stat: ['0', 'candidates reach an employer without a counsellor’s approval.', 'By design']
  }
};

// The picture on the sign-in page: a still preview of what SkillSetu does. Decorative only.
function loginPicture(portal) {
  if (portal === 'counsellor') return `<div class="lp-pic" aria-hidden="true">
      <div class="lp-case"><div class="lp-case-h"><ui5-avatar size="XS" initials="P" color-scheme="Accent6"></ui5-avatar><div><b>Priya</b><small>SS-7820E5 · Operations Coordinator</small></div><span class="lp-tag warn">Waiting for review</span></div>
        <div class="lp-row"><span class="chip good">✓ Budget management</span><span class="lp-proof">“I ran the household budget for 10 years”</span></div>
        <div class="lp-row"><span class="chip good">✓ Negotiation</span><span class="lp-proof">“negotiated with vendors for school functions”</span></div>
        <div class="lp-row"><span class="lp-fair">Fairness check: a résumé filter would reject her for a 6-year gap. SkillSetu ignores it.</span></div>
        <div class="lp-acts"><span class="lp-btn primary">Approve</span><span class="lp-btn">Request changes</span><span class="lp-btn">Send to SAP SuccessFactors</span></div></div>
    </div>`;
  return `<div class="lp-pic" aria-hidden="true">
      <div class="lp-bubble"><ui5-avatar size="XS" initials="P" color-scheme="Accent6"></ui5-avatar><span>“I took 6 years off to raise my kids. I ran the household budget and organised every school event.”</span></div>
      <div class="lp-flow">${ic('arrow', 16)} SkillSetu finds</div>
      <div class="lp-chips"><span class="chip good">✓ Budget management</span><span class="chip good">✓ Event planning</span><span class="chip good">✓ Negotiation</span></div>
      <div class="lp-flow">${ic('arrow', 16)} and matches</div>
      <div class="lp-job">${ring(75, 54)}<div><b>Operations Coordinator</b><small>Bengaluru · matched on skills only</small></div><span class="lp-tag good">Low automation risk</span></div>
    </div>`;
}

const loginState = { mode: 'signin' };

// One-click demo sign-in: the job seekers start their story in My Journey, the counsellors open their overview.
const DEMO_PASS = 'skillsetu123';
const DEMO_USERS = {
  user: [
    { username: 'priya', name: 'Priya Sharma', tag: 'Back after a 6-year career break', story: () => PERSONAS[0].story },
    { username: 'vikram', name: 'Vikram Singh', tag: 'Ex-Army Havildar, 22 years', story: () => VIKRAM },
    { username: 'meena', name: 'Meena Reddy', tag: 'Customer service, job at risk from AI', story: () => MEENA }
  ],
  counsellor: [
    { username: 'meera.ccp', name: 'Meera Iyer', tag: 'Counsellor' },
    { username: 'anita.ccp', name: 'Anita Rao', tag: 'Counsellor' }
  ]
};
async function demoLogin(portal, username) {
  const d = DEMO_USERS[portal].find((x) => x.username === username);
  try {
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, secret: DEMO_PASS, portal }) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error?.message || 'Sign-in failed');
    const acc = JSON.parse(body.value);
    startSession(acc);
    toast(`Signed in as ${acc.displayName}`);
    if (acc.role === 'counsellor') { location.hash = '#/overview'; return; }
    resetChat(); chat.name = d.name.split(' ')[0];
    chat.pending = { name: chat.name, message: d.story() };
    location.hash = '#/journey';
  } catch (e) { toast('Could not sign in to the demo account just now. Please try again.'); }
}

function loginPage(portal) {
  const L = LOGIN[portal], signup = loginState.mode === 'signup', a = ssAuth.get();
  view.innerHTML = `<div class="page login-page ${portal}"><div class="login-wrap">
    <aside class="login-side">
      <div class="lp-brand"><img src="logo.svg" alt="" class="login-logo"><b>SkillSetu</b><span>${L.eyebrow}</span></div>
      <h2>${L.headline}</h2>
      <p class="lp-lead">${L.lead}</p>
      ${loginPicture(portal)}
      <ul class="lp-perks">${L.perks.map(([i, t, d]) => `<li>${ic(i, 20)}<span><b>${t}</b><small>${d}</small></span></li>`).join('')}</ul>
      <div class="lp-stat"><b>${L.stat[0]}</b><span>${L.stat[1]}<small>${L.stat[2]}</small></span></div>
    </aside>
    <section class="login-card">
      <h1>${signup ? (portal === 'counsellor' ? 'Create a counsellor account' : 'Create your account') : L.title}</h1>
      <p class="login-sub">${signup && portal === 'counsellor' ? 'Your username must end in “ccp”, for example meera.ccp.' : L.sub}</p>
      ${a?.username ? `<ui5-message-strip design="Information" hide-close-button>You are signed in as ${esc(a.displayName)} (${esc(a.username)}). Signing in here switches account.</ui5-message-strip>` : ''}
      <ui5-message-strip id="loginMsg" design="Negative" hide-close-button hidden></ui5-message-strip>
      <form id="loginForm" class="login-form" autocomplete="on">
        ${signup ? `<label><span>Full name</span><ui5-input id="lgName" placeholder="${portal === 'counsellor' ? 'e.g. Meera Iyer' : 'e.g. Priya Sharma'}"></ui5-input></label>` : ''}
        <label><span>Username</span><ui5-input id="lgUser" placeholder="${L.userPh}" autocomplete="username"></ui5-input></label>
        ${signup && portal === 'user' ? '<label><span>Work email (optional)</span><ui5-input id="lgEmail" type="Email" placeholder="you@yourcompany.com"></ui5-input><span class="fine" style="margin:0">If your employer works with SkillSetu, you can choose to connect your work profile later.</span></label>' : ''}
        <label><span>Password</span><ui5-input id="lgPass" type="Password" placeholder="${signup ? 'At least 6 characters' : 'Password'}" autocomplete="${signup ? 'new-password' : 'current-password'}"></ui5-input></label>
        ${signup ? '<label><span>Confirm password</span><ui5-input id="lgPass2" type="Password" autocomplete="new-password"></ui5-input></label>' : ''}
        <ui5-button design="Emphasized" id="lgGo" class="login-go">${signup ? 'Create account' : 'Sign in'}</ui5-button>
      </form>
      <p class="login-switch">${signup ? 'Already have an account?' : portal === 'counsellor' ? 'New counsellor?' : 'New to SkillSetu?'}
        <ui5-link id="lgMode">${signup ? 'Sign in' : 'Create an account'}</ui5-link></p>
      ${portal === 'user' && !signup ? '<div class="login-or"><span>or</span></div><ui5-button design="Transparent" id="lgGuest" class="login-go">Continue as a guest</ui5-button>' : ''}
      ${signup ? '' : `<div class="demo-box"><span class="st-k">Demo accounts · one click</span>
        <div class="demo-list">${DEMO_USERS[portal].map((d) => `<button class="demo-acc" data-demo="${d.username}" type="button">
          <ui5-avatar size="XS" initials="${esc(d.name.split(' ').map((w) => w[0]).join(''))}" color-scheme="Accent6"></ui5-avatar>
          <span><b>${esc(d.name)}</b><small>${esc(d.tag)}</small></span></button>`).join('')}</div></div>`}
      <p class="login-other">${L.other[0]} <a href="${L.other[1]}">${L.other[2]}</a></p>
    </section>
  </div></div>`;
  const go = () => submitLogin(portal);
  document.getElementById('lgGo').addEventListener('click', go);
  document.getElementById('loginForm').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  document.getElementById('lgMode').addEventListener('click', () => { loginState.mode = signup ? 'signin' : 'signup'; loginPage(portal); });
  document.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => demoLogin(portal, b.dataset.demo)));
  document.getElementById('lgGuest')?.addEventListener('click', () => { startSession({ guest: true }); location.hash = '#/'; });
  setTimeout(() => document.getElementById(signup ? 'lgName' : 'lgUser')?.focus(), 50);
  animateRings();
}

async function submitLogin(portal) {
  const v = (id) => (document.getElementById(id)?.value || '').trim();
  const msg = document.getElementById('loginMsg');
  const fail = (t) => { msg.textContent = t; msg.hidden = false; };
  const signup = loginState.mode === 'signup';
  const username = v('lgUser'), secret = document.getElementById('lgPass').value || '';
  if (!username || !secret) return fail('Enter your username and password.');
  if (signup && secret !== (document.getElementById('lgPass2').value || '')) return fail('The two passwords don’t match.');
  const btn = document.getElementById('lgGo'); btn.disabled = true;
  try {
    const res = await fetch('/api/' + (signup ? 'register' : 'login'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signup ? { username, displayName: v('lgName'), secret, portal, email: v('lgEmail') } : { username, secret, portal }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = body.error?.code;
      if (code === 'USE_COUNSELLOR_LOGIN') { toast('That is a counsellor account. Taking you to the counsellor sign-in.'); loginState.mode = 'signin'; location.hash = '#/counsellor-login'; return; }
      if (code === 'USE_USER_LOGIN') { toast('That is a job seeker account. Taking you to the job seeker sign-in.'); loginState.mode = 'signin'; location.hash = '#/login'; return; }
      return fail(body.error?.message || 'Could not sign in. Is the server running?');
    }
    const acc = JSON.parse(body.value);
    startSession(acc);
    loginState.mode = 'signin';
    toast(signup ? `Welcome, ${acc.displayName}! Your account is ready.` : `Signed in as ${acc.displayName}`);
    location.hash = acc.role === 'counsellor' ? '#/overview' : '#/';
  } catch (e) { fail('Could not reach SkillSetu just now. Please try again in a moment.'); }
  finally { btn.disabled = false; }
}

// A new person on this device: forget the previous person's chat so it can't be reopened by mistake.
function startSession(acc) {
  const prev = ssAuth.get();
  if (!prev || prev.username !== acc.username || prev.guest !== acc.guest) {
    resetChat(); chatHistory.list = [];
    try { localStorage.removeItem('ss-history'); } catch (e) {}
  }
  ssAuth.set(acc);
  if (acc.role === 'user') chat.name = acc.displayName;
  updateChrome();
}

async function signOut() {
  const a = ssAuth.get();
  try { await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } catch (e) {}
  ssAuth.clear(); resetChat(); chatHistory.list = [];
  try { localStorage.removeItem('ss-history'); } catch (e) {}
  updateChrome();
  toast('Signed out');
  location.hash = a?.role === 'counsellor' ? '#/counsellor-login' : '#/login';
}

// Header and tabs follow who is signed in: counsellors get the workspace tabs, job seekers the journey.
function updateChrome() {
  const a = ssAuth.get(), counsellor = a?.role === 'counsellor';
  // Two separate workspaces: counsellors never see the job seeker pages, and job seekers never see the desk.
  const hide = counsellor ? ['home', 'journey', 'courses', 'about'] : ['overview', 'counsellor', 'impact', 'company-portal', 'bias-audit'];
  document.querySelectorAll('#navLinks a').forEach((el) => { el.hidden = hide.includes(el.dataset.route); });
  const sb = document.getElementById('shellbar');
  if (sb) sb.setAttribute('secondary-title', counsellor ? 'Counsellor workspace' : 'Skills-first hiring on SAP BTP');
  document.body.classList.toggle('is-counsellor', counsellor);
  document.body.classList.toggle('signed-out', !a);
  const av = document.getElementById('meAvatar');
  if (av) {
    if (a?.displayName) { av.setAttribute('initials', initials(a.displayName).slice(0, 2)); av.removeAttribute('icon'); }
    else { av.removeAttribute('initials'); av.setAttribute('icon', 'person-placeholder'); }
    av.setAttribute('color-scheme', 'Accent6');
  }
}

function accountMenu() {
  let m = document.getElementById('acctMenu');
  if (m) { m.remove(); return; }
  const a = ssAuth.get();
  m = document.createElement('div'); m.id = 'acctMenu'; m.className = 'acct-menu';
  m.innerHTML = a?.username
    ? `<div class="acct-who"><b>${esc(a.displayName)}</b><span>${esc(a.username)} · ${a.role === 'counsellor' ? 'Counsellor' : 'Job seeker'}</span></div>
       <button data-acct="out">${ic('log', 16)} Sign out</button>`
    : `<div class="acct-who"><b>${a?.guest ? 'Guest' : 'Not signed in'}</b><span>${a?.guest ? 'Your chats stay on this device' : 'Sign in to keep your chats'}</span></div>
       <button data-acct="user">${ic('account', 16)} Job seeker sign-in</button><button data-acct="counsellor">${ic('employee-approvals', 16)} Counsellor sign-in</button>
       ${a?.guest ? `<button data-acct="out">${ic('log', 16)} Leave guest mode</button>` : ''}`;
  document.body.appendChild(m);
  m.addEventListener('click', (e) => {
    const b = e.target.closest('[data-acct]'); if (!b) return;
    m.remove();
    if (b.dataset.acct === 'out') signOut();
    else location.hash = b.dataset.acct === 'counsellor' ? '#/counsellor-login' : '#/login';
  });
  setTimeout(() => document.addEventListener('click', function close(e) { if (!e.target.closest('#acctMenu')) { m.remove(); document.removeEventListener('click', close); } }), 0);
}

/* ---------- router ---------- */
function route() {
  const r = (location.hash.replace('#/', '') || 'home').split('?')[0];
  document.querySelectorAll('#navLinks a').forEach((a) => a.classList.toggle('active', a.dataset.route === (r === 'my-courses' ? 'courses' : r)));
  window.scrollTo({ top: 0 });
  const a = ssAuth.get();
  updateChrome();
  // Sign in first: until someone signs in (or picks guest mode), every page leads to the sign-in screen.
  if (!a && r !== 'login' && r !== 'counsellor-login') { location.replace('#/login'); return; }
  if (r === 'login' || r === 'counsellor-login') {
    if (r === 'login' && a?.role === 'counsellor') loginState.mode = 'signin';
    return loginPage(r === 'login' ? 'user' : 'counsellor');
  }
  // My Journey needs a job seeker account or guest mode; the desk needs a counsellor.
  if (r === 'journey' && !a) { toast('Sign in or continue as a guest to start your journey'); location.replace('#/login'); return; }
  if ((r === 'counsellor' || r === 'overview' || r === 'impact' || r === 'company-portal' || r === 'bias-audit') && a?.role !== 'counsellor') { toast('The counsellor workspace needs a counsellor sign-in'); location.replace('#/counsellor-login'); return; }
  // Counsellors work in their own workspace: the job seeker pages send them to their overview.
  if (a?.role === 'counsellor' && ['home', 'journey', 'courses', 'my-courses', 'about'].includes(r)) { location.replace('#/overview'); return; }
  if (r === 'journey') journey();
  else if (r === 'counsellor') counsellor();
  else if (r === 'overview') overview();
  else if (r === 'company-portal') companyPortal();
  else if (r === 'bias-audit') biasAuditPage();
  else if (r === 'jobs' || r === 'courses') catalog(r);
  else if (r === 'my-courses') myCoursesPage();
  else if (r === 'impact') impact();
  else if (r === 'about') view.innerHTML = about();
  else view.innerHTML = home();
}

/* ---------- events ---------- */
view.addEventListener('click', (e) => {
  const t = e.target;
  const story = t.closest('[data-story]');
  if (story) { const p = STORIES[+story.dataset.story]; chat.pending = { name: p.name, message: p.message() }; location.hash = '#/journey'; return; }
  const oc = t.closest('[data-open-case]');
  if (oc) { desk.id = oc.dataset.openCase; location.hash = '#/counsellor'; return; }
  const hr = t.closest('[data-href]');
  if (hr) { const h = hr.dataset.href; if (h.startsWith('#')) location.hash = h; else location.href = h; return; }
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
  if (t.closest('#wideChat')) { const on = document.querySelector('.journey-page').classList.toggle('focus'); t.closest('#wideChat').textContent = on ? 'Show panels' : 'Focus chat'; return; }
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
  const cd = t.closest('[data-course-do]');
  if (cd) return respondCourse(cd.dataset.id, cd.dataset.courseDo);
  if (t.closest('#recSend')) return recommendCourse();
  const wd = t.closest('[data-withdraw]');
  if (wd) return withdrawCourse(wd.dataset.withdraw);
});

function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  if (window.ui5SetTheme) window.ui5SetTheme(t === 'dark' ? 'sap_horizon_dark' : 'sap_horizon');
  document.getElementById('themeToggle')?.setAttribute('icon', t === 'dark' ? 'light-mode' : 'dark-mode');
}
document.getElementById('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('ss-theme', next); } catch (e) {}
});
document.getElementById('shellbar').addEventListener('logo-click', () => { location.hash = '#/'; });
document.getElementById('shellbar').addEventListener('profile-click', (e) => { e.stopPropagation?.(); accountMenu(); });
document.getElementById('themeToggle').setAttribute('icon', document.documentElement.dataset.theme === 'dark' ? 'light-mode' : 'dark-mode');

document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute"><defs>
  <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--sapChart_OrderedColor_1, #168eff)"/><stop offset="1" style="stop-color:var(--sapChart_OrderedColor_1, #168eff)"/></linearGradient></defs></svg>`);

window.addEventListener('hashchange', route);
route();
