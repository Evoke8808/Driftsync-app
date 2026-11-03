// SkillSetu server: the normal CAP server, plus the MCP endpoints (see mcp/http.js),
// compression and browser caching so the page reloads fast even from a far-away data centre.
const path = require('path');
const express = require('express');
const cds = require('@sap/cds');

cds.on('bootstrap', (app) => {
  // Compress text responses (the SAP UI5 bundle shrinks from 1.2 MB to about 300 KB). MCP streams are left alone.
  try {
    const compression = require('compression');
    app.use(compression({ filter: (req, res) => !/^\/(sap-)?mcp\b/.test(req.path) && compression.filter(req, res) }));
  } catch (e) { cds.log('server').warn('Compression is off (run "npm install"):', e.message); }

  // Static files: the UI5 bundle and fonts never change, so browsers keep them for 30 days.
  // The page itself is always checked, and app.js / styles.css are reused for 10 minutes.
  const dir = path.join(__dirname, 'app');
  app.use('/vendor', express.static(path.join(dir, 'vendor'), { maxAge: '30d', immutable: true }));
  app.use('/fonts', express.static(path.join(dir, 'fonts'), { maxAge: '30d', immutable: true }));
  app.use(express.static(dir, {
    maxAge: '10m',
    setHeaders: (res, file) => { if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); }
  }));

  try { require('./mcp/http').mount(app); }
  catch (e) { cds.log('mcp').warn('MCP endpoint is off (run "npm install" to turn it on):', e.message); }
});
module.exports = cds.server;
