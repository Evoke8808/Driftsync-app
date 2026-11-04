// Agent: Company Connect. For people whose employer shares data with SkillSetu. After the person agrees, it reads
// their work profile (role, skills, projects) and the company's open internal postings over the Company MCP, adds the
// skills with their projects as proof, and shows which internal roles they could move to, instead of being let go.
const cds = require('@sap/cds');
const mcp = require('../integrations/company-mcp-client');
const { db, label, isHindi, AI_EXPOSURE, shortestCourse, hours, roleInText } = require('./lib');

// Internal postings become SkillSetu roles (type "internal"), so plans and counsellor review work for them too.
async function importPostings(company, postings, cat) {
  const { Roles, RoleSkills } = db();
  const byName = Object.fromEntries(cat.skills.map((s) => [s.name, s]));
  for (const p of postings) {
    const needs = p.skills.filter((n) => byName[n]);
    const exposed = needs.filter((n) => AI_EXPOSURE[n] && AI_EXPOSURE[n] !== 'Low').length;
    const role = { ID: p.ID, title: p.title.slice(0, 100), company, location: (p.location || '').slice(0, 100), description: String(p.description || '').slice(0, 1000),
      salary: 'Internal move', type: 'internal', demand: p.openings > 1 ? 'High' : 'Medium', automationRisk: exposed > needs.length / 2 ? 'Medium' : 'Low' };
    const rs = needs.map((n, i) => ({ ID: cds.utils.uuid(), role_ID: p.ID, skill_ID: byName[n].ID, importance: i < 3 ? 'required' : 'preferred' }));
    await UPSERT.into(Roles).entries(role);
    await DELETE.from(RoleSkills).where({ role_ID: p.ID });
    if (rs.length) await INSERT.into(RoleSkills).entries(rs);
    cat.roles = cat.roles.filter((r) => r.ID !== p.ID).concat(role);
    cat.roleSkills = cat.roleSkills.filter((r) => r.role_ID !== p.ID).concat(rs);
  }
}

// How well the person's skills fit each internal posting, with the shortest free course for each gap.
function tracks(postings, have, cat) {
  const bySkill = Object.fromEntries(cat.skills.map((s) => [s.name, s]));
  return postings.map((p) => {
    const needs = p.skills.filter((n) => bySkill[n]);
    const matched = needs.filter((n) => have.has(n)), missing = needs.filter((n) => !have.has(n));
    const gaps = missing.map((n) => ({ skill: n, course: shortestCourse(cat.courses.filter((c) => c.skill_ID === bySkill[n].ID)) }));
    const exposed = needs.filter((n) => AI_EXPOSURE[n] && AI_EXPOSURE[n] !== 'Low').length;
    return { ID: p.ID, title: p.title, department: p.department, location: p.location, openings: p.openings,
      matchPercent: needs.length ? Math.round((matched.length / needs.length) * 100) : 0, matched, missing,
      hours: gaps.reduce((n, g) => n + hours(g.course?.duration), 0), risk: exposed > needs.length / 2 ? 'Medium' : 'Low' };
  }).sort((a, b) => b.matchPercent - a.matchPercent || a.hours - b.hours);
}

module.exports = {
  id: 'company',
  name: 'Company Connect',
  icon: '🏢',
  describe: 'For a person whose employer is a SkillSetu partner: connects their company data (role, projects, skills) after they agree, and shows open roles inside their own company they could move to. Use for "connect my company data", internal moves, other teams, roles in my company, or questions about their own projects at work.',

  async run(ctx) {
    const { cf, cat, message, user } = ctx;
    const hi = isHindi(cf, message);
    const { AccountEmails, CompanyLinks } = db();
    const acct = user?.username && await SELECT.one.from(AccountEmails).where({ username: user.username });
    if (!acct?.email) {
      return { replies: [{ text: hi ? 'कंपनी का डेटा जोड़ने के लिए अपने काम वाले ईमेल से अकाउंट बनाइए।' : 'To connect company data, sign up with your work email. Then I can read your role and projects from your company, with your OK.' }],
        note: 'no work email on the account', suggestions: [] };
    }

    // 1) Over MCP: the person's profile and the company's open postings.
    const prof = await mcp.safe('get_employee_profile', { email: acct.email });
    const posts = await mcp.safe('list_open_postings', { company: acct.email });
    const trace = [mcp.traceOf(prof, prof.data ? `read ${prof.data.name}'s profile at ${prof.data.company} (${prof.data.projects.length} projects)` : 'no profile'),
      mcp.traceOf(posts, posts.data ? `${posts.data.postings.length} open internal postings at ${posts.data.company}` : 'no postings')];
    if (!prof.data) {
      return { replies: [{ text: hi ? 'आपकी कंपनी के डेटा में आपका प्रोफ़ाइल नहीं मिला। कंपनी से पूछिए कि आपका ईमेल जुड़ा है या नहीं।' : `I couldn’t find your profile in your company’s data (${acct.email}). Ask your HR team to add you in the SkillSetu company portal.` }],
        note: 'employee not found over MCP', trace, suggestions: [] };
    }
    const p = prof.data;

    // 2) Consent recorded once, then the work profile goes into the case file.
    const firstTime = !cf.profile?.company?.connected;
    if (firstTime) {
      const company = await SELECT.one.from(db().Companies).columns('ID').where({ domain: p.domain });
      const emp = company && await SELECT.one.from(db().CompanyEmployees).columns('ID').where({ company_ID: company.ID, email: p.email });
      await INSERT.into(CompanyLinks).entries({ username: user.username, caseID: cf.ID, company_ID: company?.ID, employee_ID: emp?.ID });
    }
    cf.profile.company = { connected: true, name: p.company, domain: p.domain, title: p.title, department: p.department, years: p.years,
      projects: p.projects.slice(0, 8), email: p.email };
    // The current job, matched to SkillSetu's catalog when the title is there, so Job Risk Radar can check it too.
    cf.profile.job = { title: p.title, company: p.company, roleID: roleInText(p.title, cat)?.ID || cf.profile.job?.roleID || null };
    if (!cf.name || cf.name === 'Guest') cf.name = p.name.split(' ')[0];
    const known = new Set(cat.skills.map((s) => s.name));
    const added = [];
    for (const sk of p.skills.filter((n) => known.has(n))) {
      if (cf.skills.some((s) => s.skill === sk)) continue;
      // Proof: the project that shows this skill best (by its words), or the job title.
      const proj = p.projects.find((x) => new RegExp(label(sk).split(' ')[0], 'i').test(`${x.name} ${x.detail}`)) || p.projects[0];
      cf.skills.push({ skill: sk, reason: proj ? `${proj.name}: ${proj.detail}`.slice(0, 200) : `${p.title} at ${p.company}`, by: 'company' });
      added.push(sk);
    }

    // 3) Internal tracks: open postings ranked by skill fit.
    const postings = posts.data?.postings || [];
    if (postings.length) await importPostings(p.company, postings, cat);
    const ranked = tracks(postings, new Set(cf.skills.map((s) => s.skill)), cat);
    const best = ranked[0];

    const intro = firstTime
      ? (hi ? `${p.company} से जुड़ गए। मैंने आपका प्रोफ़ाइल पढ़ा: ${p.title}, ${p.department}, ${p.years} साल, ${p.projects.length} प्रोजेक्ट।` : `Connected to ${p.company}. I read your work profile: ${p.title} in ${p.department}, ${p.years} years, ${p.projects.length} projects.`)
      : (hi ? `${p.company} के अंदर अभी ये पद खुले हैं:` : `Here are the open roles inside ${p.company} right now.`);
    const skillsLine = added.length ? (hi ? ` ${added.length} हुनर आपके प्रोजेक्ट के सबूत के साथ जोड़े: ${added.map(label).join(', ')}।` : ` I added ${added.length} skills with your projects as proof: ${added.map(label).join(', ')}.`) : '';
    const bestLine = best ? (hi ? ` सबसे अच्छा अंदरूनी विकल्प: ${best.title} (${best.matchPercent}% मेल${best.missing.length ? `, बाकी लगभग ${best.hours} घंटे में` : ', आप अभी तैयार हैं'})।`
      : ` Your best move inside ${p.company}: ${best.title}, a ${best.matchPercent}% match${best.missing.length ? `; the rest takes about ${best.hours} hours of free courses` : ', and you could move now'}.`) : '';
    const privacy = hi ? ' आपकी कंपनी को यह नहीं बताया जाता कि आपने देखा।' : ' Your employer isn’t told that you looked.';

    return {
      replies: [{ text: intro + skillsLine + bestLine + privacy,
        card: { type: 'company', company: p.company, profile: { name: p.name, title: p.title, department: p.department, years: p.years, projects: p.projects.slice(0, 6) },
          added, tracks: ranked.slice(0, 4) } }],
      note: `${firstTime ? 'connected' : 'read'} ${p.company} over MCP: ${p.projects.length} projects, ${added.length} skills added, ${postings.length} internal postings${best ? `, best ${best.title} ${best.matchPercent}%` : ''}`,
      trace,
      suggestions: best ? [
        { label: hi ? `${best.title} के लिए प्लान` : `Plan for ${best.title}`, intent: 'pathway', roleID: best.ID },
        { label: hi ? 'काउंसलर से अंदरूनी बदलाव की बात' : 'Ask a counsellor about this move', intent: 'human', roleID: best.ID }
      ] : []
    };
  }
};
