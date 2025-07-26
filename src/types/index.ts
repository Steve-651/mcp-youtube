import { z } from 'zod';

// Base MCP schemas (keep these as they're not tool-specific)
export const MCPErrorSchema = z.object({
    code: z.number(),
    message: z.string(),
    data: z.any().optional(),
});

export const MCPRequestSchema = z.object({
    id: z.string(),
    method: z.string(),
    params: z.any().optional(),
});

export const MCPResponseSchema = z.object({
    id: z.string(),
    result: z.any().optional(),
    error: MCPErrorSchema.optional(),
});

export const MCPNotificationSchema = z.object({
    method: z.string(),
    params: z.any().optional(),
});

// Interface exports (inferred from schemas)
export interface MCPError extends z.infer<typeof MCPErrorSchema> {}
export interface MCPRequest extends z.infer<typeof MCPRequestSchema> {}
export interface MCPResponse extends z.infer<typeof MCPResponseSchema> {}
export interface MCPNotification extends z.infer<typeof MCPNotificationSchema> {}