import z from "zod";

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