// Shared helpers for the agents: catalog data, skill matching, the bias audit and rule-based text parsing.
// Every number the person sees is computed here in code, never by the AI.
const cds = require('@sap/cds');

const db = () => cds.entities('skillsetu');

async function catalog() {
  const { Skills, Roles, RoleSkills, Courses } = db();
  const [skills, roles, roleSkills, courses] = await Promise.all([
    SELECT.from(Skills), SELECT.from(Roles), SELECT.from(RoleSkills), SELECT.from(Courses)
  ]);
  return { skills, roles, roleSkills, courses, skillById: Object.fromEntries(skills.map((s) => [s.ID, s])) };
}

// Rank every role by the share of its skills the person already has.
function matchRoles(names, cat) {
  const have = new Set(cat.skills.filter((s) => names.includes(s.name)).map((s) => s.ID));
  return cat.roles.map((role) => {
    const needs = cat.roleSkills.filter((rs) => rs.role_ID === role.ID);
    const matched = needs.filter((rs) => have.has(rs.skill_ID));
    const missing = needs.filter((rs) => !have.has(rs.skill_ID)).map((rs) => ({
      ...cat.skillById[rs.skill_ID],
      importance: rs.importance,
      courses: cat.courses.filter((c) => c.skill_ID === rs.skill_ID)
    }));
    return {
      role,
      matchPercent: needs.length ? Math.round((matched.length / needs.length) * 100) : 0,
      matchedSkills: matched.map((rs) => cat.skillById[rs.skill_ID].name),
      missingSkills: missing
    };
  }).sort((a, b) => b.matchPercent - a.matchPercent);
}

// The one ranking every agent uses, so they all agree on the "top" role:
// best skills match first; on a tie, more hiring demand, then lower automation risk.
const DEMAND_RANK = { High: 2, Medium: 1, Low: 0 };
function rankRoles(names, cat) {
  return matchRoles(names, cat).sort((a, b) => b.matchPercent - a.matchPercent
    || (DEMAND_RANK[b.role.demand] ?? 0) - (DEMAND_RANK[a.role.demand] ?? 0)
    || (RISK_RANK[a.role.automationRisk] ?? 1) - (RISK_RANK[b.role.automationRisk] ?? 1));
}

/* ---------- Bias audit (four-fifths rule) ---------- */
const PASS_MATCH = 60;
const FOUR_FIFTHS = 0.8;

// What a typical keyword/résumé filter screens on. Each rule is a proxy, not a skill.
const resumeFilterReasons = (c) => [
  c.gapYears > 1 && `career gap of ${c.gapYears} years`,
  c.age > 40 && `age ${c.age}`,
  c.education === 'none' && 'no degree',
  c.education === 'degree-tier3' && 'college not on the shortlist',
  c.titleMatch === false && 'past job title lacks keywords',
  c.needsAccommodation && 'online test is not accessible'
].filter(Boolean);

async function biasAudit(roleID) {
  const { Roles, RoleSkills, Skills, Candidates } = db();
  const [role, needs, all, candidates] = await Promise.all([
    SELECT.one.from(Roles).where({ ID: roleID }),
    SELECT.from(RoleSkills).where({ role_ID: roleID }),
    SELECT.from(Skills),
    SELECT.from(Candidates)
  ]);
  if (!role) return null;
  const byId = Object.fromEntries(all.map((s) => [s.ID, s.name]));
  const required = needs.map((n) => byId[n.skill_ID]);

  const scored = candidates.map((c) => {
    const has = new Set((c.skills || '').split(';'));
    const matched = required.filter((s) => has.has(s));
    const match = required.length ? Math.round((matched.length / required.length) * 100) : 0;
    const reasons = resumeFilterReasons(c);
    const skillsFirst = match >= PASS_MATCH;
    return { c, match, matched, reasons, skillsFirst, resumeFilter: skillsFirst && reasons.length === 0 };
  });

  const groupKeys = [...new Set(candidates.map((c) => c.groupKey))];
  const groups = groupKeys.map((key) => {
    const g = scored.filter((s) => s.c.groupKey === key);
    const rate = (k) => g.filter((s) => s[k]).length / g.length;
    return {
      key, label: g[0].c.groupLabel, n: g.length,
      resumeFilter: { selected: g.filter((s) => s.resumeFilter).length, rate: rate('resumeFilter') },
      skillsFirst: { selected: g.filter((s) => s.skillsFirst).length, rate: rate('skillsFirst') }
    };
  });
  for (const method of ['resumeFilter', 'skillsFirst']) {
    const best = Math.max(...groups.map((g) => g[method].rate));
    for (const g of groups) {
      g[method].air = best > 0 ? +(g[method].rate / best).toFixed(2) : null;
      g[method].pass = g[method].air === null || g[method].air >= FOUR_FIFTHS;
    }
  }

  const shortlist = scored
    .filter((s) => s.skillsFirst)
    // Ties break on the candidate number only: filter reasons (gap, age, college) never affect the order.
    .sort((a, b) => b.match - a.match || String(a.c.alias).localeCompare(String(b.c.alias)))
    .slice(0, 8)
    .map((s) => ({ alias: s.c.alias, match: s.match, matchedSkills: s.matched, wouldBeRejectedFor: s.reasons }));

  return {
    role: { ID: role.ID, title: role.title, company: role.company },
    threshold: FOUR_FIFTHS, passMatch: PASS_MATCH, requiredSkills: required,
    groups, shortlist,
    summary: {
      candidates: candidates.length,
      resumeFilterFailingGroups: groups.filter((g) => !g.resumeFilter.pass).length,
      skillsFirstFailingGroups: groups.filter((g) => !g.skillsFirst.pass).length,
      qualifiedRejectedByResumeFilter: scored.filter((s) => s.skillsFirst && !s.resumeFilter).length,
      qualified: scored.filter((s) => s.skillsFirst).length
    }
  };
}

/* ---------- Rule-based fallbacks when no AI is available ---------- */
// Fallback skill keywords: English stems plus common Hindi (Devanagari), Hinglish and Tamil words.
const KEYWORDS = {
  // budget-management
  budget: 'budget-management', money: 'budget-management', financ: 'budget-management', accounts: 'budget-management', hisab: 'budget-management',
  hisaab: 'budget-management', savings: 'budget-management', ledger: 'budget-management', 'who owed': 'budget-management', donation: 'budget-management',
  kanakku: 'budget-management', 'हिसाब': 'budget-management', 'बचत': 'budget-management', 'बजट': 'budget-management', 'पैसे': 'budget-management', 'लोन': 'budget-management', 'चंदा': 'budget-management',
  // scheduling
  schedule: 'scheduling', roster: 'scheduling', calendar: 'scheduling', coordinat: 'scheduling', timetable: 'scheduling', meeting: 'scheduling', 'मीटिंग': 'scheduling', 'बैठक': 'scheduling',
  // event-planning
  event: 'event-planning', organiz: 'event-planning', organis: 'event-planning', party: 'event-planning', function: 'event-planning', festival: 'event-planning',
  wedding: 'event-planning', 'arrange pann': 'event-planning', 'कार्यक्रम': 'event-planning', 'शादी': 'event-planning', 'त्योहार': 'event-planning', 'समारोह': 'event-planning', 'आयोजित': 'event-planning', 'मेला': 'event-planning', 'मेले': 'event-planning',
  // negotiation
  negotiat: 'negotiation', vendor: 'negotiation', bargain: 'negotiation', deal: 'negotiation', supplier: 'negotiation', convinc: 'negotiation',
  wholesal: 'negotiation', 'better price': 'negotiation', 'mol bhav': 'negotiation', 'rate pesi': 'negotiation', 'मोलभाव': 'negotiation', 'मोल-भाव': 'negotiation',
  // team-leadership
  team: 'team-leadership', lead: 'team-leadership', trained: 'team-leadership', train: 'team-leadership', mentor: 'team-leadership', helpers: 'team-leadership',
  volunteers: 'team-leadership', 'cousins to help': 'team-leadership', committee: 'team-leadership', 'समूह चला': 'team-leadership', 'टीम': 'team-leadership',
  'सिखा': 'team-leadership', tuition: 'communication', padhaya: 'communication', 'पढ़ाया': 'communication', sikhaya: 'team-leadership', 'ट्यूशन': 'communication', 'कमेटी': 'team-leadership', 'समिति': 'team-leadership', 'महिलाओं': 'team-leadership',
  // excel
  excel: 'excel', spreadsheet: 'excel', 'google sheet': 'excel',
  // customer-service
  customer: 'customer-service', client: 'customer-service', complaint: 'customer-service', selling: 'customer-service', 'sold ': 'customer-service',
  grahak: 'customer-service', 'ग्राहक': 'customer-service', 'शिकायत': 'customer-service', 'दुकान': 'customer-service',
  // communication
  communicat: 'communication', presentation: 'communication', presented: 'communication', speak: 'communication', english: 'communication', hindi: 'communication', explain: 'communication',
  taught: 'communication', 'बात कर': 'communication', 'समझा': 'communication',
  // problem-solving
  problem: 'problem-solving', solve: 'problem-solving', fix: 'problem-solving', solved: 'problem-solving', resolv: 'problem-solving', dispute: 'problem-solving',
  'sort out': 'problem-solving', 'सुलझा': 'problem-solving', 'झगड़': 'problem-solving', 'समस्या': 'problem-solving',
  // data-entry
  data: 'data-entry', typing: 'data-entry', record: 'data-entry', notebook: 'data-entry', register: 'data-entry', 'रिकॉर्ड': 'data-entry', 'रजिस्टर': 'data-entry',
  // project-management / time-management
  project: 'project-management', deadline: 'time-management', 'on time': 'time-management', 'every morning': 'time-management', punctual: 'time-management',
  'सुबह': 'time-management', 'समय पर': 'time-management'
};

function keywordSkills(text) {
  const lower = String(text || '').toLowerCase();
  const found = new Map();
  for (const [kw, skill] of Object.entries(KEYWORDS)) {
    // English keywords must start a word ("event" should not match "prevent"); Devanagari has no \b in JS regex.
    const i = /^[\x00-\x7F]+$/.test(kw) ? lower.search(new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) : lower.indexOf(kw);
    if (i >= 0 && !found.has(skill)) {
      // Quote the clause around the keyword as evidence.
      const from = Math.max(0, lower.lastIndexOf(',', i) + 1, lower.lastIndexOf('.', i) + 1, lower.lastIndexOf('।', i) + 1);
      let to = lower.slice(i).search(/[,.।]/);
      to = to < 0 ? lower.length : i + to;
      found.set(skill, String(text).slice(from, to).trim().slice(0, 120));
    }
  }
  return [...found].map(([skill, reason]) => ({ skill, reason }));
}

const CITIES = ['Bengaluru', 'Bangalore', 'Mumbai', 'Pune', 'Hyderabad', 'Indore', 'Lucknow', 'Delhi', 'Chennai', 'Kolkata', 'Jaipur', 'Kochi', 'Bhubaneswar', 'Remote'];

// Pull barrier facts and work preferences out of free text. Used for the bias check only, never sent to employers.
function parseProfile(text) {
  const t = String(text || '');
  const profile = {}, prefs = {};
  const age = t.match(/\b(?:i am|i'm|age|aged|umar)\s*(\d{2})\b/i) || t.match(/\b(\d{2})\s*(?:years? old|yrs old|saal ki|saal ka)\b/i);
  if (age) profile.age = +age[1];
  // A gap means time away from paid work, not running something from home.
  const gap = t.match(/(\d{1,2})[- ]?(?:years?|yrs|saal)\b[^.\d]{0,60}?(?:break|gap|at home|stayed home|home with|child|kids|bach|family|looking after|took care|ghar (?:pe|par|sambhal))/i)
    || t.match(/(?:break|gap|stayed (?:at )?home|home with|looking after|took care of)[^.]{0,40}?(\d{1,2})[- ]?(?:years?|yrs|saal)/i);
  // "8 years in our family business" is work, not a gap.
  const gapClause = gap ? t.slice(Math.max(0, t.lastIndexOf('.', gap.index) + 1), (t.indexOf('.', gap.index) + 1 || t.length + 1) - 1) : '';
  if (gap && !/business|shop|dukan|company|firm|\bjob\b|\bworked\b|naukri/i.test(gapClause)) profile.gapYears = +gap[1];
  if (/wheelchair|disab|blind|deaf|visually|hearing|accessib|divyang/i.test(t)) profile.needsAccommodation = true;
  if (/\b(b\.?com|b\.?a\b|b\.?sc|b\.?tech|degree|graduat|diploma)/i.test(t)) profile.education = 'degree';
  else if (/no degree|10th|12th|school only|dropped out/i.test(t)) profile.education = 'none';
  const title = t.match(/\b(bpo|call cent(?:er|re)|voice agent|telecaller)/i);
  if (title) profile.pastTitle = title[1];
  const hoursADay = t.match(/(\d{1,2})\s*(?:hours?|hrs?|ghante|घंटे)\s*(?:a|per|ek|प्रति)?\s*(?:day|din|दिन)/i);
  if (/part[- ]?time|पार्ट[- ]?टाइम|few hours|flexible hours|कुछ घंटे/i.test(t) || (hoursADay && +hoursADay[1] <= 6)) prefs.type = 'part-time';
  else if (/full[- ]?time/i.test(t)) prefs.type = 'full-time';
  // Remote is its own flag, so "a few hours from home" keeps both wishes.
  if (/not remote|no remote|go to (an |the )?office|in an office|from (an |the )?office|office (job|work)|ऑफिस|दफ्तर/i.test(t)) prefs.remote = false;
  else if (/remote|work from home|wfh|ghar se|घर से/i.test(t)) { prefs.remote = true; if (!prefs.type) prefs.type = 'remote'; }
  const city = CITIES.find((c) => new RegExp(`\\b(?:in|near|at|around)\\s+${c}\\b`, 'i').test(t));
  if (city) prefs.location = city === 'Bangalore' ? 'Bengaluru' : city;
  return { profile, prefs };
}

// Reply in Hindi when the person writes in Devanagari; for a button press, look at what they wrote last.
// Hindi written in Latin letters (Hinglish): two or more common Hindi words.
const hinglish = (t) => ((String(t || '').toLowerCase().match(/\b(maine|mera|meri|mere|mujhe|mujhko|hai|hain|tha|thi|kiya|kiye|karta|karti|karna|kaam|naukri|ghar|bachon|saal|ke liye|ka|ki|ko|se|aur|kya|kaun|kaise|nahi|nahin|chahiye|dauraan|sambhala|banao|bhejo|dikhao|batao|wala|wali)\b/g) || []).length >= 2);
const isHindi = (cf, message) => /[\u0900-\u097F]/.test(message || '') || hinglish(message) || (!message && /[\u0900-\u097F]/.test(String(cf?.story || '').slice(-300)));

// Explains each skill for the chat card: what it means, its category and which jobs ask for it.
function explainSkills(list, cat) {
  const byName = Object.fromEntries(cat.skills.map((s) => [s.name, s]));
  const roleById = Object.fromEntries(cat.roles.map((r) => [r.ID, r]));
  return list.map((s) => {
    const sk = byName[s.skill];
    const jobs = sk ? cat.roleSkills.filter((rs) => rs.skill_ID === sk.ID).map((rs) => roleById[rs.role_ID]?.title).filter(Boolean) : [];
    return { ...s, desc: sk?.description || null, category: sk?.category || null, jobs: jobs.length, jobTitles: jobs.slice(0, 3) };
  });
}
const jobsOpened = (list, cat) => {
  const ids = new Set(cat.skills.filter((s) => list.some((x) => x.skill === s.name)).map((s) => s.ID));
  return new Set(cat.roleSkills.filter((rs) => ids.has(rs.skill_ID)).map((rs) => rs.role_ID)).size;
};

// Short, readable case ID shown to the person, the counsellor and (instead of a name) to employers.
const caseCode = (id) => 'SS-' + String(id || '').replace(/-/g, '').slice(0, 6).toUpperCase();


/* ---------- Shared by Why-Not Explainer, Job Risk Radar and After-Hire Companion ---------- */
const RISK_RANK = { Low: 0, Medium: 1, High: 2 };

// How much of each skill's everyday work AI tools already do well. Illustrative values for the demo, like automationRisk.
const AI_EXPOSURE = {
  'data-entry': 'High', excel: 'Medium', 'customer-service': 'Medium', scheduling: 'Medium', 'budget-management': 'Medium',
  communication: 'Low', negotiation: 'Low', 'team-leadership': 'Low', 'problem-solving': 'Low', 'event-planning': 'Low',
  'project-management': 'Low', 'time-management': 'Low'
};

// The shortest course that teaches a skill.
const shortestCourse = (courses) => [...(courses || [])].sort((a, b) => hours(a.duration) - hours(b.duration))[0] || null;
// Top of a salary range like "₹3.5-5 LPA", for comparing pay.
const salaryTop = (s) => { const n = String(s || '').match(/[\d.]+/g); return n ? +n[n.length - 1] : 0; };

// Résumé-filter barriers for one person (same rules as the bias audit), with the military wording for ex-servicemen.
function personBarriers(p = {}) {
  return resumeFilterReasons({
    gapYears: p.gapYears, age: p.age, education: p.education,
    titleMatch: p.pastTitle || p.forces ? false : undefined, needsAccommodation: p.needsAccommodation
  }).map((b) => (p.forces && !p.pastTitle && b === 'past job title lacks keywords' ? `military rank "${p.forces.rank || 'service title'}" is not in the job's keywords` : b));
}

// A role the person names in a message: the full title, or most of its words ("event planner", "support coach").
// Job words people write in Devanagari, so a Hindi message can name an English job title.
const HI_JOB_WORDS = { 'इवेंट': 'event', 'इवेंट्स': 'events', 'प्लानर': 'planner', 'अकाउंट्स': 'accounts', 'अकाउंट': 'accounts', 'असिस्टेंट': 'assistant', 'डेटा': 'data', 'डाटा': 'data',
  'एंट्री': 'entry', 'स्पेशलिस्ट': 'specialist', 'कोऑर्डिनेटर': 'coordinator', 'कोआर्डिनेटर': 'coordinator', 'ऑपरेशंस': 'operations', 'ऑपरेशन': 'operations', 'कस्टमर': 'customer',
  'सर्विस': 'service', 'सपोर्ट': 'support', 'सुपरवाइज़र': 'supervisor', 'सुपरवाइजर': 'supervisor', 'शादी': 'wedding', 'प्रोजेक्ट': 'project', 'ऑफिस': 'office', 'फ्रंट': 'front',
  'एग्जीक्यूटिव': 'executive', 'रिटेल': 'retail', 'स्टोर': 'store', 'ऑनलाइन': 'online', 'सिक्योरिटी': 'security', 'वेयरहाउस': 'warehouse', 'डिस्पैच': 'dispatch', 'किचन': 'kitchen', 'केटरिंग': 'catering' };

function roleInText(text, cat) {
  const t = String(text || '').toLowerCase().replace(/[\u0900-\u097F]+/g, (w) => HI_JOB_WORDS[w] || w);
  if (!t) return null;
  const exact = cat.roles.filter((r) => t.includes(r.title.toLowerCase())).sort((a, b) => b.title.length - a.title.length)[0];
  if (exact) return exact;
  const words = (r) => r.title.toLowerCase().replace(/[()]/g, '').split(/\s+/).filter((w) => w.length > 3 && !['and', 'with'].includes(w));
  let best = null, score = 0;
  for (const r of cat.roles) {
    const w = words(r), hit = w.filter((x) => new RegExp('\\b' + x.replace(/s$/, '')).test(t)).length;
    if (hit >= 2 && hit / w.length > score) { best = r; score = hit / w.length; }
  }
  return best;
}

// The job someone does NOW ("I work at ServiceFirst as…", "currently a data entry operator").
// Past jobs ("I worked as…") are not current, so they don't count.
const NOW = /\b(i (currently |still |now )?work(?!ed)|i am working|i'?m working|currently (working|employed|a |an |at )|i have (been )?work(ed|ing) (at|in|for) .{0,40}for \d+|my (current )?(job|company|employer|manager)|at my (job|company|office)|abhi .{0,30}kaam kar|main .{0,40}(mein|me) kaam kar(ta|ti))|(मैं .{0,60}(काम|नौकरी) कर (रहा|रही) (हूँ|हूं)|मैं .{0,60}(काम|नौकरी) कर(ता|ती) (हूँ|हूं)|मेरी (नौकरी|कंपनी))/i;
const JOB_HINTS = [
  [/call cent|customer (care|service|support)|bpo|telecaller|voice agent|complaints? (desk|team)|support agent|कस्टमर|कॉल सेंटर/i, /customer/i],
  [/data entry|typing job|record clerk|data operator|डेटा एंट्री|डाटा एंट्री/i, /data entry/i],
  [/retail|store associate|shop floor|sales counter/i, /retail/i],
  [/front (office|desk)|reception/i, /front office/i],
  [/accounts? (assistant|clerk)|book-?keep/i, /accounts/i],
  [/dispatch|delivery coordinat/i, /dispatch/i],
  [/warehouse|stores? (keeper|in-?charge)/i, /warehouse/i],
  [/security guard|security supervisor/i, /security/i]
];
function detectJob(text, cat) {
  const t = String(text || '');
  if (!cat?.roles || !NOW.test(t)) return null;
  const lower = t.toLowerCase();
  const companies = [...new Set(cat.roles.map((r) => r.company))].filter((c) => lower.includes(c.toLowerCase()));
  const pool = companies.length ? cat.roles.filter((r) => companies.includes(r.company)) : cat.roles;
  let role = roleInText(t, { roles: pool });
  if (!role) for (const [re, title] of JOB_HINTS) if (re.test(t)) { role = pool.find((r) => title.test(r.title)); if (role) break; }
  if (!role && companies.length) role = [...pool].sort((a, b) => RISK_RANK[b.automationRisk] - RISK_RANK[a.automationRisk])[0];
  // Without a company name we only know the closest job type, not the employer, so company stays empty.
  return role ? { roleID: role.ID, title: role.title, company: companies.length ? role.company : null } : null;
}

// Days between two ISO dates (yyyy-mm-dd).
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const today = (plusDays = 0) => new Date(Date.now() + plusDays * 86400000).toISOString().slice(0, 10);

const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const label = (name) => { const s = String(name || '').replace(/-/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };
const hours = (d) => { const n = parseFloat(d); return /week/i.test(d) ? n * 5 : n || 0; };

module.exports = { db, catalog, matchRoles, rankRoles, biasAudit, resumeFilterReasons, PASS_MATCH, RISK_RANK, AI_EXPOSURE, shortestCourse, salaryTop, personBarriers, roleInText, detectJob, daysBetween, today, keywordSkills, parseProfile, parse, label, hours, isHindi, hinglish, caseCode, explainSkills, jobsOpened };
