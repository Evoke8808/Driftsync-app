// MCP client for the Company MCP server (mcp/company-mcp.js): agent -> MCP (Streamable HTTP) -> company data.
// It talks to /company-mcp on this same server, exactly like an outside MCP client would.
const cds = require('@sap/cds');

const LOG = cds.log('company-mcp');
const URL_ = () => `http://127.0.0.1:${process.env.PORT || 4004}/company-mcp`;
const KEY = () => process.env.SKILLSETU_API_KEY || 'skillsetu-demo-key';

// Calls one tool and returns { data, ms }, or throws.
async function callTool(name, args) {
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const t0 = Date.now();
  const client = new Client({ name: 'skillsetu-agents', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(URL_()), { requestInit: { headers: { 'x-api-key': KEY() } } });
  try {
    await client.connect(transport);
    const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 15000 });
    const texts = (res.content || []).filter((c) => c.type === 'text').map((c) => c.text);
    if (res.isError) throw new Error(texts.join(' ') || `${name} failed`);
    return { data: JSON.parse(texts[texts.length - 1]), ms: Date.now() - t0, tool: name };
  } finally { try { await client.close(); } catch (e) { /* already closed */ } }
}

const safe = async (name, args) => { try { return await callTool(name, args); } catch (e) { LOG.warn(`${name}:`, e.message); return { error: e.message, tool: name }; } };

// A trace line per MCP call, for the Agent trace panel and the audit log.
const traceOf = (r, what) => ({ agent: 'company-mcp', name: 'Company MCP', icon: '🏢', routedBy: '-', reason: `MCP tool ${r.tool}: ${r.error ? `failed (${r.error})` : what}`, provider: 'Company MCP', model: null, ms: r.ms || 0 });

module.exports = { callTool, safe, traceOf };
