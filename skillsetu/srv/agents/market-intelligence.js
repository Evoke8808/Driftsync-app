// Agent 2: Market Intelligence. Which roles near the person's skills are hiring, what they pay,
// and how exposed they are to automation. Pure code over the role catalog: no AI, so no made-up jobs.
const { rankRoles, isHindi } = require('./lib');
const sapMcp = require('../integrations/sap-mcp-client');

module.exports = {
  id: 'market',
  name: 'Market Intelligence',
  icon: '📈',
  describe: 'Shows which jobs exist near the person’s skills, with pay, hiring demand and automation risk. Use for questions about jobs, roles, salary, demand or the future of work.',

  async run(ctx) {
    const { cf, cat, message } = ctx;
    const hi = isHindi(cf, message);
    const names = cf.skills.map((s) => s.skill);
    // SAP jobs get their own list below, so the main list shows SkillSetu's catalog only.
    const all = rankRoles(names, cat).filter((m) => m.matchPercent > 0 && !sapMcp.isSapRole(m.role.ID));
    const ranked = all.slice(0, 4);

    if (!ranked.length) {
      return { replies: [{ text: hi ? 'नौकरी ढूँढने से पहले मुझे आपके कुछ और हुनर जानने हैं। अपने काम के बारे में थोड़ा और बताइए।' : 'I need a few more skills before I can find roles. Tell me a bit more about what you’ve done.' }],
        suggestions: [], note: 'no matches', next: 'skills' };
    }
    const top = ranked[0];
    // A role that is easy to automate is a risky first pick: point to the closest safer one too.
    const safer = top.role.automationRisk === 'High' ? all.find((m) => m.role.automationRisk === 'Low' && m.matchPercent >= 50) : null;
    if (safer && !ranked.includes(safer)) ranked[3] = safer;
    const safe = ranked.filter((m) => m.role.automationRisk === 'Low').length;
    let text = `With your ${names.length} skill${names.length === 1 ? '' : 's'}, ${top.role.title} is the closest fit at ${top.matchPercent}%. ` +
      (safe === ranked.length ? (ranked.length === 1 ? 'It has low automation risk.' : ranked.length === 2 ? 'Both have low automation risk.' : `All ${ranked.length} have low automation risk.`)
        : safe === 0 ? 'Each carries some automation risk, so adding a skill or two matters.' : `${safe} of these ${ranked.length} roles ${safe === 1 ? 'has' : 'have'} low automation risk.`);
    if (hi) {
      text = `आपके ${names.length} हुनर के साथ ${top.role.title} सबसे करीब है (${top.matchPercent}% मेल)। ` +
        (safe === ranked.length ? (ranked.length === 1 ? 'इसमें ऑटोमेशन का खतरा कम है।' : 'इन सभी में ऑटोमेशन का खतरा कम है।')
          : safe === 0 ? 'इन सबमें कुछ ऑटोमेशन का खतरा है, इसलिए एक-दो नए हुनर जोड़ना फ़ायदेमंद होगा।' : `इनमें से ${safe} नौकरियों में ऑटोमेशन का खतरा कम है।`);
      if (cf.profile.forces) text += ` आपकी फ़ौज की सेवा${cf.profile.forces.rank ? ` (${cf.profile.forces.rank})` : ''} को मैंने नागरिक हुनर में बदला है, इसलिए कंपनियाँ इसे समझ पाएँगी।`;
      if (cf.profile.pastTitle) text += ` आपकी पुरानी ${cf.profile.pastTitle.toUpperCase()} नौकरी आसानी से ऑटोमेट हो सकती है, पर वहाँ सीखे हुनर आगे काम आएँगे।`;
    } else if (cf.profile.forces) text += ` I matched your service${cf.profile.forces.rank ? ` as ${cf.profile.forces.rank}` : ''} on the civilian skills it proves, not on the rank title.`;
    if (!hi && cf.profile.pastTitle) text += ` Your old ${cf.profile.pastTitle.toUpperCase()} role is easy to automate, but the skills you built there carry over.`;
    if (safer) text += hi ? ` ध्यान दें: ${top.role.title} में ऑटोमेशन का खतरा ज़्यादा है। ${safer.role.title} (${safer.matchPercent}% मेल) ज़्यादा सुरक्षित है।`
      : ` Heads-up: ${top.role.title} is at high risk of automation. ${safer.role.title} (${safer.matchPercent}% match) is a safer bet.`;

    // Live company data: open jobs in SAP SuccessFactors, read through the SAP MCP server.
    const sap = await sapMcp.importForSkills(names, cat);
    if (sap?.jobs.length) {
      const j = sap.jobs[0];
      const where = sap.system === 'sample' ? 'नमूना सूची (SAP अभी जुड़ा नहीं)' : sap.source;
      text += hi ? ` ${where} में ${sap.total} खुली नौकरियाँ हैं; इनमें से ${sap.fits} आपके हुनर से मेल खाती हैं, जैसे ${j.title} (${j.matchPercent}% मेल)।`
        : ` ${sap.system === 'sample' ? `Of ${sap.total} sample open jobs (SAP not connected yet)` : `Of ${sap.total} open jobs in ${sap.source}`}, ${sap.fits} fit your skills, led by ${j.title}${j.location ? ` in ${j.location}` : ''} (${j.matchPercent}% match).`;
    }

    return {
      replies: [{ text, card: { type: 'roles', roles: ranked.map(slim), sap: sap?.jobs.length ? { source: sap.source, system: sap.system, total: sap.total, jobs: sap.jobs } : null } }],
      note: `${ranked.length} roles, top ${top.role.title} ${top.matchPercent}%${sap ? `; ${sap.fits} open SAP jobs fit` : '; SAP MCP not reachable'}`,
      trace: sap ? [sapMcp.traceOf(sap)] : [],
      suggestions: [
        { label: hi ? `${top.role.title} के लिए प्लान` : `Plan for ${top.role.title}`, intent: 'pathway', roleID: top.role.ID },
        ...(safer ? [{ label: hi ? `${safer.role.title} के लिए प्लान (सुरक्षित)` : `Plan for ${safer.role.title} (safer)`, intent: 'pathway', roleID: safer.role.ID }] : []),
        { label: hi ? 'क्या फ़िल्टर मुझे रिजेक्ट करेगा?' : 'Will a filter reject me?', intent: 'readiness' },
        { label: hi ? 'पार्ट-टाइम या घर से काम' : 'Part-time or remote options', intent: 'matching' }
      ]
    };
  }
};

const slim = (m) => ({
  ID: m.role.ID, title: m.role.title, company: m.role.company, location: m.role.location, salary: m.role.salary,
  type: m.role.type, demand: m.role.demand, automationRisk: m.role.automationRisk,
  matchPercent: m.matchPercent, matchedSkills: m.matchedSkills, missingSkills: m.missingSkills.map((s) => s.name)
});
module.exports.slim = slim;
