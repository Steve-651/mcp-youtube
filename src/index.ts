#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ToolRegistry } from './utils/toolDefinition.js';
import { getAllTools, AppToolRegistry } from './tools/index.js';

// Initialize tool registry with auto-discovered tools
async function initializeToolRegistry() {
  const tools = await getAllTools();
  const toolRegistry = new ToolRegistry<AppToolRegistry>();
  
  // Register all discovered tools
  tools.forEach(tool => {
    toolRegistry.register(tool);
  });
  
  console.error(`📦 Registered ${tools.length} tool(s): ${tools.map(t => t.name).join(', ')}`);
  return toolRegistry;
}

const toolRegistry = await initializeToolRegistry();

const server = new Server(
  {
    name: 'mcp-hello-world',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolRegistry.getToolDefinitions(),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Type assertion for tool name - we validate it exists below
    const toolName = name as keyof AppToolRegistry;
    
    // Check if tool exists
    if (!toolRegistry.getToolNames().includes(toolName)) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    // Execute with strong typing - input/output automatically validated
    return await toolRegistry.execute(toolName, args);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Hello World server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});