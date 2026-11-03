#!/usr/bin/env node
// Starts SkillSetu on SAP HANA Cloud when it is reachable, otherwise on the local SQLite file, so a demo never fails.
// HANA login comes from HANA_HOST / HANA_USER / HANA_PASSWORD / HANA_SCHEMA (BTP: cf set-env) or from sap-key.json.
// The first start on an empty HANA schema creates the tables and loads the demo data; later starts keep the data.
// Force a database with SKILLSETU_DB=hana or SKILLSETU_DB=sqlite.
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const sources = require('./mcp/sap/sources');

const bin = (name) => path.join(__dirname, 'node_modules', '.bin', name);
// Create tables and load the demo data. Done through the CAP API, because the cds-deploy command prints the login it uses.
const deploy = (env) => spawnSync(process.execPath, ['-e', `const cds=require('@sap/cds');(async()=>{const db=await cds.connect.to('db');await cds.deploy('*').to(db);await db.disconnect?.();console.log('[db] tables and demo data ready')})().catch(e=>{console.error('[db] deploy failed:',e.message);process.exit(1)})`], { cwd: __dirname, env, stdio: 'inherit' });
const log = (m) => console.log(`[db] ${m}`);

async function hanaReady(h) {
  const { client, run } = sources.hanaClient({ hana: h });
  try {
    await Promise.race([run('connect'), new Promise((_, fail) => setTimeout(() => fail(new Error('no answer in 10 s')), 10000))]);
    const [{ N }] = await run('exec', `SELECT COUNT(*) AS N FROM SYS.TABLES WHERE SCHEMA_NAME = '${h.schema.toUpperCase()}' AND TABLE_NAME = 'SKILLSETU_ROLES'`);
    return { ok: true, hasTables: N > 0 };
  } catch (e) { return { ok: false, error: e.message }; }
  finally { try { client.end(); } catch (e) { /* closed */ } }
}

(async () => {
  const want = (process.env.SKILLSETU_DB || '').toLowerCase();
  const h = sources.config().hana;
  const env = { ...process.env };
  let db = 'sqlite';

  if (want !== 'sqlite' && h.host && h.user) {
    if (!h.schema) h.schema = h.user;
    const r = await hanaReady(h);
    if (r.ok) {
      db = 'hana';
      env.CDS_CONFIG = JSON.stringify({ requires: { db: { kind: 'hana', impl: '@cap-js/hana', driver: 'hdb',
        credentials: { host: h.host, port: h.port, user: h.user, password: h.password, schema: h.schema, useTLS: true, encrypt: true, servername: h.host } } } });
      if (!r.hasTables) {
        log(`SAP HANA Cloud schema ${h.schema} is empty: creating tables and loading demo data...`);
        const d = deploy(env);
        if (d.status !== 0) { log('HANA deploy failed, using SQLite instead'); db = 'sqlite'; delete env.CDS_CONFIG; }
      }
    } else if (want === 'hana') { console.error(`[db] SAP HANA Cloud not reachable: ${r.error}`); process.exit(1); }
    else log(`SAP HANA Cloud not reachable (${r.error}), using SQLite`);
  }

  if (db === 'sqlite') {
    const fs = require('fs');
    if (!fs.existsSync(path.join(__dirname, 'db.sqlite'))) deploy(env);
  }
  env.SKILLSETU_DB_IN_USE = db === 'hana' ? 'SAP HANA Cloud' : 'SQLite';
  log(`database: ${env.SKILLSETU_DB_IN_USE}${db === 'hana' ? ` (schema ${h.schema})` : ''}`);
  const srv = spawn(bin('cds-serve'), process.argv.slice(2), { env, stdio: 'inherit' });
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => srv.kill(s));
  srv.on('exit', (code) => process.exit(code ?? 0));
})();
