// SkillSetu server: the normal CAP server, plus the MCP endpoints (see mcp/http.js),
// compression and browser caching so the page reloads fast even from a far-away data centre.
const path = require('path');
const express = require('express');
const cds = require('@sap/cds');

cds.on('bootstrap', (app) => {
  // SkillSetu has its own sign-in page. Never send the browser's built-in login box (WWW-Authenticate) on a 401.
  app.use((req, res, next) => {
    const set = res.setHeader.bind(res);
    res.setHeader = (k, v) => (String(k).toLowerCase() === 'www-authenticate' ? res : set(k, v));
    next();
  });
  // Compress text responses (the SAP UI5 bundle shrinks from 1.2 MB to about 300 KB). MCP streams are left alone.
  try {
    const compression = require('compression');
    app.use(compression({ filter: (req, res) => !/mcp\b/.test(req.path) && compression.filter(req, res) }));
  } catch (e) { cds.log('server').warn('Compression is off (run "npm install"):', e.message); }

  // Static files: the UI5 bundle and fonts never change, so browsers keep them for 30 days.
  // Our own files (page, app.js, styles.css) are always re-checked, so a redeploy shows up at once;
  // unchanged files come back as a tiny "not modified" answer.
  const dir = path.join(__dirname, 'app');
  app.use('/vendor', express.static(path.join(dir, 'vendor'), { maxAge: '30d', immutable: true }));
  app.use('/fonts', express.static(path.join(dir, 'fonts'), { maxAge: '30d', immutable: true }));
  app.use(express.static(dir, { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

  try { require('./mcp/http').mount(app); }
  catch (e) { cds.log('mcp').warn('MCP endpoint is off (run "npm install" to turn it on):', e.message); }
});
// Tables and services added after the database was first set up (company data, the Fiori counsellor service)
// get created here. Only what is missing is created; existing tables and data are never touched.
cds.once('served', async () => {
  try {
    const db = await cds.connect.to('db');
    const dialect = /hana/.test(db.options?.kind || db.kind || '') ? 'hana' : 'sqlite';
    const ddl = [].concat(cds.compile.to.sql(await cds.load('*'), { dialect })).filter((s) => /^CREATE (TABLE|VIEW)/i.test(s));
    let made = 0;
    for (const sql of ddl) { try { await db.run(sql); made++; } catch (e) { /* already there */ } }
    if (made) cds.log('server').info(`created ${made} missing table(s)/view(s)`);
  } catch (e) { cds.log('server').warn('Could not check views:', e.message); }
  // Demo accounts and the demo company come after the tables exist.
  try { await require('./srv/demo-accounts').ensure(); } catch (e) { cds.log('demo').warn('Could not create demo accounts:', e.message); }
});
module.exports = cds.server;
