// Agent 8: Job Risk Radar. For people who have a job now. Checks how exposed that job is to automation,
// which of its tasks AI already does well, and finds safer roles: first inside the same company (an internal
// move keeps people employed and saves the employer a hire), then elsewhere. Then it keeps watching.
// Pure code over the role catalog. The person's employer never sees that they asked.
const sapMcp = require('../integrations/sap-mcp-client');
const { matchRoles, detectJob, RISK_RANK, AI_EXPOSURE, shortestCourse, hours, salaryTop, label, isHindi, today } = require('./lib');

const MIN_MATCH = 50;
const HI_RISK = { Low: 'कम', Medium: 'मध्यम', High: 'ज़्यादा' };

// One safer role, with what it takes to get there.
const move = (m) => {
  const gaps = m.missingSkills.map((s) => ({ skill: s.name, course: shortestCourse(s.courses) }));
  return { ID: m.role.ID, title: m.role.title, company: m.role.company, location: m.role.location, salary: m.role.salary, risk: m.role.automationRisk,
    matchPercent: m.matchPercent, missing: gaps.map((g) => g.skill), hours: gaps.reduce((n, g) => n + hours(g.course?.duration), 0) };
};

function startWatch(cf, job, risk) {
  cf.watch = { ...(cf.watch || {}), on: true, since: cf.watch?.since || today(), jobID: job.roleID, riskSeen: cf.watch?.jobID === job.roleID && cf.watch?.riskSeen || risk, alerted: cf.watch?.alerted || [] };
}

module.exports = {
  id: 'shield',
  name: 'Job Risk Radar',
  icon: '📡',
  describe: 'For people who already have a job: checks whether their current job is at risk from automation or AI, shows which tasks are exposed, and finds safer roles, first inside their own company, then elsewhere. Then it keeps watching. Use when the person asks if their job is safe or secure, fears layoffs or being replaced by AI, or wants to move to another team in their company.',
  startWatch,

  async run(ctx) {
    const { cf, cat, message, roleID } = ctx;
    const hi = isHindi(cf, message);
    // The current job: picked with a button, said in this message, or already on file.
    const picked = roleID && cat.roles.find((r) => r.ID === roleID);
    const job = picked ? { roleID: picked.ID, title: picked.title, company: picked.company }
      : detectJob(message, cat) || cf.profile.job || detectJob(cf.story, cat);
    if (!job) {
      const risky = cat.roles.filter((r) => r.automationRisk === 'High').slice(0, 3);
      return {
        replies: [{ text: hi ? 'आप अभी कौन-सा काम करते हैं, और किस कंपनी में? उदाहरण: "मैं ServiceFirst में कस्टमर सर्विस में काम करती हूँ।"'
          : 'Which job do you do now, and at which company? For example: "I work at ServiceFirst as a customer service representative."' }],
        note: 'asked for the current job',
        suggestions: risky.map((r) => ({ label: hi ? `मैं ${r.company} में ${r.title} हूँ` : `I’m a ${r.title} at ${r.company}`, intent: 'shield', roleID: r.ID }))
      };
    }
    const old = cf.profile.job;
    cf.profile.job = old && old.roleID === job.roleID ? { ...old, company: job.company || old.company } : job;
    job.company = cf.profile.job.company;
    const role = cat.roles.find((r) => r.ID === job.roleID);
    const names = cf.skills.map((s) => s.skill);
    const byId = cat.skillById;

    // Which tasks of this job AI already does well, and which need a person.
    const tasks = cat.roleSkills.filter((rs) => rs.role_ID === role.ID).map((rs) => byId[rs.skill_ID].name);
    const exposed = tasks.filter((t) => AI_EXPOSURE[t] !== 'Low');
    const human = tasks.filter((t) => AI_EXPOSURE[t] === 'Low');
    const carry = names.filter((n) => AI_EXPOSURE[n] === 'Low');

    // Open jobs in SAP SuccessFactors (through the SAP MCP server) join the catalog as roles before matching.
    const sap = await sapMcp.importForSkills(names, cat, { top: 6 });
    // Safer roles: lower automation risk than today, and at least half the skills already.
    const ranked = matchRoles(names, cat).filter((m) => m.role.ID !== role.ID && m.matchPercent >= MIN_MATCH);
    const safer = (m) => RISK_RANK[m.role.automationRisk] < RISK_RANK[role.automationRisk] || (role.automationRisk === 'Low' && m.role.automationRisk === 'Low' && salaryTop(m.role.salary) > salaryTop(role.salary));
    const order = (a, b) => b.matchPercent - a.matchPercent || RISK_RANK[a.role.automationRisk] - RISK_RANK[b.role.automationRisk] || salaryTop(b.role.salary) - salaryTop(a.role.salary);
    const company = job.company;   // null when the person named a job type but not their employer
    const internal = company ? ranked.filter((m) => m.role.company === company && safer(m)).sort(order).slice(0, 3).map(move) : [];
    const external = ranked.filter((m) => m.role.company !== company && !sapMcp.isSapRole(m.role.ID) && safer(m)).sort(order).slice(0, company ? 2 : 3).map(move);
    const sapMoves = ranked.filter((m) => sapMcp.isSapRole(m.role.ID) && safer(m)).sort(order).slice(0, 2).map(move);
    const where = company ? ` at ${company}` : '', whereHi = company ? `${company} में ` : '';
    startWatch(cf, job, role.automationRisk);

    const best = internal[0] || external[0] || sapMoves[0];
    const ready = best && best.matchPercent === 100;
    let text;
    if (hi) {
      text = `${whereHi}आपकी ${role.title} की नौकरी में ऑटोमेशन का खतरा ${HI_RISK[role.automationRisk]} है` +
        (exposed.length ? `: इसके ${tasks.length} में से ${exposed.length} काम (${exposed.map(label).join(', ')}) AI टूल पहले से अच्छे से करते हैं।` : '।') +
        (internal.length ? ` अच्छी बात: आपकी अपनी कंपनी में ${internal[0].title} ज़्यादा सुरक्षित है और आपके पास ${internal[0].matchPercent}% हुनर हैं${internal[0].hours ? `, बाकी ${internal[0].hours} घंटे में` : ', आप अभी तैयार हैं'}।`
          : external.length ? ` ${company ? 'आपकी कंपनी में अभी कोई सुरक्षित पद नहीं दिखा, पर' : 'ज़्यादा सुरक्षित विकल्प:'} ${external[0].company} में ${external[0].title} (${external[0].matchPercent}% मेल)।${company ? '' : ' अपनी कंपनी का नाम बताइए, तो मैं उसके अंदर भी सुरक्षित पद ढूँढूँगी।'}` : '') +
        (sapMoves.length ? ` SAP SuccessFactors में अभी खुली: ${sapMoves[0].title}, ज़्यादा सुरक्षित, ${sapMoves[0].matchPercent}% मेल।` : '') +
        ' मैं नज़र रखूँगी और कुछ बदलते ही बताऊँगी। आपकी कंपनी को पता नहीं चलेगा कि आपने पूछा।';
    } else {
      text = `Your job as ${role.title}${where} has ${role.automationRisk.toLowerCase()} automation risk` +
        (exposed.length ? `: ${exposed.length} of its ${tasks.length} main tasks (${exposed.map(label).join(', ')}) ${exposed.length === 1 ? 'is something' : 'are things'} AI tools already do well.` : '.') +
        (internal.length ? ` The good news: ${internal[0].title} inside ${company} is safer, and you already have ${internal[0].matchPercent}% of its skills${internal[0].hours ? `; the rest takes about ${internal[0].hours} hours` : ', so you could move now'}.`
          : external.length ? ` ${company ? `I found no safer role inside ${company} yet, but` : 'A safer option:'} ${external[0].title} at ${external[0].company}${company ? ' is safer and' : ','} a ${external[0].matchPercent}% match.${company ? '' : ' Tell me your company and I’ll look for safer roles inside it too.'}` : '') +
        (sapMoves.length ? ` Open right now in SAP SuccessFactors: ${sapMoves[0].title}, a safer ${sapMoves[0].matchPercent}% match.` : '') +
        ' I’ll keep watching and tell you if anything changes. Your employer never sees that you asked.';
    }

    const suggestions = [];
    if (best && !ready) suggestions.push({ label: hi ? `${best.title} के लिए प्लान` : `Plan for ${best.title}`, intent: 'pathway', roleID: best.ID });
    // Nobody rejected this person, so the next step is a plan or a counsellor, not the rejection explainer.
    if (best) suggestions.push(internal.length ? { label: hi ? 'काउंसलर से अंदरूनी बदलाव की बात करवाओ' : 'Ask a counsellor about an internal move', intent: 'human' }
      : { label: hi ? 'काउंसलर से बात करवाओ' : 'Talk to a counsellor about a move', intent: 'human' });
    suggestions.push({ label: hi ? 'और सुरक्षित नौकरियाँ' : 'Other safer jobs I fit', intent: 'matching' });

    return {
      replies: [{ text, card: { type: 'shield',
        job: { title: role.title, company, salary: role.salary, risk: role.automationRisk },
        tasks: tasks.length, exposed, human, carry, internal, external, sap: sapMoves, sapSource: sap?.source || null, watching: true } }],
      note: `${role.title}${where}: ${role.automationRisk} risk, ${exposed.length}/${tasks.length} tasks exposed, ${internal.length} internal, ${external.length} outside and ${sapMoves.length} SAP safer roles; watch on`,
      trace: sap ? [sapMcp.traceOf(sap)] : [],
      suggestions
    };
  }
};
