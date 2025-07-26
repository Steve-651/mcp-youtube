#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const mcpServer = new McpServer({
  name: 'mcp-youtube',
  version: '1.0.0',
});

// Simple tool registration using MCP SDK
mcpServer.registerTool("hello", {
  description: "Say hello with a personalized greeting",
  inputSchema: {
    name: z.string().optional().describe("Name to greet (optional)"),
  },
}, async ({ name }) => {
  const greeting = name ? `Hello, ${name}!` : "Hello, World!";
  return {
    content: [
      {
        type: "text",
        text: greeting,
      },
    ],
  };
});

mcpServer.registerTool("test", {
  description: "Test tool for checking the server functionality",
  inputSchema: {
    message: z.string().describe("The message to process"),
    count: z.number().default(1).describe("Number of times to process"),
  },
}, async ({ message, count }) => {
  const result = `Processed "${message}" ${count} time(s)`;
  return {
    content: [
      {
        type: "text",
        text: result,
      },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('MCP YouTube server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});