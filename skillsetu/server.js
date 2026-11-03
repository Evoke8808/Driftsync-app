// SkillSetu server: the normal CAP server, plus the MCP endpoint at /mcp (see mcp/http.js).
const cds = require('@sap/cds');
cds.on('bootstrap', (app) => {
  try { require('./mcp/http').mount(app); }
  catch (e) { cds.log('mcp').warn('MCP endpoint is off (run "npm install" to turn it on):', e.message); }
});
module.exports = cds.server;
