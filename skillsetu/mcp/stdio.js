#!/usr/bin/env node
// SkillSetu MCP server for Claude Desktop (stdio). SkillSetu itself must be running (cds watch).
// Claude Desktop > Settings > Developer > Edit Config, then add:
//   { "mcpServers": { "skillsetu": { "command": "/full/path/to/node", "args": ["/full/path/to/skillsetu/mcp/stdio.js"] } } }
// Optional env: SKILLSETU_URL (default http://localhost:4004), SKILLSETU_API_KEY (default skillsetu-demo-key).
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { createServer } = require('./skillsetu-mcp');

createServer().connect(new StdioServerTransport()).catch((e) => { console.error('SkillSetu MCP failed to start:', e); process.exit(1); });
