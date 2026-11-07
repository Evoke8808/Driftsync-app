// Where the SAP MCP server gets company data. It tries each source in order and says which one answered:
//   1. SAP SuccessFactors Recruiting (OData v2): the SAP Business Accelerator Hub sandbox with your API key,
//      or a real tenant if you set SAP_SF_URL + user/password.
//   2. SAP HANA Cloud (the Hackfest instance): table SKILLSETU_JOB_REQUISITIONS, filled by mcp/sap/hana-setup.js.
//   3. The last good copy from SuccessFactors (last-sync.json), then a built-in sample, so the demo never breaks.
// Keys come from environment variables or from sap-key.json in the SkillSetu folder (see sap-key.template.json).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const LAST_SYNC = path.join(__dirname, 'last-sync.json');
const SAMPLE = path.join(__dirname, 'sample-requisitions.json');
const TIMEOUT = 8000;

function config() {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(path.join(ROOT, 'sap-key.json'), 'utf8')); } catch (e) { /* no key file: env or offline */ }
  const h = file.hana || {};
  return {
    apiKey: process.env.SAP_API_KEY || file.apiKey || '',
    prefer: process.env.SAP_PREFER || file.prefer || 'successfactors',   // which system to ask first: successfactors or hana
    sfUrl: process.env.SAP_SF_URL || file.sfUrl || 'https://sandbox.api.sap.com/successfactors/odata/v2',
    sfUser: process.env.SAP_SF_USER || file.sfUser || '',
    sfPassword: process.env.SAP_SF_PASSWORD || file.sfPassword || '',
    hana: {
      host: process.env.HANA_HOST || h.host || '', port: +(process.env.HANA_PORT || h.port || 443),
      user: process.env.HANA_USER || h.user || '', password: process.env.HANA_PASSWORD || h.password || '',
      schema: process.env.HANA_SCHEMA || h.schema || ''
    }
  };
}

const strip = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/* ---------- 1. SuccessFactors Recruiting ---------- */
async function fromSuccessFactors(cfg, top) {
  const sandbox = /sandbox\.api\.sap\.com/.test(cfg.sfUrl);
  if (sandbox && !cfg.apiKey) throw new Error('no SAP API key');
  if (!sandbox && !cfg.sfUser) throw new Error('no SuccessFactors user');
  const headers = { Accept: 'application/json' };
  if (cfg.apiKey) headers.APIKey = cfg.apiKey;
  if (cfg.sfUser) headers.Authorization = 'Basic ' + Buffer.from(`${cfg.sfUser}:${cfg.sfPassword}`).toString('base64');

  // Ask for the job text in the same call. If a tenant rejects the $expand, ask for the plain list.
  const tries = [`JobRequisition?$top=${top}&$expand=jobReqLocale&$format=json`, `JobRequisition?$top=${top}&$format=json`];
  let last;
  for (const q of tries) {
    const res = await fetch(`${cfg.sfUrl.replace(/\/$/, '')}/${q}`, { headers, signal: AbortSignal.timeout(TIMEOUT) });
    if (res.status === 401 || res.status === 403) throw new Error(`SuccessFactors refused the key (${res.status})`);
    if (!res.ok) { last = new Error(`SuccessFactors answered ${res.status}`); continue; }
    const body = await res.json();
    const rows = body?.d?.results || body?.value || [];
    const jobs = rows.map((r) => {
      const locs = r.jobReqLocale?.results || [];
      const loc = locs.find((l) => /^en/i.test(l.locale || '')) || locs[0] || {};
      return {
        jobReqId: String(r.jobReqId),
        title: strip(loc.externalTitle || loc.jobTitle || r.jobTitle || r.externalTitle || r.jobCode || `Requisition ${r.jobReqId}`),
        department: strip(r.department || r.division || ''),
        location: strip([r.city, r.location, r.country].filter((x) => x && typeof x === 'string').slice(0, 2).join(', ')),
        openings: Number(r.numberOpenings) || 1,
        description: strip(loc.externalJobDescription || loc.jobDescription || r.jobDescription || '').slice(0, 1500)
      };
    }).filter((j) => j.title);
    if (!jobs.length) { last = new Error('SuccessFactors returned no requisitions'); continue; }
    try { fs.writeFileSync(LAST_SYNC, JSON.stringify({ at: new Date().toISOString(), jobs }, null, 1)); } catch (e) { /* read-only disk is fine */ }
    return { source: sandbox ? 'SAP SuccessFactors (API Hub sandbox)' : 'SAP SuccessFactors', system: 'successfactors', jobs };
  }
  throw last;
}

/* ---------- 2. SAP HANA Cloud ---------- */
const TABLE = 'SKILLSETU_JOB_REQUISITIONS';
function hanaClient(cfg) {
  const { host, port, user, password } = cfg.hana;
  if (!host || !user) throw new Error('no HANA Cloud credentials');
  const hdb = require('hdb');
  // HANA Cloud needs the host name in the TLS handshake (servername), or the connection hangs.
  const client = hdb.createClient({ host, port, user, password, useTLS: true, servername: host, connectTimeout: TIMEOUT });
  const run = (fn, ...args) => new Promise((ok, fail) => client[fn](...args, (e, r) => (e ? fail(e) : ok(r))));
  return { client, run, table: cfg.hana.schema ? `"${cfg.hana.schema}"."${TABLE}"` : `"${TABLE}"` };
}

async function fromHana(cfg, top) {
  const { client, run, table } = hanaClient(cfg);
  try {
    await run('connect');
    const rows = await run('exec', `SELECT TOP ${Number(top)} JOB_REQ_ID, TITLE, DEPARTMENT, LOCATION, OPENINGS, DESCRIPTION FROM ${table} ORDER BY JOB_REQ_ID`);
    return { source: 'SAP HANA Cloud', system: 'hana', jobs: rows.map((r) => ({ jobReqId: String(r.JOB_REQ_ID), title: r.TITLE, department: r.DEPARTMENT || '', location: r.LOCATION || '', openings: r.OPENINGS || 1, description: r.DESCRIPTION || '' })) };
  } finally { try { client.end(); } catch (e) { /* already closed */ } }
}

/* ---------- 3. Offline copies ---------- */
function offline() {
  try {
    const s = JSON.parse(fs.readFileSync(LAST_SYNC, 'utf8'));
    if (s.jobs?.length) return { source: `SAP SuccessFactors (saved copy from ${s.at.slice(0, 10)})`, system: 'cache', jobs: s.jobs };
  } catch (e) { /* no saved copy yet */ }
  return { source: 'Built-in sample (SAP not connected)', system: 'sample', jobs: JSON.parse(fs.readFileSync(SAMPLE, 'utf8')) };
}

// Try every live source in order; tell the caller which answered and why the others did not.
async function openRequisitions({ top = 50, prefer } = {}) {
  const cfg = config();
  if (!prefer) prefer = cfg.prefer;
  const order = prefer === 'hana' ? [['hana', fromHana], ['successfactors', fromSuccessFactors]] : [['successfactors', fromSuccessFactors], ['hana', fromHana]];
  const skipped = [];
  for (const [name, fn] of order) {
    const t0 = Date.now();
    try { return { ...(await fn(cfg, top)), ms: Date.now() - t0, skipped }; }
    catch (e) { skipped.push(`${name}: ${e.message}`); }
  }
  return { ...offline(), ms: 0, skipped };
}

function status() {
  const cfg = config();
  return {
    successfactors: /sandbox\.api\.sap\.com/.test(cfg.sfUrl) ? (cfg.apiKey ? 'API Hub sandbox key set' : 'no API key') : (cfg.sfUser ? `tenant ${cfg.sfUrl}` : 'no tenant user'),
    hana: cfg.hana.host ? `${cfg.hana.host} as ${cfg.hana.user}` : 'no credentials',
    lastSync: (() => { try { return JSON.parse(fs.readFileSync(LAST_SYNC, 'utf8')).at; } catch (e) { return null; } })()
  };
}

module.exports = { openRequisitions, status, config, hanaClient, TABLE, offline, fromSuccessFactors };
