// SAP company-data MCP server. SkillSetu's agents (and any MCP client such as Claude Desktop) call these tools
// to read live open jobs from SAP: SuccessFactors Recruiting first, then SAP HANA Cloud, then a saved copy.
// Read-only: nothing here writes to SAP. (Pushing approved candidates goes through srv/integrations/successfactors.js.)
// Run it: node mcp/sap-stdio.js (stdio), or POST /sap-mcp on the SkillSetu server.
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');
const sources = require('./sap/sources');

const INSTRUCTIONS = `Read-only access to the company's SAP systems. list_open_jobs returns open job requisitions from SAP SuccessFactors Recruiting (or SAP HANA Cloud when SuccessFactors is not reachable). Every answer names the system it came from.`;

function createSapServer() {
  const server = new McpServer({ name: 'sap-company-data', version: '1.0.0' }, { instructions: INSTRUCTIONS });
  // The first text block is for people; the second is the same answer as JSON for programs.
  const reply = (text, data) => ({ content: [{ type: 'text', text }, { type: 'text', text: JSON.stringify(data) }] });
  const tool = (name, config, fn) => server.registerTool(name, config, async (args) => {
    try { return await fn(args); } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
  });

  tool('list_open_jobs', {
    title: 'List open jobs in SAP',
    description: 'Open job requisitions from SAP SuccessFactors Recruiting: title, department, location, openings and the job description. Filter by a word in the title or description, or by location.',
    inputSchema: {
      keyword: z.string().optional().describe('Only jobs whose title or description contains this word'),
      location: z.string().optional().describe('Only jobs in this city or country'),
      top: z.number().int().min(1).max(100).optional().describe('How many to return (default 50)'),
      prefer: z.enum(['successfactors', 'hana']).optional().describe('Which SAP system to ask first')
    },
    annotations: { readOnlyHint: true, openWorldHint: true }
  }, async ({ keyword, location, top = 50, prefer }) => {
    const r = await sources.openRequisitions({ top: Math.max(top, 50), prefer });
    const has = (v, w) => String(v || '').toLowerCase().includes(String(w).toLowerCase());
    let jobs = r.jobs;
    if (keyword) jobs = jobs.filter((j) => has(j.title, keyword) || has(j.description, keyword));
    if (location) jobs = jobs.filter((j) => has(j.location, location));
    jobs = jobs.slice(0, top);
    const lines = jobs.slice(0, 15).map((j) => `${j.jobReqId}: ${j.title}${j.department ? `, ${j.department}` : ''}${j.location ? `, ${j.location}` : ''} (${j.openings} opening${j.openings === 1 ? '' : 's'})`);
    return reply(`${jobs.length} open job(s) from ${r.source}:\n${lines.join('\n')}${r.skipped.length ? `\n(Not used: ${r.skipped.join('; ')})` : ''}`,
      { source: r.source, system: r.system, ms: r.ms, skipped: r.skipped, jobs });
  });

  tool('get_job', {
    title: 'Read one SAP job',
    description: 'The full record of one job requisition, by its jobReqId from list_open_jobs.',
    inputSchema: { jobReqId: z.string().min(1).describe('jobReqId from list_open_jobs') },
    annotations: { readOnlyHint: true, openWorldHint: true }
  }, async ({ jobReqId }) => {
    const r = await sources.openRequisitions({ top: 100 });
    const j = r.jobs.find((x) => x.jobReqId === String(jobReqId));
    if (!j) throw new Error(`No open requisition ${jobReqId} in ${r.source}`);
    return reply(`${j.title} (${j.jobReqId}) from ${r.source}\n${[j.department, j.location].filter(Boolean).join(', ')}\n${j.description}`, { source: r.source, system: r.system, job: j });
  });

  tool('sap_connection_status', {
    title: 'Which SAP systems are connected',
    description: 'Shows which SAP systems are set up (SuccessFactors key, HANA Cloud credentials) and when data was last synced. Never shows secrets.',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async () => {
    const s = sources.status();
    return reply(`SuccessFactors: ${s.successfactors}\nSAP HANA Cloud: ${s.hana}\nLast SuccessFactors sync: ${s.lastSync || 'never'}`, s);
  });

  return server;
}

module.exports = { createSapServer };
