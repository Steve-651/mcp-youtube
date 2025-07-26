import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ToolConfig } from './toolDefinition.js';

/**
 * Auto-discovers tool files in the tools directory
 * Each tool file should export a default ToolConfig
 */
export async function discoverTools(): Promise<ToolConfig[]> {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const toolsDir = join(currentDir, '..', 'tools');
  
  const tools: ToolConfig[] = [];
  
  try {
    const files = await fs.readdir(toolsDir);
    
    // Filter for TypeScript/JavaScript files, excluding index and template files
    const toolFiles = files.filter(file => 
      (file.endsWith('.ts') || file.endsWith('.js')) && 
      file !== 'index.ts' && 
      file !== 'index.js' &&
      !file.startsWith('_') &&  // Exclude template and utility files
      file !== 'README.md'
    );
    
    for (const file of toolFiles) {
      try {
        const modulePath = join(toolsDir, file);
        // Convert to file URL for Windows compatibility
        const moduleUrl = new URL(`file://${modulePath.replace(/\\/g, '/')}`).href;
        // Use dynamic import for ES modules
        const module = await import(moduleUrl);
        
        // Check if the module has a default export that looks like a tool
        if (module.default && isValidTool(module.default)) {
          tools.push(module.default);
          console.error(`✓ Loaded tool: ${module.default.name} from ${file}`);
        } else {
          console.error(`⚠ Warning: ${file} does not export a valid tool`);
        }
      } catch (error) {
        console.error(`✗ Error loading tool from ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('Error reading tools directory:', error);
  }
  
  return tools;
}

/**
 * Validates that an object is a valid tool configuration
 */
function isValidTool(obj: any): obj is ToolConfig {
  return obj &&
    typeof obj === 'object' &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    obj.inputSchema &&
    obj.outputSchema &&
    typeof obj.handler === 'function';
}

/**
 * Creates a tool registry map type from discovered tools
 * This helps maintain type safety even with dynamic discovery
 */
export type DiscoveredToolsMap = Record<string, ToolConfig>;

/**
 * Helper to create a strongly typed registry from discovered tools
 */
export function createToolRegistryMap(tools: ToolConfig[]): DiscoveredToolsMap {
  const map: DiscoveredToolsMap = {};
  for (const tool of tools) {
    map[tool.name] = tool;
  }
  return map;
}