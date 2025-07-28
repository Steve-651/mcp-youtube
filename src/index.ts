#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

// Configuration
const TRANSCRIPTS_FOLDER = process.env.TRANSCRIPTS_FOLDER || './transcripts';

const mcpServer = new McpServer({
  name: 'mcp-youtube',
  version: '1.0.0',
  title: 'YouTube Transcription MCP Server'
});

// Ensure transcripts folder exists
async function ensureTranscriptsFolder() {
  try {
    await fs.mkdir(TRANSCRIPTS_FOLDER, { recursive: true });
  } catch (error) {
    console.error('Failed to create transcripts folder:', error);
  }
}

mcpServer.registerTool("transcribe_youtube", {
  description: "Extract transcript from YouTube video with progress reporting and save to configurable folder",
  inputSchema: {
    url: z.string().describe("YouTube video URL"),
  },
}, async ({ url }) => {
  try {
    await ensureTranscriptsFolder();
    
    // Extract video ID for file naming
    let videoId = "UNKNOWN";
    try {
      const urlObj = new URL(url);
      videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop() || "UNKNOWN";
    } catch (urlError) {
      console.error('URL parsing error:', urlError);
    }

    console.error("Starting YouTube transcript extraction...");

    // First, get video metadata
    console.error("Getting video metadata...");

    const metadataArgs = [
      '--dump-json',
      '--no-download',
      '--socket-timeout', '30',
      url
    ];
    
    const { stdout: metadataJson } = await execFileAsync('yt-dlp', metadataArgs, { timeout: 30000 });
    const metadata = JSON.parse(metadataJson);
    
    const actualVideoId = metadata.id || videoId;
    const title = metadata.title || "TITLE NOT FOUND";
    const uploader = metadata.uploader || metadata.channel || "UPLOADER NOT FOUND";
    const duration = Math.floor(metadata.duration || 0);

    console.error(`Found video: "${title}" by ${uploader}`);

    // Now get subtitles/transcript
    let transcriptData: Array<{start: number, duration: number, text: string}> = [];
    let language = "unknown";
    
    try {
      console.error("Extracting subtitles...");

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
      
      console.error("Processing subtitle file...");
      
      // Find and read the VTT file
      const files = await fs.readdir('.');
      const vttFile = files.find(f => f.startsWith(`temp_${actualVideoId}`) && f.endsWith('.vtt'));
      
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
              transcriptData.push({
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
      
    } catch (subtitleError) {
      console.error('Subtitle extraction failed:', subtitleError);
    }
    
    console.error("Saving transcript to file...");
    
    const structuredResult = {
      success: true as const,
      video_id: actualVideoId,
      title: title,
      uploader: uploader,
      duration: duration,
      url: url,
      transcript: transcriptData.length > 0 ? transcriptData : [{
        start: 0,
        duration: 0,
        text: "No transcript available for this video"
      }],
      metadata: {
        transcription_date: new Date().toISOString(),
        source: "yt_dlp" as const,
        language: language,
        confidence: transcriptData.length > 0 ? 0.95 : 0.0
      }
    };

    // Save transcript to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${actualVideoId}_${timestamp}.json`;
    const filepath = path.join(TRANSCRIPTS_FOLDER, filename);
    
    await fs.writeFile(filepath, JSON.stringify(structuredResult, null, 2));
    
    console.error(`Transcript saved to ${filepath}`);

    return {
      content: [{
        type: 'text' as const,
        text: `Successfully extracted transcript for "${title}" by ${uploader}. Found ${transcriptData.length} transcript segments. Saved to: ${filepath}`
      }],
      structuredContent: {
        ...structuredResult,
        resource_uri: `file://${path.resolve(filepath)}`
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('yt-dlp extraction error:', error);
    
    // Try to extract video ID for debugging
    let videoId = "UNKNOWN";
    try {
      const urlObj = new URL(url);
      videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop() || "UNKNOWN";
    } catch (urlError) {
      console.error('URL parsing error:', urlError);
    }
    
    // Determine error type based on error message
    let errorType: "transcript_unavailable" | "rate_limited" | "private_video" | "invalid_url" | "region_restricted" | "age_restricted" | "unknown" = "unknown";
    let message = "An unexpected error occurred while processing the video with yt-dlp.";
    let suggestedAction = "Make sure yt-dlp is installed and accessible in your PATH.";
    
    const errorLower = errorMessage.toLowerCase();
    
    switch (true) {
      case errorLower.includes("command not found") || errorLower.includes("enoent"):
        errorType = "unknown";
        message = "yt-dlp is not installed or not found in PATH.";
        suggestedAction = "Install yt-dlp: pip install yt-dlp or download from GitHub releases.";
        break;
      case errorLower.includes("unavailable") || errorLower.includes("private"):
        errorType = "private_video";
        message = "This video is unavailable or private.";
        suggestedAction = "Try a different public video.";
        break;
      case errorLower.includes("age") || errorLower.includes("sign"):
        errorType = "age_restricted";
        message = "This video is age-restricted.";
        suggestedAction = "Try a non-age-restricted video.";
        break;
      default:
        errorType = "unknown";
        message = "yt-dlp failed to process this video.";
        suggestedAction = "Check if the URL is valid and the video is accessible.";
        break;
    }
    
    // Throw structured error
    const structuredError = {
      error_type: errorType,
      message: message,
      video_id: videoId,
      suggested_action: suggestedAction,
      original_error: errorMessage
    };
    
    throw new Error(JSON.stringify(structuredError, null, 2));
  }
});

// Helper function to parse VTT time format (HH:MM:SS.mmm) to seconds
function parseVTTTime(timeStr: string): number {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  const seconds = parseFloat(parts[2]) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('MCP YouTube server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});