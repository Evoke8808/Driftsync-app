// SkillSetu MCP server: lets any AI assistant that speaks MCP (Claude Desktop, ChatGPT, SAP Joule...) onboard a
// person into SkillSetu. Every tool calls the public Integration API (/integration/v1), so the same agents,
// counsellor rules and audit trail apply as in the website. Two ways to run it:
//   - Claude Desktop on this computer: mcp/stdio.js (see the comment there)
//   - Any MCP client over the web: POST /mcp on the SkillSetu server (mcp/http.js), header x-api-key
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');

const INSTRUCTIONS = `SkillSetu turns a person's life and work story, in any language, into skills with evidence, then fair job matches and a short free learning plan.
Onboarding flow:
1. onboard_person with their story, in their own words.
2. If SkillSetu asks a follow-up question, ask the person and pass the answer to add_to_story.
3. find_jobs, then make_learning_plan for the job they like.
4. check_filter_barriers shows what a typical résumé filter would reject them for (SkillSetu ignores those).
5. send_to_counsellor: a person reviews the case before anything reaches an employer.
Always tell the person their case code (SS-XXXXXX). Don't ask for age, gender, religion or caste: SkillSetu matches on skills only.`;

const label = (n) => { const t = String(n || '').replace(/-/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
const caseID = z.string().min(1).describe('The caseID returned by onboard_person (a UUID)');

function createServer({ baseUrl = process.env.SKILLSETU_URL || 'http://localhost:4004', apiKey = process.env.SKILLSETU_API_KEY || 'skillsetu-demo-key' } = {}) {
  const server = new McpServer({ name: 'skillsetu', version: '1.0.0' }, { instructions: INSTRUCTIONS });

  async function call(method, fn, data = {}) {
    const url = new URL(`/integration/v1/${fn}`, baseUrl);
    const opt = { method, headers: { 'x-api-key': apiKey } };
    if (method === 'GET') { for (const [k, v] of Object.entries(data)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v)); }
    else { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(data); }
    let res;
    try { res = await fetch(url, opt); }
    catch (e) { throw new Error(`SkillSetu is not reachable at ${baseUrl}. Start it first with "cds watch".`); }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error?.message || `SkillSetu answered ${res.status}`);
    return body;
  }

  // Each tool returns a short readable summary for the assistant, followed by the data as JSON.
  const reply = (text, data) => ({ content: [{ type: 'text', text: data === undefined ? text : `${text}\n\n${JSON.stringify(data, null, 1)}` }] });
  const tool = (name, config, fn) => server.registerTool(name, config, async (args) => {
    try { return await fn(args); } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
  });
  const caseText = (c) => {
    const skills = (c.skills || []).map((s) => s.label).join(', ') || 'none yet';
    const plan = c.plan ? ` Plan: ${c.plan.role}, ${c.plan.courses} course(s), about ${c.plan.hours} hours.` : '';
    return `Case ${c.code}${c.name ? ` (${c.name})` : ''}, status ${c.status}. Skills: ${skills}.${plan}${c.messages?.length ? `\nSkillSetu says: ${c.messages.join(' ')}` : ''}`;
  };
  const caseData = (c) => ({ caseID: c.caseID, code: c.code, name: c.name, status: c.status, skills: c.skills, targetRole: c.targetRole, plan: c.plan });

  tool('onboard_person', {
    title: 'Onboard a person',
    description: 'Create a SkillSetu case from a person\'s life and work story (any language: English, Hindi, Hinglish, Tamil...). Paid and unpaid work both count. Returns the skills found, the words that prove each one, and a follow-up question.',
    inputSchema: {
      story: z.string().min(1).describe('The person\'s story in their own words'),
      name: z.string().optional().describe('First name (optional). Employers only ever see the case code.'),
      district: z.string().optional().describe('District or city (optional)'),
      externalRef: z.string().optional().describe('Your own reference, e.g. an NGO or HR ID (optional)')
    },
    annotations: { openWorldHint: false }
  }, async (a) => { const c = await call('POST', 'createCase', a); return reply(caseText(c), caseData(c)); });

  tool('add_to_story', {
    title: 'Add to the story',
    description: 'Add more of the person\'s story to their case, or answer SkillSetu\'s follow-up question. Returns the updated skills.',
    inputSchema: { caseID, text: z.string().min(1).describe('What the person said') },
    annotations: { openWorldHint: false }
  }, async (a) => { const c = await call('POST', 'addToCase', a); return reply(caseText(c), caseData(c)); });

  tool('find_jobs', {
    title: 'Find fair job matches',
    description: 'Jobs ranked on skills only (no age, degree or gap filters), with the match %, the skills the person has and the ones they are missing.',
    inputSchema: {
      caseID,
      partTime: z.boolean().optional().describe('Only part-time jobs'),
      remote: z.boolean().optional().describe('Only remote jobs'),
      city: z.string().optional().describe('Only jobs in this city')
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async (a) => {
    const jobs = (await call('GET', 'getMatches', a)).slice(0, 8);
    if (!jobs.length) return reply('No jobs match yet. Add more of the story with add_to_story, or remove a filter.');
    const lines = jobs.map((j) => `${j.matchPercent}% ${j.title}, ${j.company}, ${j.location}, ${j.salary}${j.missingSkills.length ? ` (missing: ${j.missingSkills.map(label).join(', ')})` : ''}`);
    return reply(`Top matches:\n${lines.join('\n')}`, jobs.map(({ roleID, title, company, matchPercent, missingSkills, automationRisk }) => ({ roleID, title, company, matchPercent, missingSkills, automationRisk })));
  });

  tool('make_learning_plan', {
    title: 'Make a learning plan',
    description: 'The shortest free course plan (SAP Learning Hub, SWAYAM, NPTEL) to close the gap for a job. Without roleID it plans for the best match.',
    inputSchema: { caseID, roleID: z.string().optional().describe('roleID from find_jobs (optional)') },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async (a) => {
    const p = await call('GET', 'getLearningPlan', a);
    const steps = p.steps.map((s) => `${s.course} (${s.provider}, ${s.duration}) for ${label(s.skill)}`);
    return reply(`${p.role}: ${p.matchToday}% match today. ${steps.length ? `${steps.length} course(s), about ${p.totalHours} hours (${p.weeks} week(s)):\n${steps.join('\n')}` : 'No courses needed: they already have every required skill.'}`, p);
  });

  tool('check_filter_barriers', {
    title: 'Check résumé-filter barriers',
    description: 'What a typical résumé filter would reject this person for (career gap, age, college, access needs) and tips to get past it. SkillSetu itself ignores these.',
    inputSchema: { caseID },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async (a) => {
    const r = await call('GET', 'getReadiness', a);
    const audit = r.audit ? ` On SkillSetu's test pool for ${r.audit.role}, a résumé filter fails ${r.audit.resumeFilterFailingGroups} groups; skills-first fails ${r.audit.skillsFirstFailingGroups}.` : '';
    return reply(`${r.role} (${r.matchPercent}% match). ${r.filterBarriers.length ? `A résumé filter would reject them for: ${r.filterBarriers.join(', ')}.` : 'No common filter would reject them.'}${audit}${r.tips.length ? `\nTips:\n${r.tips.join('\n')}` : ''}`);
  });

  tool('send_to_counsellor', {
    title: 'Send to a counsellor',
    description: 'Send the case to a human counsellor for review. Nothing reaches an employer before a counsellor approves.',
    inputSchema: { caseID },
    annotations: { openWorldHint: false }
  }, async (a) => { const c = await call('POST', 'submitForReview', a); return reply(`${caseText({ ...c, messages: [] })}\nSent to a counsellor. They will see it on the Counsellor page.`, caseData(c)); });

  tool('get_case', {
    title: 'Read a case',
    description: 'Read a case: skills with evidence, the plan and the counsellor status.',
    inputSchema: { caseID },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async (a) => { const c = await call('GET', 'getCase', a); return reply(caseText({ ...c, messages: [] }), caseData(c)); });

  server.registerPrompt('onboard-someone', {
    title: 'Onboard someone into SkillSetu',
    description: 'Paste a person\'s story and walk them through SkillSetu',
    argsSchema: { story: z.string().describe('The person\'s story in their own words') }
  }, ({ story }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Please onboard this person into SkillSetu and walk them through it step by step: their skills, the jobs that fit, a learning plan, and then send the case to a counsellor.\n\nTheir story: ${story}` } }] }));

  return server;
}

module.exports = { createServer };
