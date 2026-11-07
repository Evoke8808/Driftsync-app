// Agent 7: Why-Not Explainer. Most hiring tools give a yes/no fit score. This agent explains a "no":
// which skills were missing, whether an unfair résumé filter caused it, whether the job itself didn't fit
// (hours, city), and the smallest change that would turn it into a "yes". Pure code, so every reason is checkable.
const { rankRoles, biasAudit, personBarriers, roleInText, shortestCourse, hours, label, isHindi, caseCode, PASS_MATCH } = require('./lib');
const { emit } = require('../integrations/webhooks');

const HI_BARRIER = [[/career gap of (\d+) years/, '$1 साल का करियर गैप'], [/^age (\d+)/, 'उम्र $1'], [/no degree/, 'डिग्री नहीं'],
  [/college not on the shortlist/, 'कॉलेज शॉर्टलिस्ट में नहीं'], [/past job title lacks keywords/, 'पुरानी नौकरी के नाम में कीवर्ड नहीं'],
  [/online test is not accessible/, 'ऑनलाइन टेस्ट सुलभ नहीं'], [/^military rank "(.+)" is not in the job's keywords$/, 'फ़ौज का पद "$1" नौकरी के कीवर्ड में नहीं']];
const toHindi = (b) => HI_BARRIER.reduce((s, [re, to]) => s.replace(re, to), b);

// Does the job itself fit how the person can work?
function fitIssues(role, prefs, hi) {
  const out = [];
  const remoteJob = role.location === 'Remote' || role.type === 'remote';
  if (prefs.type === 'part-time' && role.type === 'full-time')
    out.push(hi ? 'यह फुल-टाइम नौकरी है, आपने पार्ट-टाइम माँगा था।' : 'This is a full-time job, and you asked for part-time work.');
  if (prefs.remote === true && !remoteJob)
    out.push(hi ? `यह ${role.location} के ऑफ़िस में है, आपने घर से काम माँगा था।` : `This job is in an office in ${role.location}, and you asked for remote work.`);
  else if (prefs.location && !remoteJob && role.location.toLowerCase() !== prefs.location.toLowerCase())
    out.push(hi ? `यह नौकरी ${role.location} में है, आप ${prefs.location} में काम चाहते हैं।` : `This job is in ${role.location}, and you want work in ${prefs.location}.`);
  return out;
}

// The smallest set of skills that gets the person over the bar: every required skill, then the quickest preferred ones.
function smallestFix(m, total) {
  const gaps = m.missingSkills.map((s) => ({ skill: s.name, importance: s.importance, course: shortestCourse(s.courses) }))
    .sort((a, b) => (a.importance === 'required' ? 0 : 1) - (b.importance === 'required' ? 0 : 1) || hours(a.course?.duration) - hours(b.course?.duration));
  const pick = [];
  let have = m.matchedSkills.length;
  for (const g of gaps) {
    const pct = total ? Math.round((have / total) * 100) : 0;
    const requiredLeft = gaps.some((x) => x.importance === 'required' && !pick.includes(x));
    if (pct >= PASS_MATCH && !requiredLeft) break;
    pick.push(g); have++;
  }
  if (!pick.length) return null;
  return {
    skills: pick.map((g) => ({ skill: g.skill, importance: g.importance,
      course: g.course && { title: g.course.title, provider: g.course.provider, duration: g.course.duration, url: g.course.url } })),
    hours: pick.reduce((n, g) => n + hours(g.course?.duration), 0),
    newPercent: total ? Math.round((have / total) * 100) : 0
  };
}

module.exports = {
  id: 'explain',
  name: 'Why-Not Explainer',
  icon: '💡',
  describe: 'Explains why the person was not selected (or would not be) for a specific job: missing skills, an unfair résumé filter, or a job that does not fit their hours or city, plus the smallest change that would get them selected. Use when the person asks why they were rejected, not shortlisted, or did not get a job.',

  async run(ctx) {
    const { cf, cat, message, roleID } = ctx;
    const hi = isHindi(cf, message);
    const ranked = rankRoles(cf.skills.map((s) => s.skill), cat);
    const named = roleInText(message, cat);
    const m = ranked.find((x) => x.role.ID === roleID) || (named && ranked.find((x) => x.role.ID === named.ID))
      || ranked.find((x) => x.role.ID === cf.targetRole_ID) || ranked.find((x) => x.matchPercent < 100) || ranked[0];
    const role = m.role;
    const total = m.matchedSkills.length + m.missingSkills.length;
    const requiredMissing = m.missingSkills.filter((s) => s.importance === 'required');
    const skillsPass = m.matchPercent >= PASS_MATCH && !requiredMissing.length;
    const barriers = personBarriers(cf.profile);
    const fit = fitIssues(role, cf.prefs || {}, hi);
    const fix = skillsPass ? null : smallestFix(m, total);
    const flagged = skillsPass && barriers.length > 0;
    let audit = null;
    if (barriers.length) {
      const a = await biasAudit(role.ID);
      audit = { rejected: a.summary.qualifiedRejectedByResumeFilter, qualified: a.summary.qualified, failing: a.summary.resumeFilterFailingGroups, groups: a.groups.length };
    }
    if (flagged) emit('case.unfair_rejection', { caseID: cf.ID, code: caseCode(cf.ID), role: role.title, company: role.company, matchPercent: m.matchPercent, barriers });

    const B = barriers.map((b) => (hi ? toHindi(b) : b)).join(', ');
    const miss = m.missingSkills.map((s) => label(s.name) + (s.importance === 'required' ? (hi ? ' (ज़रूरी)' : ' (required)') : '')).join(', ');
    let text;
    if (hi) {
      if (flagged) text = `हुनर के हिसाब से आप ${role.title} के लिए पास हैं (${m.matchPercent}%, पास होने के लिए ${PASS_MATCH}% चाहिए)। तो अगर आपको मना किया गया, तो वजह शायद रिज़्यूमे फ़िल्टर था, आप नहीं: ${B}। मैंने यह आपके काउंसलर को बता दिया है ताकि वे ${role.company} से हुनर के आधार पर दोबारा देखने को कहें।`;
      else if (skillsPass) text = `हुनर के हिसाब से आप ${role.title} के लिए पास हैं (${m.matchPercent}%)। ` + (fit.length ? `दिक्कत नौकरी में है: ${fit[0]}` : 'कोई फ़िल्टर नियम भी आपको नहीं रोकता। अगर फिर भी मना हुआ, तो वजह शायद मुकाबला या समय था, कोई कमी नहीं।');
      else text = `मुख्य वजह हुनर है: ${role.title} के ${total} में से ${m.matchedSkills.length} हुनर आपके पास हैं (${m.matchPercent}%, पास होने के लिए ${PASS_MATCH}%)। कमी: ${miss}।` +
        (fix ? ` ${fix.hours} घंटे के छोटे कोर्स से आप ${fix.newPercent}% पर पहुँचकर पास हो जाएँगे।` : '') + (barriers.length ? ` रिज़्यूमे फ़िल्टर इन बातों को भी आपके खिलाफ़ गिनता: ${B}। ये हुनर नहीं हैं, इसलिए SkillSetu इन्हें नहीं गिनता।` : '');
    } else {
      if (flagged) text = `On skills you clear the bar for ${role.title} (${m.matchPercent}%, the bar is ${PASS_MATCH}%). So if you were turned down, the likely reason is a résumé filter, not you: ${B}. I’ve flagged this to your counsellor so they can ask ${role.company} for a skills-based review.`;
      else if (skillsPass) text = `On skills you clear the bar for ${role.title} (${m.matchPercent}%). ` + (fit.length ? `The mismatch is the job itself: ${fit[0]}` : 'No filter rule would block you either. If you still heard no, it was most likely competition or timing, not a gap in you.');
      else text = `The main reason is skills: you have ${m.matchedSkills.length} of the ${total} skills ${role.title} asks for (${m.matchPercent}%, the bar is ${PASS_MATCH}%). Missing: ${miss}.` +
        (fix ? ` ${fix.hours} hours of short courses would take you to ${fix.newPercent}% and over the bar.` : '') +
        (barriers.length ? ` A résumé filter would also hold this against you: ${B}. That isn’t a skill, so SkillSetu ignores it.` : '');
    }

    const suggestions = [];
    if (fix) suggestions.push({ label: hi ? `${role.title} के लिए प्लान` : `Plan for ${role.title}`, intent: 'pathway', roleID: role.ID });
    if (flagged) suggestions.push({ label: hi ? 'काउंसलर से इसे चुनौती दिलवाओ' : 'Ask a counsellor to challenge this', intent: 'human' });
    suggestions.push({ label: hi ? 'मेरे लिए बेहतर नौकरियाँ' : 'Jobs I’d pass today', intent: 'matching' });

    return {
      replies: [{ text, card: {
        type: 'whynot', role: { ID: role.ID, title: role.title, company: role.company, location: role.location, type: role.type },
        matchPercent: m.matchPercent, passMark: PASS_MATCH, skillsPass, flagged,
        worked: m.matchedSkills, missing: m.missingSkills.map((s) => ({ skill: s.name, importance: s.importance })),
        barriers, fit, fix, audit } }],
      note: `${role.title}: ${m.matchPercent}% (bar ${PASS_MATCH}%), ${requiredMissing.length} required skill${requiredMissing.length === 1 ? '' : 's'} missing, ${barriers.length} filter barrier${barriers.length === 1 ? '' : 's'}${fit.length ? ', job fit issue' : ''}${flagged ? ', flagged as unfair' : ''}`,
      suggestions
    };
  }
};
