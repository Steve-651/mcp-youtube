import z from "zod";
import {
  TranscriptSchema
} from "./transcript.js";

// Enums

export enum ToolName {
  TRANSCRIBE_YOUTUBE = "transcribe_youtube",
  GET_TRANSCRIPT = "get_transcript",
}

// Tool input schemas

export const ToolTranscribeYoutubeInputSchema = z.object({
  url: z.string().describe("YouTube video URL"),
});

export const ToolGetTranscriptInputSchema = z.object({
  videoId: z.string().describe("YouTube video ID"),
});

// Tool output schemas

export const ToolTranscribeYoutubeOutputSchema = z.object({
  video_id: z.string().describe("YouTube video ID"),
  title: z.string().describe("Video title"),
  uploader: z.string().describe("Channel/uploader name"),
  transcript_segments_count: z.number().int(),
  next_action: z.object({
    tool: z.literal(ToolName.GET_TRANSCRIPT),
    parameters: ToolGetTranscriptInputSchema
  })
});

export const ToolGetTranscriptOutputSchema = TranscriptSchema.extend({});

// Types

export interface ToolTranscribeYoutubeOutput extends z.infer<typeof ToolTranscribeYoutubeOutputSchema> { }
export interface ToolGetTranscriptOutput extends z.infer<typeof ToolGetTranscriptOutputSchema> { }