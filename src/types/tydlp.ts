// External process execution functions
export interface VideoMetadata {
  id: string;
  title: string;
  uploader: string;
  channel?: string;
  duration: number;
}


export interface SubtitleExtractionResult {
  transcriptSegments: Array<{ start: number, duration: number, text: string }>;
  language: string;
}