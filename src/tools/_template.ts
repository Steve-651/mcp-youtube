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
const MyToolInputSchema = z.object({
  // Define your input parameters here
  message: z.string().describe('The message to process'),
  count: z.number().default(1).describe('Number of times to process'),
});

// STEP 2: Define your output schema
const MyToolOutputSchema = z.object({
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string(),
  })),
});

// Type definitions inferred from schemas
interface MyToolInput extends z.infer<typeof MyToolInputSchema> {}
interface MyToolOutput extends z.infer<typeof MyToolOutputSchema> {}

/**
 * STEP 3: Implement your tool
 * Update the name, description, and handler function
 */
export const myTool: ToolConfig<'myTool', MyToolInput, MyToolOutput> = {
  name: 'myTool', // CHANGE THIS: Must be unique
  description: 'Describe what your tool does', // CHANGE THIS
  inputSchema: MyToolInputSchema,
  outputSchema: MyToolOutputSchema,
  handler: async (input: MyToolInput): Promise<MyToolOutput> => {
    // STEP 4: Implement your tool logic here
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
export default myTool;

/**
 * OPTIONAL: Export types for use in other files
 */
export type { MyToolInput, MyToolOutput };