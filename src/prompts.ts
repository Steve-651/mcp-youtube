import { ListPromptsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export default function registerPrompts(server: Server) {

  // List prompts handler  
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [],
    };
  });
}