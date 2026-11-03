// Agent 3: Learning Pathway. The shortest set of short courses that closes the gap to one target role.
// Required skills first, then preferred; one course per skill, beginner level first. Code only.
const { rankRoles, roleInText, hours, label, isHindi, keywordSkills } = require('./lib');

const HOURS_PER_WEEK = 5;
const an = (t) => (/^[aeiou]/i.test(t) ? 'an ' : 'a ') + t;
const LEVEL = { beginner: 0, intermediate: 1, advanced: 2 };

module.exports = {
  id: 'pathway',
  name: 'Learning Pathway',
  icon: '🎓',
  describe: 'Builds the shortest course plan to close skill gaps for a target role. Use for questions about courses, learning, training, study plans or skill gaps.',

  async run(ctx) {
    const { cf, cat, message, roleID } = ctx;
    const ranked = rankRoles(cf.skills.map((s) => s.skill), cat);
    // A job the person names ("plan for event planner"), matched on its title, not just one word of it.
    const namedRole = roleInText(message, cat);
    const named = namedRole && ranked.find((m) => m.role.ID === namedRole.ID);
    const pick = ranked.find((m) => m.role.ID === roleID) || named || ranked.find((m) => m.role.ID === cf.targetRole_ID) || ranked[0];
    cf.targetRole_ID = pick.role.ID;

    // Already fully qualified? Then the plan is for the next role to grow into (better pay or more openings).
    const ready = pick.missingSkills.length === 0;
    const grow = ready && ranked.find((m) => m.role.ID !== pick.role.ID && m.missingSkills.length > 0 && m.matchPercent >= 33);
    const goal = grow || pick;

    const steps = [...goal.missingSkills]
      .sort((a, b) => (a.importance === 'required' ? 0 : 1) - (b.importance === 'required' ? 0 : 1))
      .map((s) => {
        const course = [...s.courses].sort((a, b) => (LEVEL[a.level] ?? 3) - (LEVEL[b.level] ?? 3) || hours(a.duration) - hours(b.duration))[0];
        return course && { skill: s.name, importance: s.importance, course: { title: course.title, provider: course.provider, url: course.url, duration: course.duration, level: course.level } };
      }).filter(Boolean);
    // "I want to learn Excel": a skill the person asks for comes first, even if the role doesn't need it.
    const have = cf.skills.map((s) => s.skill);
    const wanted = [...new Set(keywordSkills(message || '').map((k) => k.skill))].filter((n) => !have.includes(n) && !steps.some((s) => s.skill === n));
    const extra = wanted.map((n) => {
      const sk = cat.skills.find((s) => s.name === n);
      const course = sk && cat.courses.filter((c) => c.skill_ID === sk.ID).sort((a, b) => (LEVEL[a.level] ?? 3) - (LEVEL[b.level] ?? 3))[0];
      return course && { skill: n, importance: 'requested', course: { title: course.title, provider: course.provider, url: course.url, duration: course.duration, level: course.level } };
    }).filter(Boolean);
    steps.unshift(...extra);
    const total = steps.reduce((a, s) => a + hours(s.course.duration), 0);
    const weeks = total ? Math.ceil(total / HOURS_PER_WEEK) : 0;
    cf.plan = { roleID: goal.role.ID, roleTitle: goal.role.title, steps, totalHours: total, weeks, matchToday: goal.matchPercent, readyFor: ready ? pick.role.title : null };

    const hi = isHindi(cf, message);
    const planText = hi ? `इस प्लान में लगभग ${total} घंटे लगेंगे, यानी हफ़्ते में ${HOURS_PER_WEEK} घंटे देकर करीब ${weeks} हफ़्ते। सभी कोर्स मुफ़्त हैं और फ़ोन पर हो सकते हैं।` : `This plan takes about ${total} hours, roughly ${weeks} week${weeks === 1 ? '' : 's'} at ${HOURS_PER_WEEK} hours a week, all free and phone-friendly.`;
    const text = hi ? (!ready
      ? `${pick.role.title} बनने के लिए आपको ${steps.length - extra.length} हुनर और चाहिए। ${planText}`
      : grow
        ? `${pick.role.title} के लिए ज़रूरी सभी हुनर आपके पास हैं, आप आज ही आवेदन कर सकते हैं। आगे बढ़ने के लिए: ${grow.role.title} (${grow.role.salary}) के ${grow.matchPercent}% हुनर आपके पास पहले से हैं। ${planText}`
        : `${pick.role.title} के लिए ज़रूरी सभी हुनर आपके पास हैं। कोई कोर्स नहीं चाहिए, आप अभी आवेदन कर सकते हैं।`)
      : !ready
      ? `To become ${an(pick.role.title)} you’re missing ${steps.length - extra.length} skill${steps.length - extra.length > 1 ? 's' : ''}. ${planText}`
      : grow
        ? `You already have every skill ${an(pick.role.title)} needs, so you can apply today. To grow from there, you already have ${grow.matchPercent}% of the skills for ${an(grow.role.title)} (${grow.role.salary}). ${planText}`
        : `You already have every skill ${an(pick.role.title)} needs. No course needed, you can apply now.`;

    const asked = extra.length ? (hi ? ` आपके कहने पर मैंने ${extra.map((e) => label(e.skill)).join(', ')} का कोर्स सबसे पहले रखा है।` : ` As you asked, I put a course for ${extra.map((e) => label(e.skill)).join(', ')} first.`) : '';
    return {
      replies: [{ text: text + asked, card: { type: 'path', role: { ID: goal.role.ID, title: goal.role.title, company: goal.role.company, location: goal.role.location, salary: goal.role.salary },
        matchPercent: goal.matchPercent, steps, totalHours: total, weeks, readyFor: ready ? pick.role.title : null } }],
      note: `${grow ? pick.role.title + ' ready; growth plan for ' + grow.role.title : goal.role.title}: ${steps.length} course${steps.length === 1 ? "" : "s"}, ${total}h`,
      suggestions: [
        { label: hi ? 'मेरा प्लान काउंसलर को भेजो' : 'Send my plan to a counsellor', intent: 'human' },
        { label: hi ? 'क्या फ़िल्टर मुझे रिजेक्ट करेगा?' : 'Will a filter reject me?', intent: 'readiness' },
        { label: hi ? 'अभी कौन सी नौकरियाँ मिल सकती हैं' : 'Jobs I can apply to now', intent: 'matching' }
      ]
    };
  }
};
