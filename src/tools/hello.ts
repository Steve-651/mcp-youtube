import { z } from 'zod';
import { ToolConfig } from '../utils/toolDefinition.js';

// Input schema for the hello tool
const HelloInputSchema = z.object({
  name: z.string().describe('Name to greet').default('World'),
});

// Output schema for the hello tool
const HelloOutputSchema = z.object({
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string(),
  })),
});

// Type definitions inferred from schemas
interface HelloInput extends z.infer<typeof HelloInputSchema> {}
interface HelloOutput extends z.infer<typeof HelloOutputSchema> {}

/**
 * Hello tool implementation
 * This is a complete, self-contained tool definition
 */
export const helloTool: ToolConfig<'hello', HelloInput, HelloOutput> = {
  name: 'hello',
  description: 'A simple hello world tool that greets users',
  inputSchema: HelloInputSchema,
  outputSchema: HelloOutputSchema,
  handler: async (input: HelloInput): Promise<HelloOutput> => {
    return {
      content: [
        {
          type: 'text',
          text: `Hello, ${input.name}! This is a simple MCP hello world server.`,
        },
      ],
    };
  },
};

// Export the tool as default for auto-discovery
export default helloTool;