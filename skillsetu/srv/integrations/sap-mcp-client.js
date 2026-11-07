// MCP client the agents use to read company data from SAP: agent -> this client -> SAP MCP server (mcp/sap-stdio.js)
// -> SuccessFactors / HANA Cloud. The server runs as its own process, started on first use and kept open.
// Answers are cached for a few minutes so a chat turn never waits on SAP twice.
const path = require('path');
const cds = require('@sap/cds');
const { keywordSkills, AI_EXPOSURE } = require('../agents/lib');

const LOG = cds.log('sap-mcp');
const CACHE_MS = 5 * 60 * 1000;
const CALL_TIMEOUT = 15000;
let clientP = null;
const cache = new Map();

async function connect() {
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, '..', '..', 'mcp', 'sap-stdio.js')],
    env: { ...process.env },
    stderr: 'pipe'
  });
  const client = new Client({ name: 'skillsetu-agents', version: '1.0.0' });
  transport.onclose = () => { clientP = null; };
  await client.connect(transport);
  LOG.info('connected to the SAP MCP server');
  return client;
}

// Call one tool on the SAP MCP server. Returns { data, ms } or throws.
async function callTool(name, args = {}) {
  const key = name + JSON.stringify(args);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ...hit.value, cached: true };
  const t0 = Date.now();
  if (!clientP) clientP = connect().catch((e) => { clientP = null; throw e; });
  const client = await clientP;
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: CALL_TIMEOUT });
  const texts = (res.content || []).filter((c) => c.type === 'text').map((c) => c.text);
  if (res.isError) throw new Error(texts.join(' ') || 'SAP MCP tool failed');
  const value = { data: JSON.parse(texts[texts.length - 1]), ms: Date.now() - t0 };
  cache.set(key, { at: Date.now(), value });
  return value;
}

// Open SAP jobs scored against the person's skills. The skills a job needs are read from its own title and
// description with the same rules SkillSetu uses on stories, so a job is matched on skills only.
// Returns null when the SAP MCP server can't be reached; the agent then answers without it.
async function jobsForSkills(names, cat, { top = 3 } = {}) {
  try {
    const { data, ms, cached } = await callTool('list_open_jobs', { top: 50 });
    const known = new Set(cat.skills.map((s) => s.name));
    const have = new Set(names);
    const scored = data.jobs.map((j) => {
      const needs = keywordSkills(`${j.title}. ${j.description}`).map((s) => s.skill).filter((s) => known.has(s));
      const matched = needs.filter((s) => have.has(s));
      return { ...j, description: undefined, needs: needs.length, matchPercent: needs.length ? Math.round((matched.length / needs.length) * 100) : 0,
        matchedSkills: matched, missingSkills: needs.filter((s) => !have.has(s)) };
    }).filter((j) => j.needs >= 2 && j.matchPercent >= 34)
      .sort((a, b) => b.matchPercent - a.matchPercent || b.openings - a.openings);
    // SuccessFactors often has the same job open in several countries: show each title once.
    const byTitle = new Map();
    for (const j of scored) {
      const k = j.title.toLowerCase().replace(/\s*-\s*\d+$/, '');
      if (byTitle.has(k)) byTitle.get(k).more++; else byTitle.set(k, { ...j, more: 0 });
    }
    const jobs = [...byTitle.values()].slice(0, top).map((j) => (j.more ? { ...j, location: `${j.location || 'Several places'} +${j.more} more` } : j));
    return { source: data.source, system: data.system, total: data.jobs.length, fits: scored.length, jobs, ms, cached: !!cached, tool: 'list_open_jobs' };
  } catch (e) {
    LOG.warn('SAP MCP unavailable:', e.message);
    return null;
  }
}

// SAP jobs become normal SkillSetu roles, so every agent can use them: plans, "why not?", the bias check,
// counsellor approval and the write-back to SuccessFactors. The role ID encodes the SAP requisition ID.
const SAP_PREFIX = '5a900000-5a90-4a90-8a90-';
const sapRoleID = (jobReqId) => SAP_PREFIX + String(jobReqId).replace(/\D/g, '').slice(-12).padStart(12, '0');
const isSapRole = (id) => String(id || '').startsWith(SAP_PREFIX);
const jobReqOf = (id) => String(+String(id).slice(SAP_PREFIX.length));

async function importJobs(jobs, cat) {
  const { Roles, RoleSkills } = cds.entities('skillsetu');
  const skillByName = Object.fromEntries(cat.skills.map((s) => [s.name, s]));
  for (const j of jobs) {
    const ID = sapRoleID(j.jobReqId);
    const needs = [...j.matchedSkills, ...j.missingSkills];
    // Risk is read from the job's own tasks: mostly work AI does well -> Medium, otherwise Low.
    const exposed = needs.filter((n) => AI_EXPOSURE[n] && AI_EXPOSURE[n] !== 'Low').length;
    const role = { ID, title: j.title.slice(0, 100), company: 'SAP SuccessFactors', location: (j.location || 'See posting').slice(0, 100),
      description: `Open requisition ${j.jobReqId} in ${j.source || 'SAP SuccessFactors'}${j.department ? `, ${j.department}` : ''}.`.slice(0, 1000),
      salary: 'See SAP posting', type: 'full-time', demand: j.openings > 1 ? 'High' : 'Medium', automationRisk: exposed > needs.length / 2 ? 'Medium' : 'Low' };
    const rs = needs.filter((n) => skillByName[n]).map((n, i) => ({ ID: cds.utils.uuid(), role_ID: ID, skill_ID: skillByName[n].ID, importance: i < 3 ? 'required' : 'preferred' }));
    await UPSERT.into(Roles).entries(role);
    await DELETE.from(RoleSkills).where({ role_ID: ID });
    if (rs.length) await INSERT.into(RoleSkills).entries(rs);
    // Keep this turn's catalog in step, so the agent can rank the new role straight away.
    cat.roles = cat.roles.filter((r) => r.ID !== ID).concat(role);
    cat.roleSkills = cat.roleSkills.filter((r) => r.role_ID !== ID).concat(rs);
    j.roleID = ID;
  }
  return jobs;
}

// Fetch open SAP jobs that fit these skills and import them as roles. Returns the jobsForSkills answer (or null).
async function importForSkills(names, cat, opts) {
  const sap = await jobsForSkills(names, cat, opts);
  if (!sap?.jobs.length) return sap;
  try { await importJobs(sap.jobs.map((j) => ({ ...j, source: sap.source })), cat); sap.jobs.forEach((j) => { j.roleID = sapRoleID(j.jobReqId); }); }
  catch (e) { LOG.warn('Could not import SAP jobs as roles:', e.message); }
  return sap;
}

// A trace line for the "Agent trace" panel and the audit log, so judges and counsellors see the MCP call.
const traceOf = (sap) => sap && ({
  agent: 'sap-mcp', name: 'SAP MCP', icon: '🔌', routedBy: '-',
  reason: `MCP tool ${sap.tool}: ${sap.total} open jobs from ${sap.source}, ${sap.fits} fit the person's skills${sap.cached ? ' (cached)' : ''}`,
  provider: sap.source.slice(0, 60), model: null, ms: sap.ms
});

module.exports = { callTool, jobsForSkills, importForSkills, traceOf, isSapRole, jobReqOf, sapRoleID };
