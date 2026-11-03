// SkillSetu MCP over the web: POST /mcp on the SkillSetu server (MCP Streamable HTTP, stateless).
// Needs the same x-api-key header as the Integration API. Each request gets a fresh MCP server.
const express = require('express');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createServer } = require('./skillsetu-mcp');
const { createSapServer } = require('./sap-mcp');

const API_KEY = process.env.SKILLSETU_API_KEY || 'skillsetu-demo-key';
const rpcError = (res, status, code, message) => res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });

function mount(app) {
  serve(app, '/mcp', (req) => createServer({ baseUrl: `${req.protocol}://${req.get('host')}`, apiKey: API_KEY }));
  // The SAP company-data MCP server (read-only open jobs from SuccessFactors / HANA Cloud), same API key.
  serve(app, '/sap-mcp', () => createSapServer());
}

function serve(app, route, make) {
  app.post(route, express.json({ limit: '1mb' }), async (req, res) => {
    if (req.get('x-api-key') !== API_KEY) return rpcError(res, 401, -32001, 'Missing or wrong x-api-key header');
    const server = make(req);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      if (!res.headersSent) rpcError(res, 500, -32603, 'Internal error');
    }
  });
  const onlyPost = (req, res) => { res.set('Allow', 'POST'); rpcError(res, 405, -32000, 'Method not allowed: use POST'); };
  app.get(route, onlyPost);
  app.delete(route, onlyPost);
}

module.exports = { mount };
