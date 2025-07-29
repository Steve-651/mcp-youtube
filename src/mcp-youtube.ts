#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import registerPrompts from './prompts.js';
import registerTools from './tools.js';
import registerResources from './resources.js';

const server = new Server({
  name: 'mcp-youtube',
  version: '1.0.0',
  title: 'YouTube Transcription MCP Server',
},
  {
    capabilities: {
      prompts: {},
      resources: { subscribe: true },
      tools: {},
      logging: {},
    },
  }
);

registerPrompts(server);
registerResources(server);
registerTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});