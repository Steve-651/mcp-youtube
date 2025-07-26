# Tools Directory

This directory contains individual tool implementations that are automatically discovered and registered by the MCP server.

## How to Add a New Tool

1. **Copy the template**: Start with `_template.ts` as your base
2. **Create your tool file**: Name it descriptively (e.g., `weather.ts`, `calculator.ts`)
3. **Update the configuration**:
   - Change the tool name (must be unique)
   - Update the description
   - Define input and output schemas using Zod
   - Implement the handler function
4. **Export as default**: The auto-discovery system looks for default exports

## Example Tool Structure

```typescript
import { z } from 'zod';
import { ToolConfig } from '../utils/toolDefinition.js';

// Define schemas
const InputSchema = z.object({
  param: z.string().describe('Description of parameter'),
});

const OutputSchema = z.object({
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string(),
  })),
});

// Implement tool
export const myTool: ToolConfig<'myTool', Input, Output> = {
  name: 'myTool',
  description: 'What this tool does',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  handler: async (input) => {
    // Your logic here
    return { content: [{ type: 'text', text: 'Result' }] };
  },
};

export default myTool;
```

## Auto-Discovery Features

- **No registration needed**: Tools are automatically found and registered
- **Type safety**: Full TypeScript support with Zod schema validation
- **Hot-reload friendly**: Add new tools without touching existing code
- **Error handling**: Invalid tools are logged but don't break the system

## Current Tools

- `hello.ts` - Simple greeting tool (example)
- `_template.ts` - Template for creating new tools (not registered)

## Best Practices

1. **Descriptive names**: Use clear, descriptive tool names
2. **Good schemas**: Define comprehensive input/output validation
3. **Error handling**: Handle edge cases in your handler functions
4. **Documentation**: Use Zod's `.describe()` for parameter documentation
5. **Type safety**: Always export proper TypeScript types