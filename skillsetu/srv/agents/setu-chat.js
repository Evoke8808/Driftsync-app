// Setu in conversation: answers greetings, thanks, questions about SkillSetu and follow-up questions in plain chat,
// so the person can talk to it like any chat assistant. It may only use facts from the case file and the catalog
// (skills, matches, plan, status), never invents jobs or numbers, and points to the right specialist when one is needed.
const cds = require('@sap/cds');
const ai = require('../ai');
const { db, rankRoles, label, isHindi, roleInText } = require('./lib');

const NEXT = {
  skills: ['Tell you more about my work', 'Add more of my story'],
  market: ['Show jobs that fit me', 'Show jobs that fit me'],
  pathway: ['Make my learning plan', 'Make my learning plan'],
  matching: ['Part-time or remote work', 'Part-time or remote work'],
  readiness: ['Will a filter reject me?', 'Will a filter reject me?'],
  human: ['Send my case to a counsellor', 'Send my case to a counsellor'],
  shield: ['Is my job safe from AI?', 'Is my job safe from AI?'],
  explain: ['Why wasn’t I selected?', 'Why wasn’t I selected?']
};
const HI_NEXT = { skills: 'अपने काम के बारे में और बताऊँ', market: 'मेरे लिए नौकरियाँ दिखाओ', pathway: 'मेरा सीखने का प्लान बनाओ', matching: 'पार्ट-टाइम या घर से काम',
  readiness: 'क्या फ़िल्टर मुझे रिजेक्ट करेगा?', human: 'मेरा केस काउंसलर को भेजो', shield: 'क्या मेरी नौकरी सुरक्षित है?', explain: 'मुझे क्यों नहीं चुना गया?' };

const HINGLISH = /\b(aap|aapka|aapki|kya|hai|hain|kis|kaam|baat|mujhe|nahi|aur|bhi|ke liye|main|hoon|tum|kaun|kaise|accha|theek)\b/i;

const SYSTEM = 'You are Setu, the guide of SkillSetu, a skills-first career service in India for people résumé filters usually reject ' +
  '(women returning after a break, workers displaced by automation, people with disabilities, ex-servicemen). ' +
  'Talk like a friendly, clear chat assistant: 1 to 4 short sentences. In Hindi or Hinglish, Setu uses feminine verb forms (kar sakti hoon, करूँगी). ' +
  'Use ONLY the facts given in the context. Never invent jobs, companies, salaries, percentages, courses or promises. ' +
  'If they ask what you can do, explain briefly: find their skills from their story, show fair job matches (including live SAP SuccessFactors jobs), make a free learning plan, check what a résumé filter would reject them for, check if their job is at risk from AI, and send their case to a human counsellor. ' +
  'If answering well needs a specialist, say so in one sentence and name the next step. No praise filler (wonderful, amazing, impressive). ' +
  'Return JSON only: {"reply":"<your answer>","next":["<up to 2 of: skills, market, pathway, matching, readiness, human, shield, explain>"]}';

module.exports = {
  id: 'chat',
  name: 'Setu',
  icon: '🌉',
  describe: 'Setu itself, in conversation: greetings, thanks, small talk, questions about SkillSetu or how it works, explaining a skill, job, course or an earlier answer, comparing the person\'s own matches (which pays most, which is safest, which is nearest), and anything that does not need a new search, plan or check.',

  async run(ctx) {
    const { cf, cat, message, log, aiInfo } = ctx;
    const hi = isHindi(cf, message);
    const names = cf.skills.map((s) => s.skill);
    const top = names.length ? rankRoles(names, cat).filter((m) => !String(m.role.ID).startsWith('5a900000-5a90-') && m.role.type !== 'internal').slice(0, 3) : [];
    const target = cf.targetRole_ID && cat.roles.find((r) => r.ID === cf.targetRole_ID);
    // A job the person asks about: its description and skills, so Setu can explain what the work is.
    const askedRole = roleInText(message, cat);
    const askedSkills = askedRole ? cat.roleSkills.filter((rs) => rs.role_ID === askedRole.ID).map((rs) => cat.skills.find((k) => k.ID === rs.skill_ID)?.name).filter(Boolean) : [];
    const have = new Set(names);
    let recent = [];
    try { recent = await SELECT.from(db().ChatMessages).columns('role', 'text').where({ caseFile_ID: cf.ID }).orderBy('seq desc').limit(6); } catch (e) { /* new case: no history yet */ }
    const context = [
      `Skills on file: ${names.length ? cf.skills.map((s) => `${label(s.skill)} (proof: "${String(s.reason || '').slice(0, 80)}")`).join('; ') : 'none yet'}.`,
      `Top matches: ${top.length ? top.map((m) => `${m.role.title} at ${m.role.company}, ${m.matchPercent}% match, ${m.role.salary}, ${m.role.type}, automation risk ${m.role.automationRisk}`).join('; ') : 'none yet'}.`,
      (askedRole ? `Job the person is asking about: ${askedRole.title} at ${askedRole.company}, ${askedRole.location}, ${askedRole.salary}, ${askedRole.type}. Description: ${String(askedRole.description || '').slice(0, 400)}. Skills it needs: ${askedSkills.map((n) => `${label(n)}${have.has(n) ? ' (they have it)' : ' (missing)'}`).join(', ') || 'not listed'}. Explain in plain words what this job involves day to day, using the description and skills, then say which of their skills fit and what is missing.\n` : '') +
      `Target job: ${target ? target.title : 'not chosen'}. Learning plan: ${cf.plan ? `${cf.plan.roleTitle}, ${cf.plan.steps?.length || 0} course(s), about ${cf.plan.totalHours} hours` : 'not made'}.`,
      (cf.profile?.company?.connected ? `Connected company data (from the Company MCP): ${cf.profile.company.title} in ${cf.profile.company.department} at ${cf.profile.company.name}, ${cf.profile.company.years} years. Projects: ${(cf.profile.company.projects || []).map((p) => `${p.name}: ${p.detail}`).join(' | ')}. Open roles inside ${cf.profile.company.name}: ${cat.roles.filter((r) => r.type === 'internal' && r.company === cf.profile.company.name).map((r) => r.title).join(', ') || 'none loaded yet'}.` : 'Company data: not connected.') + '\n' +
      `Counsellor review: ${cf.status}. Work preference: ${[cf.prefs?.type, cf.prefs?.location].filter(Boolean).join(', ') || 'not given'}.`,
      `Catalog: ${cat.roles.filter((r) => !String(r.ID).startsWith('5a900000-5a90-')).length} jobs, ${cat.skills.length} skills, ${cat.courses.length} free courses.`,
      `Recent chat (newest last):\n${recent.reverse().map((m) => `${m.role === 'user' ? 'Person' : 'SkillSetu'}: ${String(m.text || '').slice(0, 300)}`).join('\n')}`
    ].join('\n');

    // Reply in the person's language, decided here so a plain "hi" never gets a Hinglish answer.
    const msg = String(message || '');
    const lang = /[\u0900-\u097F]/.test(msg) ? 'Hindi in Devanagari script' : HINGLISH.test(msg) ? 'Hinglish (Hindi written in Latin letters)' : 'English';
    const res = await ai.askJson(SYSTEM, `Context:\n${context}\n\nReply in: ${lang}.\nPerson says: ${msg.slice(0, 1500)}`, { log, temperature: 0.4, info: aiInfo });
    let reply = typeof res?.data?.reply === 'string' ? res.data.reply.trim().slice(0, 800) : '';
    const end = Math.max(reply.lastIndexOf('.'), reply.lastIndexOf('?'), reply.lastIndexOf('!'), reply.lastIndexOf('।'));
    if (end > 0) reply = reply.slice(0, end + 1);   // drop stray words after the last sentence
    if (lang === 'English' && HINGLISH.test(reply)) reply = '';   // wrong language: use the rule answer below
    // Next steps that fit the case; "why not" and "job risk" only when the person talks about those.
    const allowed = (n) => NEXT[n] && n !== 'skills' && (!['explain', 'shield'].includes(n) || (n === 'explain' ? /reject|select|why/i : /job|risk|safe|replace/i).test(msg));
    // Before there are any skills, the next step is telling the story, so no buttons yet.
    let next = names.length ? (Array.isArray(res?.data?.next) ? res.data.next : []).filter(allowed).slice(0, 2) : [];

    if (!reply) {   // No AI: a short, honest answer by rules.
      const t = String(message || '').toLowerCase();
      if (/thank|shukriya|dhanyavad|धन्यवाद|शुक्रिया/.test(t)) reply = hi ? 'आपका स्वागत है! आगे क्या करना है, बताइए।' : 'You’re welcome! Tell me what you’d like to do next.';
      else if (/^(hi|hello|hey|namaste|namaskar)\b|नमस्ते/.test(t)) reply = hi ? 'नमस्ते! मैं सेतु हूँ। अपने काम के बारे में बताइए, मैं उसे हुनर और नौकरियों में बदल दूँगी।' : 'Hi, I’m Setu! Tell me about your work, paid or unpaid, and I’ll turn it into skills and fair job matches.';
      else reply = hi ? 'मैं आपके हुनर ढूँढ सकती हूँ, नौकरियाँ दिखा सकती हूँ, मुफ़्त सीखने का प्लान बना सकती हूँ और आपका केस काउंसलर को भेज सकती हूँ।'
        : 'I can find your skills from your story, show jobs that fit, make a free learning plan, check what a résumé filter would reject you for, and send your case to a counsellor.';
    }
    if (!next.length) next = names.length ? (cf.plan ? ['matching', 'human'] : ['market', 'pathway']) : [];

    return {
      replies: [{ text: reply }],
      note: res ? `answered in chat${next.length ? `; suggested ${next.join(', ')}` : ''}` : 'answered by rules (AI unavailable)',
      ai: res && { provider: res.provider, model: res.model, ms: res.ms },
      // Story answers are typed, not clicked, so "skills" gets no button.
      suggestions: next.filter((n) => n !== 'skills').map((n) => ({ label: hi ? HI_NEXT[n] : NEXT[n][0], intent: n }))
    };
  }
};
