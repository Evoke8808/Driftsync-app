// Agent 9: After-Hire Companion. Inclusion doesn't end at the offer letter: people who were out of work are
// the most likely to drop out in the first months. Once someone is hired, this agent sets check-ins
// (day 7, 30 and 90), shows the next step up, and keeps watching for better or safer roles (see watch.js).
const { matchRoles, rankRoles, roleInText, RISK_RANK, shortestCourse, hours, salaryTop, label, isHindi, caseCode, today, daysBetween } = require('./lib');
const { emit } = require('../integrations/webhooks');
const { queue } = require('./outbox');

const GOT_JOB = /\b(got|landed|accepted|joined|start(ed|ing)?)\s+(the |a |my |that |this |an )?(job|offer|role|position)\b|\bi(?:'?m| am| was| have been| got)\s+(hired|selected|placed)\b|\bgot (selected|hired|placed)\b|\b(naukri|job)\s+mil\s+(gayi|gai|gaya)\b|नौकरी मिल (गई|गयी)|(चयन|सिलेक्शन) हो गया/i;

const CHECKINS = [
  { day: 7, en: 'Week 1: how is it going? Is anything making work hard, like timings, travel or accessibility?', hi: 'पहला हफ़्ता: काम कैसा चल रहा है? समय, आने-जाने या सुविधा में कोई दिक्कत?' },
  { day: 30, en: 'Month 1: is the job what was promised (pay, hours, work)? Any problem you want help with?', hi: 'पहला महीना: क्या नौकरी वैसी ही है जैसा बताया गया था (तनख्वाह, घंटे, काम)?' },
  { day: 90, en: 'Month 3: you’ve settled in. Time to plan your next step up.', hi: 'तीसरा महीना: अब अगले कदम की तैयारी का समय है।' }
];

// The next step up: better pay and no more automation risk, inside the same company first.
function nextSteps(names, role, cat) {
  return matchRoles(names, cat)
    .filter((m) => m.role.ID !== role.ID && salaryTop(m.role.salary) > salaryTop(role.salary) && RISK_RANK[m.role.automationRisk] <= RISK_RANK[role.automationRisk] && m.matchPercent >= 50)
    .sort((a, b) => (b.role.company === role.company) - (a.role.company === role.company) || b.matchPercent - a.matchPercent || salaryTop(b.role.salary) - salaryTop(a.role.salary))
    .slice(0, 2)
    .map((m) => {
      const gaps = m.missingSkills.map((s) => ({ skill: s.name, course: shortestCourse(s.courses) }));
      return { ID: m.role.ID, title: m.role.title, company: m.role.company, salary: m.role.salary, risk: m.role.automationRisk, matchPercent: m.matchPercent,
        sameCompany: m.role.company === role.company, missing: gaps.map((g) => g.skill), courses: gaps.filter((g) => g.course).map((g) => g.course.title),
        hours: gaps.reduce((n, g) => n + hours(g.course?.duration), 0) };
    });
}

module.exports = {
  id: 'growth',
  name: 'After-Hire Companion',
  icon: '🌱',
  describe: 'Stays with the person after they get a job: records the hire, schedules check-ins at day 7, 30 and 90, shows the next step up (promotion, better pay, safer role) and watches for better matches. Use when the person says they got or joined a job, or asks about growth, promotion, a raise or what to do next in their job.',
  CHECKINS, nextSteps, GOT_JOB,

  async run(ctx) {
    const { cf, cat, message, roleID, extra } = ctx;
    const hi = isHindi(cf, message);
    const hiredNow = GOT_JOB.test(message || '') || extra?.hired || (roleID && !cf.watch?.hiredAt);
    let job = cf.profile.job;

    if (hiredNow) {
      const role = cat.roles.find((r) => r.ID === roleID) || roleInText(message, cat) || cat.roles.find((r) => r.ID === cf.targetRole_ID) || cat.roles.find((r) => r.ID === cf.plan?.roleID);
      if (!role) {
        const top = rankRoles(cf.skills.map((s) => s.skill), cat).slice(0, 3);
        return { replies: [{ text: hi ? 'बधाई हो! 🎉 कौन-सी नौकरी मिली?' : 'Congratulations! 🎉 Which job did you get?' }], note: 'asked which job',
          suggestions: top.map((m) => ({ label: hi ? `${m.role.title}, ${m.role.company}` : `${m.role.title} at ${m.role.company}`, intent: 'growth', roleID: m.role.ID })) };
      }
      job = { roleID: role.ID, title: role.title, company: role.company };
      cf.profile.job = job;
      cf.targetRole_ID = role.ID;
      cf.watch = { ...(cf.watch || {}), on: true, since: cf.watch?.since || today(), hiredAt: today(), jobID: role.ID, riskSeen: role.automationRisk, alerted: cf.watch?.alerted || [] };
      emit('case.hired', { caseID: cf.ID, code: caseCode(cf.ID), role: role.title, company: role.company, by: extra?.hired || 'person' });
    }
    if (!job) {
      return { replies: [{ text: hi ? 'नौकरी मिलते ही मुझे बताइए, मैं आपके साथ आगे बढ़ने का प्लान बनाऊँगी। अभी के लिए, ये रहीं आपके लिए नौकरियाँ।' : 'Tell me when you get a job and I’ll stay with you to plan your growth. For now, let’s find you one.' }],
        note: 'no job yet', next: 'matching', suggestions: [{ label: hi ? 'मेरे लिए नौकरियाँ' : 'Show jobs that fit me', intent: 'market' }] };
    }

    const role = cat.roles.find((r) => r.ID === job.roleID);
    const names = cf.skills.map((s) => s.skill);
    const steps = nextSteps(names, role, cat);
    const hiredAt = cf.watch?.hiredAt || today();
    const done = new Set((cf.watch?.alerted || []).filter((k) => k.startsWith('checkin:')).map((k) => +k.split(':')[1]));
    const checkins = CHECKINS.map((c) => ({ day: c.day, text: hi ? c.hi : c.en, due: new Date(Date.parse(hiredAt) + c.day * 86400000).toISOString().slice(0, 10), done: done.has(c.day) }));
    const n = steps[0];

    if (hiredNow) {
      await queue(cf.ID, 'hired', `You’re hired at ${role.company}! Here’s what happens next`,
        `Congratulations on your new job as ${role.title}. SkillSetu will check in on day 7, 30 and 90.` +
        (n ? ` Your next step up: ${n.title}${n.sameCompany ? ' in the same company' : ` at ${n.company}`} (${n.salary})${n.missing.length ? `, after learning ${n.missing.map(label).join(', ')} (about ${n.hours} hours)` : ''}.` : '') +
        ' Reply any time if something at work is making it hard to stay.');
    }

    let text;
    if (hi) text = (hiredNow ? `बधाई हो! 🎉 ${role.company} में ${role.title}। ` : `आप ${role.company} में ${role.title} हैं। `) +
      'मैं 7, 30 और 90 दिन पर आपसे हाल पूछूँगी, ताकि कोई दिक्कत हो तो समय पर मदद मिले।' +
      (n ? ` अगला कदम: ${n.title}${n.sameCompany ? ' (इसी कंपनी में)' : `, ${n.company}`}, ${n.salary}${n.missing.length ? `, बस ${n.missing.map(label).join(', ')} सीखना है (करीब ${n.hours} घंटे)` : ', और आप अभी तैयार हैं'}।` : '') +
      ' बेहतर या ज़्यादा सुरक्षित नौकरी दिखते ही मैं आपको बताऊँगी।';
    else text = (hiredNow ? `Congratulations! 🎉 ${role.title} at ${role.company}. ` : `You work as ${role.title} at ${role.company}. `) +
      'I’ll check in on day 7, 30 and 90, so if something makes work hard you get help before it’s too late.' +
      (n ? ` Your next step up: ${n.title}${n.sameCompany ? ' in the same company' : ` at ${n.company}`} (${n.salary})${n.missing.length ? `, after learning ${n.missing.map(label).join(', ')} (about ${n.hours} hours)` : ', and you’re ready for it now'}.` : '') +
      ' I’ll also tell you when a better or safer job matches you.';

    return {
      replies: [{ text, card: { type: 'growth', job: { title: role.title, company: role.company, salary: role.salary, risk: role.automationRisk },
        hiredAt, sinceDays: daysBetween(hiredAt, today()), checkins, next: steps, watching: true } }],
      note: `${hiredNow ? 'hired: ' : ''}${role.title} at ${role.company}; ${steps.length} next step${steps.length === 1 ? '' : 's'}; check-ins day 7/30/90`,
      suggestions: n ? [{ label: hi ? `${n.title} के लिए प्लान` : `Plan for ${n.title}`, intent: 'pathway', roleID: n.ID }, { label: hi ? 'क्या मेरी नौकरी सुरक्षित है?' : 'Is my job safe from AI?', intent: 'shield' }]
        : [{ label: hi ? 'क्या मेरी नौकरी सुरक्षित है?' : 'Is my job safe from AI?', intent: 'shield' }]
    };
  }
};
