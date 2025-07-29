import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from 'fs';
import { ExecError, YtDlpError } from "./types/errors.js";
import { SubtitleExtractionResult, VideoMetadata } from "./types/tydlp.js";

const execFileAsync = promisify(execFile);

// Simple wrapper that just throws YtDlpError with exit code
async function execYtDlp(args: string[], timeout: number = 30000): Promise<string> {
  try {
    const { stdout } = await execFileAsync('yt-dlp', args, { timeout });
    return stdout;
  } catch (error) {
    const execError = error as ExecError;
    const exitCode = execError.code || 'unknown';
    const stderr = execError.stderr || '';

    // Special case for no subtitles - return empty instead of error
    if (stderr.includes('no automatic subtitles') || stderr.includes('no subtitles')) {
      throw new Error('NO_SUBTITLES_AVAILABLE');
    }

    throw new YtDlpError(execError.message || 'yt-dlp execution failed', exitCode, stderr);
  }
}

export async function getVideoMetadata(url: string): Promise<VideoMetadata> {
  const metadataArgs = [
    '--dump-json',
    '--no-download',
    '--socket-timeout', '30',
    url
  ];

  const metadataJson = await execYtDlp(metadataArgs, 30000);
  const metadata = JSON.parse(metadataJson);

  return {
    id: metadata.id,
    title: metadata.title || "TITLE NOT FOUND",
    uploader: metadata.uploader || metadata.channel || "UPLOADER NOT FOUND",
    channel: metadata.channel,
    duration: Math.floor(metadata.duration || 0)
  };
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

  try {
    await execYtDlp(subtitleArgs, 45000);
  } catch (error) {
    // Handle the special case where no subtitles are available
    if (error instanceof Error && error.message === 'NO_SUBTITLES_AVAILABLE') {
      return { transcriptSegments: [], language: "unknown" };
    }
    // Re-throw YtDlpError instances
    throw error;
  }

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