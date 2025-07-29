import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from 'fs';
import path from "path";
import {
  ToolGetTranscriptOutputSchema,
  ToolGetTranscriptOutput
} from "./types/tools.js";
import { TRANSCRIPTS_FOLDER } from "./config.js";
import { ensureTranscriptsFolder } from "./util.js";

const execFileAsync = promisify(execFile);

// External process execution functions
export interface VideoMetadata {
  id: string;
  title: string;
  uploader: string;
  channel?: string;
  duration: number;
}

export async function getVideoMetadata(url: string): Promise<VideoMetadata> {
  const metadataArgs = [
    '--dump-json',
    '--no-download',
    '--socket-timeout', '30',
    url
  ];

  const { stdout: metadataJson } = await execFileAsync('yt-dlp', metadataArgs, { timeout: 30000 });
  const metadata = JSON.parse(metadataJson);

  return {
    id: metadata.id,
    title: metadata.title || "TITLE NOT FOUND",
    uploader: metadata.uploader || metadata.channel || "UPLOADER NOT FOUND",
    channel: metadata.channel,
    duration: Math.floor(metadata.duration || 0)
  };
}

export interface SubtitleExtractionResult {
  transcriptSegments: Array<{ start: number, duration: number, text: string }>;
  language: string;
}

export async function extractSubtitles(url: string, videoId: string): Promise<SubtitleExtractionResult> {
  const subtitleArgs = [
    '--write-auto-subs',
    '--write-subs',
    '--sub-langs', 'en,en-US,en-GB',
    '--sub-format', 'vtt',
    '--skip-download',
    '--socket-timeout', '30',
    '--output', 'temp_%(id)s.%(ext)s',
    url
  ];

  await execFileAsync('yt-dlp', subtitleArgs, { timeout: 45000 });

  // Find and read the VTT file
  const files = await fs.readdir('.');
  const vttFile = files.find(f => f.startsWith(`temp_${videoId}`) && f.endsWith('.vtt'));

  let transcriptSegments: Array<{ start: number, duration: number, text: string }> = [];
  let language = "unknown";

  if (vttFile) {
    const vttContent = await fs.readFile(vttFile, 'utf-8');

    // Parse VTT content
    const lines = vttContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Time line format: 00:00:00.000 --> 00:00:03.000
      if (line.includes(' --> ')) {
        const [startTime, endTime] = line.split(' --> ');
        const start = parseVTTTime(startTime);
        const end = parseVTTTime(endTime);

        // Get text from next non-empty lines
        let textLines = [];
        for (let j = i + 1; j < lines.length && lines[j].trim() !== ''; j++) {
          if (!lines[j].includes(' --> ')) {
            textLines.push(lines[j].trim());
          }
        }

        if (textLines.length > 0) {
          transcriptSegments.push({
            start: Math.floor(start),
            duration: Math.floor(end - start),
            text: textLines.join(' ').replace(/<[^>]*>/g, '') // Remove HTML tags
          });
        }
      }
    }

    // Clean up the temp file
    await fs.unlink(vttFile);
    language = "en"; // Default since we requested English
  }

  return { transcriptSegments: transcriptSegments, language };
}

// Helper function to parse VTT time format (HH:MM:SS.mmm) to seconds
function parseVTTTime(timeStr: string): number {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  const seconds = parseFloat(parts[2]) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

// File I/O functions
export async function writeTranscriptFile(videoId: string, transcriptData: ToolGetTranscriptOutput): Promise<string> {
  await ensureTranscriptsFolder();

  const filename = `${videoId}.json`;
  const filepath = path.join(TRANSCRIPTS_FOLDER, filename);

  await fs.writeFile(filepath, JSON.stringify(transcriptData, null, 2));

  console.error(`Transcript saved to ${filepath}`);
  return filepath;
}

export async function readTranscriptFile(videoId: string): Promise<ToolGetTranscriptOutput> {
  const filename = `${videoId}.json`;
  const filepath = path.join(TRANSCRIPTS_FOLDER, filename);

  // Check if transcript file exists
  try {
    await fs.access(filepath);
  } catch {
    throw new Error(`No transcript found for video ID: ${videoId}`);
  }

  // Read and parse the transcript file
  const content = await fs.readFile(filepath, 'utf-8');

  // First parse JSON, then validate with Zod
  let jsonData;
  try {
    jsonData = JSON.parse(content);
  } catch (parseError) {
    throw new Error(`Invalid JSON in transcript file: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
  }

  const transcriptParseResult = ToolGetTranscriptOutputSchema.safeParse(jsonData);

  if (!transcriptParseResult.success) {
    console.error('Transcript validation error:', transcriptParseResult.error);
    throw new Error("Invalid transcript file format.");
  }

  return transcriptParseResult.data;
}

export async function transcriptFileExists(videoId: string): Promise<boolean> {
  const filename = `${videoId}.json`;
  const filepath = path.join(TRANSCRIPTS_FOLDER, filename);

  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

export async function listTranscriptFiles(): Promise<string[]> {
  await ensureTranscriptsFolder();
  const files = await fs.readdir(TRANSCRIPTS_FOLDER);
  return files.filter(file => file.endsWith('.json'));
}