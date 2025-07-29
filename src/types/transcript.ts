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

export const TranscriptSchema = z.object({
  video_id: z.string().describe("YouTube video ID"),
  title: z.string().describe("Video title"),
  uploader: z.string().describe("Channel/uploader name"),
  duration: z.number().int().describe("Video duration in seconds"),
  url: z.string().describe("Original YouTube URL"),
  transcript: z.array(TranscriptSegmentSchema).describe("Array of transcript segments"),
  metadata: TranscriptMetadataSchema,
});

export interface TranscriptSegment extends z.infer<typeof TranscriptSegmentSchema> { }
export interface TranscriptMetadata extends z.infer<typeof TranscriptMetadataSchema> { }
export interface Transcript extends z.infer<typeof TranscriptSchema> { }