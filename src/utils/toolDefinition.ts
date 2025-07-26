import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Use official MCP types instead of custom ones
export interface ToolDefinition extends Tool {}

export type ToolHandler<TInput, TOutput> = (input: TInput) => Promise<CallToolResult> | CallToolResult;

export interface ToolConfig<TName extends string = string, TInput = any, TOutput = any> {
  name: TName;
  description: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodSchema<TOutput>;
  handler: ToolHandler<TInput, TOutput>;
}

/**
 * Creates a tool definition from a Zod schema
 * Ensures compatibility with MCP protocol requirements
 */
export function createToolDefinition(
  name: string,
  description: string,
  schema: z.ZodTypeAny
): ToolDefinition {
  const jsonSchema = zodToJsonSchema(schema, name) as any;
  
  // Handle the case where zod-to-json-schema uses $ref and definitions
  let actualSchema = jsonSchema;
  if (jsonSchema.$ref && jsonSchema.definitions) {
    const refKey = jsonSchema.$ref.replace('#/definitions/', '');
    actualSchema = jsonSchema.definitions[refKey];
  }
  
  // Ensure the schema has the required MCP structure
  const mcpSchema: any = {
    type: 'object',
    properties: actualSchema.properties || {},
    required: actualSchema.required || [],
  };
  
  // Copy other relevant properties
  if (actualSchema.description) mcpSchema.description = actualSchema.description;
  if (actualSchema.examples) mcpSchema.examples = actualSchema.examples;
  
  return {
    name,
    description,
    inputSchema: mcpSchema,
  };
}

/**
 * Tool registry type that maps tool names to their configurations
 */
export type ToolRegistryMap = Record<string, ToolConfig<string, any, any>>;

/**
 * Extract tool names from a tool registry map
 */
export type ToolNames<T extends ToolRegistryMap> = keyof T & string;

/**
 * Extract input type for a specific tool
 */
export type ToolInput<T extends ToolRegistryMap, K extends ToolNames<T>> = 
  T[K]['inputSchema'] extends z.ZodTypeAny ? z.infer<T[K]['inputSchema']> : never;

/**
 * Extract output type for a specific tool
 */
export type ToolOutput<T extends ToolRegistryMap, K extends ToolNames<T>> = 
  T[K]['outputSchema'] extends z.ZodSchema<infer O> ? O : never;

/**
 * Enhanced tool registry with strongly typed names and execution
 */
export class ToolRegistry<T extends ToolRegistryMap = ToolRegistryMap> {
  private tools = new Map<string, ToolConfig>();
  private typeMap = {} as T;

  /**
   * Register a tool with input schema, output schema, and handler
   */
  register<TName extends string, TInput, TOutput>(
    config: ToolConfig<TName, TInput, TOutput>
  ): ToolRegistry<T & Record<TName, ToolConfig<TName, TInput, TOutput>>> {
    this.tools.set(config.name, config);
    return this as any;
  }

  /**
   * Get the input schema for a tool
   */
  getInputSchema<K extends ToolNames<T>>(name: K): z.ZodTypeAny | undefined {
    return this.tools.get(name)?.inputSchema;
  }

  /**
   * Get the output schema for a tool
   */
  getOutputSchema<K extends ToolNames<T>>(name: K): z.ZodTypeAny | undefined {
    return this.tools.get(name)?.outputSchema;
  }

  /**
   * Get all tool definitions for MCP
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(({ name, description, inputSchema }) =>
      createToolDefinition(name, description, inputSchema)
    );
  }

  /**
   * Execute a tool with strong typing and validation
   */
  async execute<K extends ToolNames<T>>(
    toolName: K, 
    args: ToolInput<T, K>
  ): Promise<CallToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    // Validate input
    const validatedInput = tool.inputSchema.parse(args);
    
    // Execute handler and return MCP-compliant result
    const result = await tool.handler(validatedInput);
    
    return result;
  }

  /**
   * Validate tool arguments with strong typing
   */
  validate<K extends ToolNames<T>>(toolName: K, args: unknown): ToolInput<T, K> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    return tool.inputSchema.parse(args) as ToolInput<T, K>;
  }

  /**
   * Get all registered tool names with strong typing
   */
  getToolNames(): ToolNames<T>[] {
    return Array.from(this.tools.keys()) as ToolNames<T>[];
  }
}