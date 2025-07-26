/**
 * TEMPLATE: Copy this file to create a new tool
 * 
 * Steps to create a new tool:
 * 1. Copy this file and rename it (e.g., 'myNewTool.ts')
 * 2. Update the tool name, description, and schemas
 * 3. Implement the handler function
 * 4. The tool will be automatically discovered and registered
 */

import { z } from 'zod';
import { ToolConfig } from '../utils/toolDefinition.js';

// STEP 1: Define your input schema
const TestInputSchema = z.object({
  // Define your input parameters here
  message: z.string().describe('The message to process'),
  count: z.number().default(1).describe('Number of times to process'),
});

// STEP 2: Define your output schema
const TestOutputSchema = z.object({
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string(),
  })),
});

// Type definitions inferred from schemas
interface TestInput extends z.infer<typeof TestInputSchema> {}
interface TestOutput extends z.infer<typeof TestOutputSchema> {}

/**
 * STEP 3: Implement your tool
 * Update the name, description, and handler function
 */
export const test: ToolConfig<'test', TestInput, TestOutput> = {
  name: 'test',
  description: 'Test tool for checking the auto discovery and registration of tools',
  inputSchema: TestInputSchema,
  outputSchema: TestOutputSchema,
  handler: async (input: TestInput): Promise<TestOutput> => {
    const result = `Processed "${input.message}" ${input.count} time(s)`;
    
    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  },
};

// Export as default for auto-discovery
export default test;

/**
 * OPTIONAL: Export types for use in other files
 */
export type { TestInput, TestOutput };