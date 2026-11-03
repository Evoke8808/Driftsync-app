// The career orchestrator: one front door for every message.
// 1. Load the person's case file.  2. Decide which agent(s) act: buttons and clear keywords use rules,
// anything unclear goes to the AI router.  3. Run the agents.  4. Save the case, the chat and an audit trail.
const cds = require('@sap/cds');
const ai = require('../ai');
const { db, catalog, parse, caseCode, personBarriers, roleInText } = require('./lib');
const { emit } = require('../integrations/webhooks');

const AGENTS = [
  require('./skills-discovery'),
  require('./market-intelligence'),
  require('./learning-pathway'),
  require('./inclusive-matching'),
  require('./bias-readiness'),
  require('./human-loop'),
  require('./why-not'),
  require('./job-risk'),
  require('./after-hire'),
  require('./setu-chat'),
  require('./web-research')
];
const BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]));
const PIPELINE = ['skills', 'growth', 'shield', 'explain', 'research', 'market', 'matching', 'pathway', 'readiness', 'human', 'chat'];
const QUESTIONS = require('./skills-discovery').QUESTIONS;

// Clear keywords route without spending an AI call (the free AI tier has tight limits).
// English, Hinglish and Hindi (Devanagari) words; anything unclear goes to the AI router.
const RULES = [
  ['research', /\b(search (the )?(web|internet|online)|google (it|this|for)|look (it |this )?up|on the (web|internet)|latest|news|recent(ly)?|this year|right now|current(ly)? (market|salary|salaries|demand)|which companies|companies (are |that are )?hiring|who is hiring|hiring now|government scheme|yojana|scheme for|average salary|salary in [a-z]+)\b|खोज|योजना|ताज़ा/i],
  ['growth', require('./after-hire').GOT_JOB],
  ['growth', /promotion|\bpromoted\b|\braise\b|hike|grow in my (job|career)|next step in my (job|career)|career growth|तरक्की|प्रमोशन/i],
  ['shield', /(is|will) my (job|role|position) (be )?(safe|secure|at risk|replaced|automated)|job (security|safe|at risk)|lose my job|losing my job|layoffs?|laid off|fired|replace (me|my job|us)|replacing (me|us)|scared about my job|worried about my job|safer (job|role)|internal (move|transfer|role|opening)|move (to )?(another|a different) (team|role|department)|(ai|chatbot|automation)[^.?]{0,40}(my job|take over|replace)|नौकरी (जाने|चली जाएगी|खतरे)|नौकरी सुरक्षित|छंटनी/i],
  ['explain', /\bwhy\b[^.?]{0,50}(\bnot\b|n[’']t\b|\breject\w*|\bselected|\bshortlisted|\bchosen)|not (selected|shortlisted|picked|chosen)|didn[’']?t get\b[^.?]{0,50}\b(job|role|call|interview|offer)\b|(got|was|been|keep getting|keep being) rejected|rejected me|why not me|kyu?n? (nahi|nahin) (mila|hua|chuna|select)|reject kyu|क्यों नहीं|क्यों रिजेक्ट|चयन नहीं|नहीं चुना/i],
  ['human', /counsel+or|\bhuman\b|real person|approv|dispute|disagree|appeal|\bwrong\b|galat|send (it|my|this|the)|status of|गलत|ग़लत|गलती|सही नहीं|काउंसलर|सलाहकार/i],
  ['readiness', /bias|\bfair|reject|discriminat|filter|r[eé]sum[eé]|\bcv\b|interview|\bready\b|readiness|confiden|भेदभाव|रिजेक्ट|इंटरव्यू/i],
  ['matching', /part[- ]?time|remote|work from home|\bwfh\b|\bapply\b|near me|nearby|my city|income now|ghar se|near (home|my home)|office|ऑफिस|दफ्तर|\d+\s*(hours?|hrs?|ghante)\s*(a|per|ek)?\s*(day|din)|few hours|flexible|my options|what are my options|bedridden|look after|take care of|पार्ट[- ]?टाइम|घर से|घंटे|विकल्प/i],
  ['pathway', /course|\blearn|study|upskill|skill gap|close the gap|plan for|roadmap|seekh|padh|सीख|पढ़|कोर्स/i],
  ['market', /\bjobs?\b|\broles?\b|career options|salary|\bpay\b|demand|naukri|\bkaam\b|openings|automation|future of|which work|what work|नौकरी|तनख्वाह|वेतन/i],
  ['skills', /my skills|add (a )?skill|i (also|can also)|more about me|tell you more|मैं यह भी|मुझे .* भी आता/i]
];
// During the interview, plain answers stay with Skills Discovery; questions and commands get routed.
const REQUEST = /\?|^(show|find|give|what|which|how|can|could|tell me|i want|i need|list|help|send|please|kya|mujhe|dikhao|क्या|कैसे|कौन|बताओ|बताइए|दिखाओ)/i;

const LOG = cds.log('orchestrator');

// Greetings, thanks and questions about SkillSetu itself.
const SMALL_TALK = /^(hi+|hello|hey|hii+|namaste|namaskar|hola|thanks?|thank you|thank u|thx|ty|ok(ay)?|cool|nice|great|awesome|bye|good (morning|afternoon|evening|night)|नमस्ते|धन्यवाद|शुक्रिया)(?![a-z])[\s!.,?🙏😊]*$/i;
const ABOUT_US = /\b(who are you|what are you|what (can|do) you do|what is skillsetu|what's skillsetu|how does (this|skillsetu|it|setu) work|how do (i|you) use|are you (a|an) (ai|bot|human)|tum kaun|aap kaun)\b|तुम कौन|आप कौन/i;

// "My target role is data entry specialist", "I want to become an event planner": a job the person names as their goal.
const TARGET = /\b(target|goal|aim|want|wanna|would like|i'?d like|like to|interested|become|dream|prefer|apply for|looking for|switch to|planning to be)\b|बनना|बनूँ|चाहता|चाहती|banna|banana hai/i;
const NOT_TARGET = /\bwhy\b|reject|not selected|didn[’']?t get|safe|risk|replace/i;

async function decide(cf, message, intent, cat) {
  const needsSkills = ['market', 'pathway', 'matching', 'readiness', 'explain', 'shield', 'growth'];
  if (intent && BY_ID[intent] && !(needsSkills.includes(intent) && !cf.skills.length)) return { agents: [intent], by: 'button', reason: `Button pressed: ${BY_ID[intent].name}` };
  // Small talk and questions about SkillSetu get a conversational answer from Setu, even before the story.
  if (message && (SMALL_TALK.test(message.trim()) || ABOUT_US.test(message))) return { agents: ['chat'], by: 'rules', reason: 'Small talk or a question about SkillSetu, so Setu answers in chat' };
  // A question about the outside world can be looked up at any time, even before the story.
  if (message && RULES[0][0] === 'research' && RULES[0][1].test(message)) return { agents: ['research'], by: 'rules', reason: 'Asks for current facts from the web, so Web Research looks it up' };
  if (!cf.skills.length) return { agents: ['skills'], by: 'rules', reason: 'No skills on file yet, so Skills Discovery goes first' };
  const named = cat && message && TARGET.test(message) && !NOT_TARGET.test(message) && roleInText(message, cat);
  if (named) return { agents: ['pathway'], by: 'rules', roleID: named.ID, reason: `You named your target job: ${named.title}, so Learning Pathway plans for it` };

  let hits = RULES.filter(([, re]) => re.test(message)).map(([id]) => id);
  // A complaint about the AI always reaches a person, even in the middle of the interview.
  const interviewing = cf.lastAgent === 'skills' && cf.interviewStep < QUESTIONS.length;
  if (interviewing && !REQUEST.test(message) && !hits.some((h) => ['human', 'growth', 'shield', 'explain'].includes(h))) return { agents: ['skills'], by: 'rules', reason: 'Answer to the interview question' };

  if (hits.includes('matching')) hits = hits.filter((h) => h !== 'market');
  if (hits.includes('research')) hits = hits.filter((h) => h !== 'market' && h !== 'matching');
  // "Why was I rejected?" is a question for the explainer, not a request for a readiness check; job-risk questions mention automation too.
  if (hits.includes('explain')) hits = hits.filter((h) => h !== 'readiness' && h !== 'market');
  if (hits.includes('shield') || hits.includes('growth')) hits = hits.filter((h) => h !== 'market' && h !== 'matching');
  if (hits.includes('growth')) hits = hits.filter((h) => h !== 'shield');
  hits = PIPELINE.filter((id) => hits.includes(id)).slice(0, 2);
  if (hits.length) return { agents: hits, by: 'rules', reason: `Keywords point to ${hits.map((h) => BY_ID[h].name).join(' + ')}` };

  const info = {};
  const res = await ai.askJson(
    'You are the SkillSetu career orchestrator. Decide which specialist agent should answer the person. Agents:\n' +
    AGENTS.map((a) => `- ${a.id}: ${a.describe}`).join('\n') +
    '\nPick one agent, or two (in the order they should run) only if the message clearly asks for two things. ' +
    'If the message describes the person’s life or experience, pick "skills". ' +
    'Return JSON only: {"agents":["<id>"],"reason":"<one short sentence in English>"}',
    `Case file: ${cf.skills.length} skills on file; target role ${cf.targetRole_ID ? 'chosen' : 'not chosen'}; plan ${cf.plan ? 'ready' : 'not made'}; review status ${cf.status}.\nMessage: ${message.slice(0, 1500)}`,
    { log: LOG, info });
  const picked = (res?.data?.agents || []).filter((id) => BY_ID[id]).slice(0, 2);
  if (picked.length) return { agents: picked, by: 'ai', reason: String(res.data.reason || '').slice(0, 300), provider: res.provider, model: res.model, ms: res.ms };

  // No AI available: take the next step of the journey.
  const next = !cf.targetRole_ID ? 'market' : !cf.plan ? 'pathway' : cf.lastAgent !== 'readiness' ? 'readiness' : 'human';
  return { agents: [next], by: 'rules', reason: `No clear keyword; next step of the journey is ${BY_ID[next].name}`, aiError: info.error || (res ? 'AI picked no valid agent' : null) };
}

async function loadCase(caseID) {
  const { CaseFiles } = db();
  let row = caseID && await SELECT.one.from(CaseFiles).where({ ID: caseID });
  if (!row) {
    row = { ID: cds.utils.uuid(), status: 'active', interviewStep: 0 };
    await INSERT.into(CaseFiles).entries(row);
  }
  return {
    ...row,
    skills: parse(row.skills, []), profile: parse(row.profile, {}), prefs: parse(row.prefs, {}), plan: parse(row.plan, null), watch: parse(row.watch, null),
    interviewStep: row.interviewStep || 0, status: row.status || 'active'
  };
}

async function saveCase(cf) {
  const { CaseFiles } = db();
  await UPDATE(CaseFiles, cf.ID).with({
    name: cf.name, story: cf.story, skills: JSON.stringify(cf.skills), profile: JSON.stringify(cf.profile), prefs: JSON.stringify(cf.prefs),
    plan: cf.plan ? JSON.stringify(cf.plan) : null, targetRole_ID: cf.targetRole_ID || null, interviewStep: cf.interviewStep, asked: cf.asked || null,
    lastAgent: cf.lastAgent, status: cf.status, counsellorNote: cf.counsellorNote || null, externalRef: cf.externalRef || null, district: cf.district || null,
    watch: cf.watch ? JSON.stringify(cf.watch) : null
  });
}

async function nextSeq(entity, caseID) {
  const r = await SELECT.one.from(entity).columns('max(seq) as m').where({ caseFile_ID: caseID });
  return (r?.m ?? 0) + 1;
}

// Called by the chat action. Returns everything the UI needs for one turn.
// force: run exactly this agent with the message (used by the Integration API). extra: externalRef / district.
async function handle({ caseID, message, intent, roleID, name, force, forceReason, extra }) {
  const { ChatMessages, AuditLog, Roles } = db();
  const text = String(message || '').trim();
  const cf = await loadCase(caseID);
  const cat = await catalog();
  const cleanName = String(name || '').replace(/[<>]/g, '').trim().slice(0, 60);
  if (cleanName) cf.name = cleanName;
  if (extra?.externalRef) cf.externalRef = String(extra.externalRef).slice(0, 100);
  if (extra?.district) cf.district = String(extra.district).slice(0, 60);

  let mSeq = await nextSeq(ChatMessages, cf.ID), lSeq = await nextSeq(AuditLog, cf.ID);
  const chat = [], audit = [], trace = [];
  if (text) chat.push({ role: 'user', agent: null, text, card: null });

  let route;
  route = force && BY_ID[force] ? { agents: [force], by: forceReason ? 'button' : 'api', reason: forceReason || `Integration API call: ${BY_ID[force].name}` } : await decide(cf, intent ? '' : text, intent, cat);
  const snapshot = () => JSON.stringify([cf.skills.map((s) => s.skill).sort(), cf.plan?.roleID, cf.plan?.steps?.length]);
  const before = snapshot();
  trace.push({ agent: 'orchestrator', name: 'Setu', icon: '🌉', routedBy: route.by, reason: route.reason,
    to: route.agents.map((id) => BY_ID[id].name), provider: route.provider || 'rules', model: route.model || null, ms: route.ms || 0, aiError: route.aiError || null });

  const replies = [], suggestions = [];
  for (const id of route.agents) {
    const agent = BY_ID[id];
    const t0 = Date.now();
    let out;
    const aiInfo = {};   // the agent's AI call reports here why it fell back to rules
    try {
      out = await agent.run({ cf, cat, message: intent ? '' : text, roleID: roleID || route.roleID, extra, log: cds.log('agent:' + id), aiInfo });
    } catch (e) {
      LOG.error(`${agent.name} failed`, e);
      out = { replies: [{ text: `${agent.name} hit a problem, so I skipped it. Try again in a moment.` }], note: 'error: ' + e.message };
    }
    cf.lastAgent = id;
    for (const r of out.replies) {
      replies.push({ agent: id, name: agent.name, icon: agent.icon, text: r.text, card: r.card || null });
      chat.push({ role: 'agent', agent: id, text: r.text, card: r.card ? JSON.stringify(r.card) : null });
    }
    suggestions.push(...(out.suggestions || []));
    trace.push({ agent: id, name: agent.name, icon: agent.icon, routedBy: '-', reason: out.note || '',
      provider: out.ai?.provider || 'rules', model: out.ai?.model || null, ms: Date.now() - t0, aiError: out.ai ? null : aiInfo.error || null });
    if (out.disputed) trace[trace.length - 1].reason += `: "${out.disputed}"`;
    // Tool calls an agent made to outside systems (e.g. SAP over MCP) get their own trace lines.
    for (const t of out.trace || []) trace.push(t);
    if (out.disputed) emit('case.disputed', { caseID: cf.ID, code: caseCode(cf.ID), dispute: out.disputed });
  }

  // An approval covers the case as it was. If skills or the plan changed afterwards, a counsellor has to look again.
  if (cf.status === 'approved' && snapshot() !== before) {
    cf.status = 'active';
    trace.push({ agent: 'human', name: 'Human-in-the-Loop', icon: '🧑‍⚖️', routedBy: '-', reason: 'Case changed after approval, so it needs a new review', provider: 'rules', model: null, ms: 0 });
  }

  // Name is never asked for; we keep a neutral label for the counsellor list.
  if (!cf.name) cf.name = 'Guest';
  await saveCase(cf);
  for (const t of trace) audit.push({ agent: t.agent, routedBy: t.routedBy, reason: [t.to && '→ ' + t.to.join(' + '), t.reason, t.aiError && `AI unavailable (${t.aiError}), used rules`].filter(Boolean).join(' · ').slice(0, 500), provider: t.provider, model: t.model, ms: t.ms });
  if (chat.length) await INSERT.into(ChatMessages).entries(chat.map((c) => ({ ...c, caseFile_ID: cf.ID, seq: mSeq++ })));
  await INSERT.into(AuditLog).entries(audit.map((a) => ({ ...a, caseFile_ID: cf.ID, seq: lSeq++ })));

  const seen = new Set();
  return {
    caseID: cf.ID, replies, trace,
    suggestions: suggestions.filter((s) => !seen.has(s.label) && seen.add(s.label)).slice(0, 3),
    caseFile: await publicCase(cf, Roles)
  };
}

async function publicCase(cf, Roles = db().Roles) {
  const role = cf.targetRole_ID && await SELECT.one.from(Roles).columns('title').where({ ID: cf.targetRole_ID });
  return {
    ID: cf.ID, code: caseCode(cf.ID), name: cf.name, status: cf.status, externalRef: cf.externalRef || null, counsellorNote: cf.counsellorNote, interviewStep: cf.interviewStep, asked: cf.asked || null,
    skills: cf.skills, profile: cf.profile, prefs: cf.prefs, targetRole: role?.title || null,
    job: cf.profile?.job || null, watch: cf.watch ? { on: !!cf.watch.on, hiredAt: cf.watch.hiredAt || null, since: cf.watch.since || null, alerts: (cf.watch.alerted || []).length } : null,
    plan: cf.plan && { roleTitle: cf.plan.roleTitle, courses: cf.plan.steps.length, hours: cf.plan.totalHours, weeks: cf.plan.weeks }
  };
}

async function caseView(caseID) {
  const { ChatMessages, AuditLog } = db();
  const cf = caseID && await SELECT.one.from(db().CaseFiles).where({ ID: caseID });
  if (!cf) return null;
  const full = await loadCase(caseID);
  const [messages, log] = await Promise.all([
    SELECT.from(ChatMessages).where({ caseFile_ID: caseID }).orderBy('seq'),
    SELECT.from(AuditLog).where({ caseFile_ID: caseID }).orderBy('seq')
  ]);
  return {
    // barriers: what a résumé filter would hold against this person, so the counsellor always sees the fairness check.
    caseFile: { ...(await publicCase(full)), story: full.story, plan: full.plan, modifiedAt: cf.modifiedAt, barriers: personBarriers(full.profile) },
    messages: messages.map((m) => ({ role: m.role, agent: m.agent, name: BY_ID[m.agent]?.name, icon: BY_ID[m.agent]?.icon, text: m.text, card: parse(m.card, null) })),
    log: log.map((l) => ({ agent: l.agent, name: BY_ID[l.agent]?.name || ({ orchestrator: 'Setu', 'sap-mcp': 'SAP MCP' })[l.agent] || l.agent, routedBy: l.routedBy, reason: l.reason, provider: l.provider, model: l.model, ms: l.ms, at: l.createdAt }))
  };
}

async function listCases(ids) {
  const { CaseFiles } = db();
  const q = SELECT.from(CaseFiles).columns('ID', 'name', 'status', 'skills', 'plan', 'modifiedAt').orderBy('modifiedAt desc');
  if (ids) q.where({ ID: { in: ids } });
  const rows = await q;
  return rows.map((r) => ({ ID: r.ID, code: caseCode(r.ID), name: r.name || 'Guest', status: r.status, skills: parse(r.skills, []).length, role: parse(r.plan, null)?.roleTitle || null, modifiedAt: r.modifiedAt }));
}

async function review({ caseID, decision, note, by }) {
  const { CaseFiles, ChatMessages, AuditLog } = db();
  if (!['approved', 'changes'].includes(decision)) throw new Error('decision must be approved or changes');
  const cf = await SELECT.one.from(CaseFiles).where({ ID: caseID });
  if (!cf) return null;
  const clean = String(note || '').trim().slice(0, 1000);
  const who = by ? `${by.name} (${by.username})` : null;
  await UPDATE(CaseFiles, caseID).with({ status: decision, counsellorNote: clean || null, reviewedBy: who });
  const counsellor = by ? `Your counsellor ${by.name}` : 'Your counsellor';
  const text = decision === 'approved'
    ? `${counsellor} approved your plan.${clean ? ' Note: ' + clean : ''}`
    : `${counsellor} asked for a change: ${clean || 'please check your plan.'}`;
  await INSERT.into(ChatMessages).entries({ caseFile_ID: caseID, seq: await nextSeq(ChatMessages, caseID), role: 'counsellor', agent: 'human', text,
    card: JSON.stringify({ type: 'handoff', status: decision, note: clean, by: by?.name || null }) });
  await INSERT.into(AuditLog).entries({ caseFile_ID: caseID, seq: await nextSeq(AuditLog, caseID), agent: 'human', routedBy: '-',
    reason: `Counsellor${who ? ' ' + who : ''} ${decision === 'approved' ? 'approved the plan' : 'requested changes'}${clean ? ': ' + clean : ''}`, provider: 'person', model: null, ms: 0 });
  emit(decision === 'approved' ? 'case.approved' : 'case.changes_requested', { caseID, code: caseCode(caseID), status: decision, note: clean || null,
    skills: parse(cf.skills, []).map((x) => x.skill), role: parse(cf.plan, null)?.roleTitle || null });
  return { status: decision };
}

module.exports = { handle, caseView, listCases, review, AGENTS: AGENTS.map((a) => ({ id: a.id, name: a.name, icon: a.icon })) };
