/**
 * Auto-discovery based tool registry
 * 
 * This file automatically discovers and exports all tools from individual files.
 * To add a new tool:
 * 1. Create a new .ts file in this directory (e.g., 'myTool.ts')
 * 2. Follow the pattern in _template.ts
 * 3. Export your tool as default
 * 4. It will be automatically discovered and registered
 */

import { discoverTools, createToolRegistryMap } from '../utils/autoDiscovery.js';
import { ToolConfig } from '../utils/toolDefinition.js';

/**
 * Dynamically discover all tools
 */
export async function getAllTools(): Promise<ToolConfig[]> {
  return await discoverTools();
}

/**
 * Create a type-safe registry map from discovered tools
 */
export async function createAppToolRegistry() {
  const tools = await getAllTools();
  return createToolRegistryMap(tools);
}

/**
 * Get tool registry type (for static typing)
 * This will include all discovered tools
 */
export type AppToolRegistry = Awaited<ReturnType<typeof createAppToolRegistry>>;