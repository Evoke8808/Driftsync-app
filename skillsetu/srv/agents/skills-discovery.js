// Agent 1: Skills Discovery. Interviews the person in their own language and turns life and work
// experience (paid or unpaid) into skills from the catalog, each with a quote as evidence.
const ai = require('../ai');
const { keywordSkills, parseProfile, label, explainSkills, jobsOpened, detectJob } = require('./lib');
const military = require('./military');

// Fallback interview when no AI is available (the AI writes its own follow-up questions otherwise).
// Each question is skipped once what it looks for is already on file.
const QUESTIONS = [
  { q: 'Tell me about your life and work so far, paid or unpaid. Home, family, community, anything counts.',
    hi: 'अपनी ज़िंदगी और काम के बारे में बताइए, पैसे वाला हो या बिना पैसे वाला। घर, परिवार, समाज, सब गिना जाता है।', done: () => true },
  { q: 'Did you ever handle money, like a household budget, a shop’s accounts or a group’s funds?',
    hi: 'क्या आपने कभी पैसों का हिसाब रखा है, जैसे घर का बजट, दुकान का हिसाब या किसी समूह का फंड?', done: (c) => has(c, 'budget-management') },
  { q: 'Have you organised events, functions or schedules for other people?',
    hi: 'क्या आपने कभी दूसरों के लिए कोई कार्यक्रम, समारोह या समय-सारणी संभाली है?', done: (c) => has(c, 'event-planning') || has(c, 'scheduling') },
  { q: 'Have you ever bargained with vendors, sorted out a complaint or fixed a problem for someone?',
    hi: 'क्या आपने कभी मोलभाव किया, कोई शिकायत सुलझाई या किसी की समस्या हल की?', done: (c) => has(c, 'negotiation') || has(c, 'problem-solving') },
  { q: 'Did you lead, guide or train anyone, at work, at home or in your community?',
    hi: 'क्या आपने कभी किसी को सिखाया, संभाला या किसी टीम या समूह को आगे बढ़ाया?', done: (c) => has(c, 'team-leadership') },
  { q: 'Have you used a computer or phone to keep records, like Excel, forms or WhatsApp lists?',
    hi: 'क्या आपने कभी फ़ोन या कंप्यूटर पर रिकॉर्ड रखे हैं, जैसे Excel, फ़ॉर्म या WhatsApp लिस्ट?', done: (c) => has(c, 'excel') || has(c, 'data-entry') },
  { q: 'What kind of work suits you right now: full-time, part-time, or from home?',
    hi: 'अभी आपके लिए कैसा काम ठीक रहेगा: फुल-टाइम, पार्ट-टाइम या घर से?', done: (c) => !!c.prefs.type },
  { q: 'Which city would you like to work in?',
    hi: 'आप किस शहर में काम करना चाहेंगे?', done: (c) => !!c.prefs.location },
  { q: 'Do you need any support at work, like an accessible office or flexible hours? It’s fine to say no.',
    hi: 'क्या काम पर आपको किसी मदद की ज़रूरत है, जैसे सुलभ ऑफ़िस या लचीले घंटे? "नहीं" कहना भी ठीक है।', done: (c) => c.profile.needsAccommodation != null }
];
// Fixed replies in English and Hindi, used when the AI is unavailable (the AI answers in the person's own language).
const SAY = {
  en: {
    found: (n, list) => `I found ${n} new skill${n > 1 ? 's' : ''} in what you said: ${list}.`,
    none: 'I didn’t spot a new skill in that, and that’s fine.',
    first: 'I couldn’t pick out skills from that yet. A few simple questions will help.',
    enough: 'That’s already enough to find good matches. If you’d like to add more: ',
    clear: 'I have a clear picture now. Shall we look at jobs?',
    jobs: 'Show jobs that fit me', flexible: 'Part-time or remote work', stop: 'That’s all, show me jobs'
  },
  hi: {
    found: (n, list) => (n === 1 ? `आपकी बातों में मुझे 1 नया हुनर मिला: ${list}.` : `आपकी बातों में मुझे ${n} नए हुनर मिले: ${list}.`),
    none: 'इसमें कोई नया हुनर नहीं दिखा, कोई बात नहीं।',
    first: 'अभी इसमें से हुनर पहचानना मुश्किल था। कुछ आसान सवालों से मदद मिलेगी।',
    enough: 'अच्छी नौकरियाँ ढूँढने के लिए इतना काफ़ी है। अगर और बताना चाहें: ',
    clear: 'अब आपकी अच्छी तस्वीर मिल गई है। क्या नौकरियाँ देखें?',
    jobs: 'मेरे लायक नौकरियाँ दिखाओ', flexible: 'पार्ट-टाइम या घर से काम', stop: 'बस इतना, नौकरियाँ दिखाओ'
  }
};
const isHindi = (t) => /[\u0900-\u097F]/.test(t);
const has = (c, skill) => c.skills.some((s) => s.skill === skill);
const asked = (c) => String(c.asked || '').split(',').filter(Boolean).map(Number);
// Next fallback question that is neither asked nor already answered by the story.
const nextQuestion = (c) => QUESTIONS.findIndex((x, i) => i > 0 && !asked(c).includes(i) && !x.done(c));
const ENOUGH_SKILLS = 4;
const DONE = /^(done|that'?s (all|it)|nothing (else|more)|bas|itna hi|show me jobs)\b/i;

const SYSTEM = (allowed, known, hints) =>
  'You are the Skills Discovery agent of SkillSetu, a career guide for people that hiring filters usually reject: ' +
  'women returning after a career break, workers displaced by automation, people with disabilities. ' +
  'Count unpaid, household, community and informal work as real experience. ' +
  'Be thorough: include skills that are clearly implied, e.g. running a group or committee means team-leadership, keeping accounts means budget-management, settling quarrels means problem-solving. ' +
  'Choose excel only if a computer, phone app or spreadsheet is mentioned; a paper notebook or register is data-entry or budget-management. ' +
  'For ex-servicemen (Army, Navy, Air Force, paramilitary), translate rank and trade into civilian skills: e.g. Havildar or Petty Officer leading a section means team-leadership, a storekeeper or quartermaster means data-entry and budget-management, a duty roster means scheduling. ' +
  'The person may write in English, Hindi, Hinglish, Tamil or another Indian language. ' +
  `Skills you may use (choose ONLY from this list): ${allowed}. ` +
  `Skills already found: ${known || 'none'}. ` +
  (hints.length ? `A keyword scan suggests these possible skills in the latest answer: ${hints.map((h) => `${h.skill} ("${h.reason}")`).join('; ')}. ` +
    'Put each one in "skills" if the answer really shows it, or in "rejected" if it does not. ' : '') +
  'Read the latest answer and do four things: ' +
  '1) extract NEW skills from the latest answer, each with a short quote from it as the reason; ' +
  '2) note facts useful for a fairness check if stated: age, years of career gap (only time the person says they were away from work, e.g. a break at home; running a group, shop or business is work, not a gap), education ("degree" or "none"), whether they need workplace accessibility, preferred work type (full-time, part-time, remote) and city; ' +
  '3) write "ack": ONE plain, specific sentence (max 20 words) in the same language and script the person used, naming the experience you turned into skills, e.g. "Running the household budget and school events shows budgeting and planning." No praise words (wonderful, impressive, amazing, great); ' +
  '4) write ONE short follow-up question (max 25 words) in the same language and script, ' +
  'aimed at a skill not yet found, or at work preferences if those are unknown. Never ask about age, religion, caste or marital status. ' +
  'Return JSON only: {"skills":[{"skill":"<name from list>","reason":"<quote>"}],"rejected":["<skill>"],' +
  '"profile":{"age":null,"gapYears":null,"education":null,"needsAccommodation":null},' +
  '"prefs":{"type":null,"location":null},"ack":"<sentence>","question":"<follow-up question>"}';

const HINGLISH = /\b(aap|aapka|aapki|kya|hai|hain|kis|kaam|baat|mujhe|nahi|aur|bhi|ke liye)\b/i;
const PRAISE = /wonderful|amazing|impressive|incredible|fantastic|awesome|great (job|work|experience)|truly|excellent|inspiring|remarkable|commendable|शानदार|बहुत बढ़िया|behtareen|kamaal|zabardast/i;

// Technical skills need explicit evidence, whoever suggested them.
const NEEDS_PROOF = { excel: /excel|spreadsheet|google sheet|\bsheets?\b|computer|laptop|tally|software|एक्सेल|कंप्यूटर|शीट/i };
const proven = (x, text) => !NEEDS_PROOF[x.skill] || NEEDS_PROOF[x.skill].test(`${x.reason} ${text}`);

module.exports = {
  id: 'skills',
  name: 'Skills Discovery',
  icon: '🔎',
  describe: 'Interviews the person and turns life and work experience into skills with evidence. Use for any story about past work, home, community, or to add skills.',

  async run(ctx) {
    const { cf, message, cat, log, aiInfo } = ctx;
    const text = String(message || '').trim();
    const allowed = cat.skills.map((s) => s.name);
    const knownNames = cf.skills.map((s) => s.skill);

    if (!text || DONE.test(text)) {
      return wrapUp(cf, cat, knownNames.length ? 'Got it. Here’s everything I found so far.' : QUESTIONS[0].q);
    }
    const say = SAY[isHindi(text) ? 'hi' : 'en'];

    cf.story = [cf.story, text].filter(Boolean).join('\n');
    // Keywords give the AI hints to confirm; anything the AI neither confirms nor rejects is kept as keyword evidence.
    const hints = keywordSkills(text).filter((x) => allowed.includes(x.skill) && !knownNames.includes(x.skill));
    const res = await ai.askJson(SYSTEM(allowed.join(', '), knownNames.join(', '), hints),
      `Conversation so far:\n${cf.story.slice(-3000)}\n\nLatest answer: ${text.slice(0, 2000)}`, { log, temperature: 0.3, info: aiInfo });

    let found, question, ack = null;
    const rules = parseProfile(text);
    if (res) {
      const d = res.data || {};
      const fromAi = (Array.isArray(d.skills) ? d.skills : [])
        .filter((x) => x && allowed.includes(x.skill))
        .map((x) => ({ skill: x.skill, reason: String(x.reason || '').slice(0, 200), by: 'ai' }));
      const rejected = new Set((Array.isArray(d.rejected) ? d.rejected : []).map(String));
      const kept = hints.filter((h) => !fromAi.some((x) => x.skill === h.skill) && !rejected.has(h.skill)).map((h) => ({ ...h, by: 'keywords' }));
      found = [...fromAi, ...kept];
      ack = typeof d.ack === 'string' && d.ack.trim() ? d.ack.trim().slice(0, 240) : null;
      // No empty praise: if the AI only flattered, say plainly what was found instead.
      if (ack && PRAISE.test(ack)) ack = null;
      const p = d.profile || {}, pr = d.prefs || {};
      merge(cf.profile, { age: num(p.age), gapYears: num(p.gapYears), education: ['degree', 'none'].includes(p.education) ? p.education : null,
        needsAccommodation: p.needsAccommodation === true ? true : null });
      merge(cf.prefs, { type: ['full-time', 'part-time', 'remote'].includes(pr.type) ? pr.type : null, location: typeof pr.location === 'string' ? pr.location : null });
      question = typeof d.question === 'string' && d.question.trim() ? d.question.trim().slice(0, 300) : null;
      // Keep the AI to clean sentences: cut anything after the last sentence end (it sometimes adds stray words),
      // and answer in the person's language: an English message never gets a Hinglish reply.
      const tidy = (t, end) => { if (!t) return t; const i = Math.max(...end.map((c) => t.lastIndexOf(c))); return i > 0 ? t.slice(0, i + 1) : t; };
      question = tidy(question, ['?', '।']);
      ack = tidy(ack, ['.', '!', '?', '।']);
      const english = !/[\u0900-\u097F]/.test(text) && !HINGLISH.test(text);
      if (english && HINGLISH.test(`${ack || ''} ${question || ''}`)) { ack = null; question = null; }
    } else {
      found = hints.map((h) => ({ ...h, by: 'keywords' }));
    }
    // Ex-servicemen: rank, trade and duties translate into skills by fixed rules, so the AI can't drop them.
    const mil = military.translate(text);
    if (mil) {
      for (const m of mil.skills) if (allowed.includes(m.skill) && !found.some((x) => x.skill === m.skill)) found.push({ skill: m.skill, reason: m.reason, by: 'service' });
      const rank = mil.rows.find((r) => r.kind === 'rank');
      cf.profile.forces = { service: mil.service || cf.profile.forces?.service || null, rank: rank?.term || cf.profile.forces?.rank || null, years: mil.years || cf.profile.forces?.years || null };
    }
    found = found.filter((x) => proven(x, text));
    // Someone with a job now ("I work at ServiceFirst…") gets the Job Risk Radar offered.
    const job = detectJob(text, cat);
    if (job && !cf.profile.job) cf.profile.job = job;
    // Rules double-check what the AI may have missed (and do all the work when the AI is offline).
    merge(cf.profile, rules.profile);
    merge(cf.prefs, rules.prefs);

    const before = cf.skills.length;
    const seen = new Set(knownNames);
    const fresh = found.filter((x) => !seen.has(x.skill) && seen.add(x.skill));
    cf.skills.push(...fresh);
    cf.interviewStep = (cf.interviewStep || 0) + 1;
    const fixedQuestion = !question;
    if (!question) {
      const i = nextQuestion(cf);
      if (i > 0) { question = isHindi(text) ? QUESTIONS[i].hi : QUESTIONS[i].q; cf.asked = [...asked(cf), i].join(','); }
    }

    // No card while there is nothing to show yet. Counts use SkillSetu's own catalog (SAP jobs are counted by the Market agent).
    const sapJob = (id) => String(id || '').startsWith('5a900000-5a90-');
    const own = new Set(cat.roles.filter((r) => !sapJob(r.ID) && r.type !== 'internal').map((r) => r.ID));
    const base = { ...cat, roles: cat.roles.filter((r) => own.has(r.ID)), roleSkills: cat.roleSkills.filter((rs) => own.has(rs.role_ID)) };
    const card = cf.skills.length ? { type: 'skills', skills: explainSkills(cf.skills.map((s) => ({ ...s, isNew: fresh.some((f) => f.skill === s.skill) })), base),
      jobsOpened: jobsOpened(cf.skills, base), totalJobs: base.roles.length, source: res ? 'ai' : 'keywords', provider: res?.provider, model: res?.model } : null;
    const lead = ack || (fresh.length ? say.found(fresh.length, fresh.map((f) => label(f.skill)).join(', '))
      : cf.skills.length ? say.none : say.first);

    const enough = cf.skills.length >= ENOUGH_SKILLS || cf.interviewStep >= QUESTIONS.length - 1;
    const justEnough = enough && before < ENOUGH_SKILLS;
    const replies = [];
    if (mil) {
      const jobs = [...new Set(mil.rows.flatMap((r) => r.jobs || []))].slice(0, 6);
      const hiMil = isHindi(text);
      replies.push({ text: hiMil ? 'आपकी फ़ौज की सेवा को कंपनियाँ इन शब्दों में समझती हैं:' : 'Here’s your service in the words civilian employers use:',
        card: { type: 'military', service: cf.profile.forces.service, years: cf.profile.forces.years,
          rows: mil.rows.map((r) => ({ term: r.term, kind: r.kind, civilian: r.civilian, detail: r.detail, skills: r.skills.filter((x) => allowed.includes(x)).map(label), quote: r.quote })), jobs } });
    }
    replies.push({ text: lead, card });
    // The AI writes its question in the person's language, so the fixed (English/Hindi) lead-in only goes before fixed questions.
    if (question && cf.interviewStep < QUESTIONS.length) replies.push({ text: (justEnough && fixedQuestion ? say.enough : '') + question });
    else if (!question) replies.push({ text: say.clear });

    return {
      replies,
      ai: res && { provider: res.provider, model: res.model, ms: res.ms },
      note: `${fresh.length} new skill${fresh.length === 1 ? "" : "s"}, ${cf.skills.length} on file`,
      suggestions: [
        ...(cf.profile.job && !cf.watch?.on && cf.skills.length ? [{ label: isHindi(text) ? 'क्या मेरी नौकरी AI से सुरक्षित है?' : 'Is my job safe from AI?', intent: 'shield' }] : []),
        ...(enough ? [{ label: say.jobs, intent: 'market' }, { label: say.flexible, intent: 'matching' }]
          : cf.skills.length ? [{ label: say.stop, intent: 'market' }] : [])]
    };
  }
};

function wrapUp(cf, cat, text) {
  return {
    replies: [{ text, card: cf.skills.length ? { type: 'skills', skills: explainSkills(cf.skills, cat), jobsOpened: jobsOpened(cf.skills, cat), totalJobs: cat.roles.length, source: 'file' } : null }],
    suggestions: cf.skills.length ? [{ label: 'Show jobs that fit me', intent: 'market' }] : [],
    note: 'summary'
  };
}
const num = (v) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : null);
function merge(target, src) { for (const [k, v] of Object.entries(src)) if (v !== null && v !== undefined && target[k] == null) target[k] = v; }

module.exports.QUESTIONS = QUESTIONS;
