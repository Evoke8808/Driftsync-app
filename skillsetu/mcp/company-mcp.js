// Company MCP server: gives SkillSetu's agents (or any MCP client) read access to a partner company's data:
// who works there, their role, skills and projects, and the company's open internal postings.
// SkillSetu only calls the employee tools after the person has agreed to connect their data.
// Served at POST /company-mcp on the SkillSetu server (x-api-key header), see mcp/http.js.
const cds = require('@sap/cds');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');

const T = () => cds.entities('skillsetu');
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const projects = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean).map((p) => {
  const i = p.indexOf(':');
  return i > 0 ? { name: p.slice(0, i).trim(), detail: p.slice(i + 1).trim() } : { name: p, detail: '' };
});
const domainOf = (email) => String(email || '').trim().toLowerCase().split('@')[1] || '';

async function companyFor(email) {
  const d = domainOf(email);
  return d ? SELECT.one.from(T().Companies).where({ domain: d }) : null;
}

function createCompanyServer() {
  const server = new McpServer({ name: 'company-data', version: '1.0.0' },
    { instructions: 'Read-only company data shared with SkillSetu: find a person\'s company by work email, read their employee profile (role, skills, projects) after they consent, and list the company\'s open internal postings.' });
  const reply = (text, data) => ({ content: [{ type: 'text', text }, { type: 'text', text: JSON.stringify(data) }] });
  const tool = (name, config, fn) => server.registerTool(name, config, async (a) => {
    try { return await fn(a); } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
  });

  tool('find_company_by_email', {
    title: 'Find a person\'s company',
    description: 'Looks up which partner company a work email belongs to, and whether that email is in the company\'s employee list. Returns no personal details.',
    inputSchema: { email: z.string().min(3).describe('Work email, e.g. meena@servicefirst.in') },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ email }) => {
    const c = await companyFor(email);
    if (!c) return reply(`No partner company uses the domain ${domainOf(email) || '(none)'}.`, { company: null });
    const e = await SELECT.one.from(T().CompanyEmployees).columns('name', 'title').where({ company_ID: c.ID, email: String(email).trim().toLowerCase() });
    return reply(`${c.name}${e ? `: ${e.name} is an employee (${e.title}).` : ': not in the employee list.'}`, { company: { ID: c.ID, name: c.name, domain: c.domain }, employee: e ? { name: e.name, title: e.title } : null });
  });

  tool('get_employee_profile', {
    title: 'Read an employee profile',
    description: 'The employee\'s current role, department, years at the company, skills and projects. Only call this after the person has agreed to connect their company data.',
    inputSchema: { email: z.string().min(3).describe('The employee\'s work email') },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ email }) => {
    const c = await companyFor(email);
    const e = c && await SELECT.one.from(T().CompanyEmployees).where({ company_ID: c.ID, email: String(email).trim().toLowerCase() });
    if (!e) throw new Error('No employee with that email at a partner company.');
    const p = { company: c.name, domain: c.domain, name: e.name, email: e.email, title: e.title, department: e.department, years: e.years, skills: list(e.skills), projects: projects(e.projects) };
    return reply(`${p.name}, ${p.title} (${p.department}) at ${p.company}, ${p.years ?? '?'} years. Skills: ${p.skills.join(', ') || 'none listed'}. Projects: ${p.projects.map((x) => x.name).join('; ') || 'none listed'}.`, p);
  });

  tool('list_open_postings', {
    title: 'List open internal postings',
    description: 'Open roles inside a partner company (title, department, location, required skills, openings). Pass the company domain or any work email at that company.',
    inputSchema: { company: z.string().min(3).describe('Company email domain (servicefirst.in) or a work email') },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ company }) => {
    const c = await companyFor(company.includes('@') ? company : `x@${company}`);
    if (!c) throw new Error(`No partner company for ${company}.`);
    const rows = await SELECT.from(T().CompanyPostings).where({ company_ID: c.ID }).orderBy('title');
    const postings = rows.map((r) => ({ ID: r.ID, title: r.title, department: r.department, location: r.location, description: r.description, skills: list(r.skills), openings: r.openings || 1 }));
    return reply(`${postings.length} open posting(s) at ${c.name}: ${postings.map((x) => x.title).join(', ') || 'none'}.`, { company: c.name, domain: c.domain, postings });
  });

  return server;
}

module.exports = { createCompanyServer };
