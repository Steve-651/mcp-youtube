import z from "zod";

// Enums

export enum ToolName {
  TRANSCRIBE_YOUTUBE = "transcribe_youtube",
  GET_TRANSCRIPT = "get_transcript",
}

// Data structure schemas

export const TranscriptSegmentSchema = z.object({
  start: z.number().int().describe("Start time in seconds"),
  duration: z.number().int().describe("Duration in seconds"),
  text: z.string().describe("Transcript text"),
});

export const TranscriptMetadataSchema = z.object({
  transcription_date: z.string().describe("ISO datetime when transcript was created"),
  source: z.enum(["yt_dlp"]).describe("Source of transcription"),
  language: z.string().describe("Language of the transcript"),
  confidence: z.number().min(0).max(1).describe("Confidence score of transcription"),
});

// Tool input schemas

export const ToolTranscribeYoutubeInputSchema = z.object({
  url: z.string().describe("YouTube video URL"),
});

export const ToolGetTranscriptInputSchema = z.object({
  videoId: z.string().describe("YouTube video ID"),
});

// Tool output schemas

export const ToolGetTranscriptOutputSchema = z.object({
  success: z.literal(true),
  video_id: z.string().describe("YouTube video ID"),
  title: z.string().describe("Video title"),
  uploader: z.string().describe("Channel/uploader name"),
  duration: z.number().int().describe("Video duration in seconds"),
  url: z.string().describe("Original YouTube URL"),
  transcript: z.array(TranscriptSegmentSchema).describe("Array of transcript segments"),
  metadata: TranscriptMetadataSchema,
});

// Types

export type TranscriptData = z.infer<typeof ToolGetTranscriptOutputSchema>;