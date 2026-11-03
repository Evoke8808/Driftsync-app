#!/usr/bin/env node
// One-time setup for SAP HANA Cloud: creates the table SKILLSETU_JOB_REQUISITIONS in your Hackfest schema and fills it
// with open jobs (from SuccessFactors if your API key works, otherwise the built-in sample).
// Run from the skillsetu folder:  node mcp/sap/hana-setup.js       (needs the "hana" part of sap-key.json)
const fs = require('fs');
const path = require('path');
const sources = require('./sources');

(async () => {
  const cfg = sources.config();
  let data;
  try { data = await sources.fromSuccessFactors(cfg, 50); console.log(`Got ${data.jobs.length} jobs from ${data.source}.`); }
  catch (e) { data = { jobs: JSON.parse(fs.readFileSync(path.join(__dirname, 'sample-requisitions.json'), 'utf8')) }; console.log(`SuccessFactors not used (${e.message}); loading the ${data.jobs.length} sample jobs.`); }

  const { client, run, table } = sources.hanaClient(cfg);
  console.log(`Connecting to ${cfg.hana.host} as ${cfg.hana.user}...`);
  await run('connect');
  try { await run('exec', `DROP TABLE ${table}`); } catch (e) { /* first run: nothing to drop */ }
  await run('exec', `CREATE COLUMN TABLE ${table} (JOB_REQ_ID NVARCHAR(40) PRIMARY KEY, TITLE NVARCHAR(200), DEPARTMENT NVARCHAR(100), LOCATION NVARCHAR(100), OPENINGS INTEGER, DESCRIPTION NVARCHAR(2000))`);
  const stmt = await run('prepare', `INSERT INTO ${table} VALUES (?, ?, ?, ?, ?, ?)`);
  for (const j of data.jobs) {
    await new Promise((ok, fail) => stmt.exec([j.jobReqId, j.title.slice(0, 200), (j.department || '').slice(0, 100), (j.location || '').slice(0, 100), j.openings || 1, (j.description || '').slice(0, 2000)], (e) => (e ? fail(e) : ok())));
  }
  const [{ N }] = await run('exec', `SELECT COUNT(*) AS N FROM ${table}`);
  console.log(`Done: ${N} rows in ${table}. SkillSetu will now read from SAP HANA Cloud when SuccessFactors is not reachable.`);
  client.end();
})().catch((e) => { console.error('HANA setup failed:', e.message); process.exit(1); });
