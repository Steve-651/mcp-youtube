import { z } from 'zod';
import { ToolConfig } from '../utils/toolDefinition.js';

// Input schema for the calculator tool
const CalculatorInputSchema = z.object({
  operation: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('The mathematical operation to perform'),
  a: z.number().describe('First number'),
  b: z.number().describe('Second number'),
});

// Output schema for the calculator tool
const CalculatorOutputSchema = z.object({
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string(),
  })),
});

// Type definitions inferred from schemas
interface CalculatorInput extends z.infer<typeof CalculatorInputSchema> {}
interface CalculatorOutput extends z.infer<typeof CalculatorOutputSchema> {}

/**
 * Calculator tool implementation
 * Performs basic mathematical operations
 */
export const calculatorTool: ToolConfig<'calculator', CalculatorInput, CalculatorOutput> = {
  name: 'calculator',
  description: 'Performs basic mathematical operations (add, subtract, multiply, divide)',
  inputSchema: CalculatorInputSchema,
  outputSchema: CalculatorOutputSchema,
  handler: async (input: CalculatorInput): Promise<CalculatorOutput> => {
    let result: number;
    
    switch (input.operation) {
      case 'add':
        result = input.a + input.b;
        break;
      case 'subtract':
        result = input.a - input.b;
        break;
      case 'multiply':
        result = input.a * input.b;
        break;
      case 'divide':
        if (input.b === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Division by zero is not allowed',
              },
            ],
          };
        }
        result = input.a / input.b;
        break;
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `${input.a} ${input.operation} ${input.b} = ${result}`,
        },
      ],
    };
  },
};

// Export as default for auto-discovery
export default calculatorTool;

// Export types for use in other files
export type { CalculatorInput, CalculatorOutput };