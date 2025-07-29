import { TranscriptSegment } from "./transcript";

// External process execution functions
export interface VideoMetadata {
  id: string;
  title: string;
  uploader: string;
  channel?: string;
  duration: string;
}

export interface SubtitleExtractionResult {
  transcriptSegments: Array<TranscriptSegment>;
  language: string;
}