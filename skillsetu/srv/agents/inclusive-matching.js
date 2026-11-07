// Agent 4: Inclusive Matching. Skills-first, anonymised matches that respect how the person can work
// (part-time, remote, city). Employers only ever see a candidate number and skills.
const { rankRoles, parseProfile, label, isHindi, caseCode } = require('./lib');
const { slim } = require('./market-intelligence');

const MIN_MATCH = 50;

module.exports = {
  id: 'matching',
  name: 'Inclusive Matching',
  icon: '🤝',
  describe: 'Finds anonymised, skills-first job matches with filters for part-time, remote or a city. Use when the person wants to apply, needs income now, or asks for part-time, remote or nearby work.',

  async run(ctx) {
    const { cf, cat, message } = ctx;
    // A preference stated in this message wins over the one on file.
    const now = parseProfile(message).prefs;
    Object.assign(cf.prefs, Object.fromEntries(Object.entries(now).filter(([, v]) => v !== null && v !== undefined)));
    if (cf.prefs.remote === false && cf.prefs.type === 'remote') cf.prefs.type = null;
    const { type, location } = cf.prefs;
    const wantRemote = type === 'remote' || cf.prefs.remote === true;
    const hi = isHindi(cf, message);

    const all = rankRoles(cf.skills.map((s) => s.skill), cat).filter((m) => m.matchPercent >= MIN_MATCH && m.role.type !== 'internal');
    const fits = (m) => {
      const r = m.role, remote = r.location === 'Remote' || r.type === 'remote';
      if (type === 'part-time' && !(r.type === 'part-time' || remote)) return false;
      if (wantRemote && !remote) return false;
      if (location && !(remote || r.location.toLowerCase() === location.toLowerCase())) return false;
      return true;
    };
    let list = all.filter(fits), relaxed = false;
    if (!list.length && all.length) { list = all; relaxed = true; }

    const alias = caseCode(cf.ID);
    const filters = [type && label(type), wantRemote && type !== 'remote' && 'Remote', location].filter(Boolean);
    let text;
    if (hi) {
      const HI = { 'Part time': 'पार्ट-टाइम', 'Remote': 'घर से', 'Full time': 'फुल-टाइम' };
      const f = filters.map((x) => HI[x] || x).join(' + ');
      if (!all.length) text = 'अभी किसी नौकरी के लिए आपके पास आधे हुनर नहीं हैं। एक छोटा कोर्स प्लान आपको सबसे जल्दी वहाँ पहुँचाएगा।';
      else if (relaxed) text = `${f} वाली कोई नौकरी अभी पूरी तरह मेल नहीं खाती, इसलिए ये आपके हुनर के हिसाब से सबसे अच्छे विकल्प हैं। ${f} नौकरी आते ही मैं बताऊँगी।`;
      else text = `${list.length} ${list.length > 1 ? 'नौकरियाँ' : 'नौकरी'} जिनके लिए आपके पास कम से कम आधे हुनर हैं${f ? ` (${f})` : ''}। नियोक्ता आपको सिर्फ़ ${alias} और आपके हुनर से देखेंगे, नाम या उम्र से नहीं।`;
    } else if (!all.length) text = 'You’re not above 50% on any role yet. A short course plan will get you there fastest.';
    else if (relaxed) text = `Nothing matches ${filters.join(' + ')} exactly yet, so here are your best skills-first matches. I’ll keep watching for ${filters.join(' + ')} roles.`;
    else text = `${list.length} role${list.length > 1 ? 's' : ''} where you already have at least half the skills${filters.length ? `, filtered for ${filters.join(' + ')}` : ''}. Employers see you as ${alias}, with skills only.`;

    return {
      replies: [{ text, card: { type: 'matches', alias, filters, relaxed, skills: cf.skills.map((s) => s.skill),
        hidden: ['Name', 'Age', 'Gender', 'College', 'Career gap', 'Disability'], roles: list.slice(0, 4).map(slim) } }],
      note: `${list.length} match${list.length === 1 ? '' : 'es'}${filters.length ? ' (' + filters.join(', ') + ')' : ''}${relaxed ? ', filter relaxed' : ''}`,
      suggestions: all.length
        ? [{ label: hi ? `${list[0].role.title} के लिए प्लान` : `Plan for ${list[0].role.title}`, intent: 'pathway', roleID: list[0].role.ID }, { label: hi ? 'काउंसलर को भेजो' : 'Send to a counsellor', intent: 'human' }]
        : [{ label: hi ? 'मेरा सीखने का प्लान बनाओ' : 'Build my learning plan', intent: 'pathway' }]
    };
  }
};
