// Agent 5: Bias Audit & Readiness. Checks which résumé-filter rules would reject this person,
// shows the four-fifths audit for their target role, and coaches them (AI writes the tips, rules are the fallback).
const ai = require('../ai');
const { rankRoles, biasAudit, resumeFilterReasons, isHindi } = require('./lib');

const HI_BARRIER = [[/career gap of (\d+) years/, '$1 साल का करियर गैप'], [/^age (\d+)/, 'उम्र $1'], [/no degree/, 'डिग्री नहीं'],
  [/college not on the shortlist/, 'कॉलेज शॉर्टलिस्ट में नहीं'], [/past job title lacks keywords/, 'पुरानी नौकरी के नाम में कीवर्ड नहीं'], [/online test is not accessible/, 'ऑनलाइन टेस्ट सुलभ नहीं'], [/^military rank "(.+)" is not in the job's keywords$/, 'फ़ौज का पद "$1" नौकरी के कीवर्ड में नहीं']];
const toHindi = (b) => HI_BARRIER.reduce((s, [re, to]) => s.replace(re, to), b);

const TIPS = {
  gap: 'Describe your break as work: “Ran a 5-person household for 6 years: budget, schedules, vendors.” SkillSetu never shows the dates to employers.',
  age: 'Lead with recent results and skills; you don’t need to list graduation years.',
  education: 'Short free certificates from SWAYAM or NPTEL prove a skill as well as a degree for these roles.',
  title: 'Rename past jobs by what you did, e.g. “Customer resolution lead (team of 5)” instead of “BPO voice agent”.',
  service: 'Use civilian words for your service, e.g. “Team supervisor, 10 people, stores and duty rosters” instead of “Havildar, ASC”. SkillSetu shows employers the civilian version.',
  access: 'SkillSetu asks employers for an accessible assessment up front, so you don’t have to disclose anything unless you choose to.',
  general: 'Practise telling one story per skill: the situation, what you did, and the result.'
};

module.exports = {
  id: 'readiness',
  name: 'Bias Audit & Readiness',
  icon: '🛡️',
  describe: 'Checks whether résumé filters would unfairly reject the person (career gap, age, degree, job title, accessibility), shows the fairness audit for the role, and coaches them. Use for questions about rejection, bias, fairness, career gaps, CVs or interview readiness.',

  async run(ctx) {
    const { cf, cat, log, aiInfo, message } = ctx;
    const hi = isHindi(cf, message);
    const p = cf.profile || {};
    const barriers = resumeFilterReasons({
      gapYears: p.gapYears, age: p.age, education: p.education,
      titleMatch: p.pastTitle || p.forces ? false : undefined, needsAccommodation: p.needsAccommodation
    }).map((b) => (p.forces && !p.pastTitle && b === 'past job title lacks keywords' ? `military rank "${p.forces.rank || 'service title'}" is not in the job's keywords` : b));
    const ranked = rankRoles(cf.skills.map((s) => s.skill), cat);
    const target = ranked.find((m) => m.role.ID === cf.targetRole_ID) || ranked[0];
    const audit = await biasAudit(target.role.ID);

    const keys = [p.gapYears > 1 && 'gap', p.age > 40 && 'age', p.education === 'none' && 'education', p.pastTitle && 'title', p.forces && 'service', p.needsAccommodation && 'access'].filter(Boolean);
    let tips = (keys.length ? keys : ['general']).map((k) => TIPS[k]);
    const res = await ai.askJson(
      'You are the Readiness coach of SkillSetu. Write exactly 3 short, practical, encouraging tips (max 30 words each) that help this person ' +
      'present their real experience to employers so they are judged on skills, not on gaps, age, college or disability. ' +
      'Use the language and script of their story. Do not invent facts about them. Return JSON only: {"tips":["...","...","..."]}',
      `Story: ${String(cf.story || '').slice(-1500)}\nSkills: ${cf.skills.map((s) => s.skill).join(', ')}\nTarget role: ${target.role.title}\nFilter barriers: ${barriers.join('; ') || 'none found'}`,
      { log, temperature: 0.4, info: aiInfo });
    if (res && Array.isArray(res.data?.tips) && res.data.tips.length) tips = res.data.tips.slice(0, 3).map((t) => String(t).slice(0, 240));

    const s = audit.summary;
    const text = hi ? (barriers.length
      ? `एक आम रिज़्यूमे फ़िल्टर आपको इन वजहों से रिजेक्ट कर सकता है: ${barriers.map(toHindi).join(', ')}। इनमें से कोई भी हुनर नहीं है, इसलिए SkillSetu इन्हें नहीं देखता और ${target.role.title} के लिए आपको ${target.matchPercent}% मेल देता है।`
      : `मुझे ऐसा कुछ नहीं दिखा जिसके लिए रिज़्यूमे फ़िल्टर आम तौर पर रिजेक्ट करे। ${target.role.title} के लिए आपके हुनर ${target.matchPercent}% मेल खाते हैं।`)
      : barriers.length
      ? `A typical résumé filter could reject you for: ${barriers.join(', ')}. None of these are skills, so SkillSetu ignores them and matches you at ${target.matchPercent}% for ${target.role.title}.`
      : `I don’t see anything a résumé filter would usually reject you for. For ${target.role.title} you match ${target.matchPercent}% on skills.`;

    return {
      replies: [{ text, card: { type: 'readiness', barriers, role: target.role.title, matchPercent: target.matchPercent, tips,
        tipsBy: res ? 'ai' : 'rules', provider: res?.provider, model: res?.model,
        audit: { resumeFilterFailingGroups: s.resumeFilterFailingGroups, skillsFirstFailingGroups: s.skillsFirstFailingGroups,
          groups: audit.groups.length, rejected: s.qualifiedRejectedByResumeFilter, qualified: s.qualified } } }],
      ai: res && { provider: res.provider, model: res.model, ms: res.ms },
      note: `${barriers.length} barrier${barriers.length === 1 ? "" : "s"}, audit on ${target.role.title}`,
      suggestions: [
        cf.plan ? { label: hi ? 'मेरा प्लान काउंसलर को भेजो' : 'Send my plan to a counsellor', intent: 'human' }
          : { label: hi ? `${target.role.title} के लिए प्लान` : `Plan for ${target.role.title}`, intent: 'pathway', roleID: target.role.ID },
        { label: hi ? 'अभी कौन सी नौकरियाँ मिल सकती हैं' : 'Jobs I can apply to now', intent: 'matching' }
      ]
    };
  }
};
