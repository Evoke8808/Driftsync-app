#!/usr/bin/env node
// SAP company-data MCP server over stdio. SkillSetu's agents start this themselves (srv/integrations/sap-mcp-client.js).
// For Claude Desktop: Settings > Developer > Edit Config, then add
//   { "mcpServers": { "sap": { "command": "/full/path/to/node", "args": ["/full/path/to/skillsetu/mcp/sap-stdio.js"] } } }
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { createSapServer } = require('./sap-mcp');

createSapServer().connect(new StdioServerTransport()).catch((e) => { console.error('SAP MCP failed to start:', e); process.exit(1); });
