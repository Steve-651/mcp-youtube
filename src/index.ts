#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  Resource,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

// Configuration
const TRANSCRIPTS_FOLDER = process.env.TRANSCRIPTS_FOLDER || './transcripts';

const server = new Server({
  name: 'mcp-youtube',
  version: '1.0.0',
  title: 'YouTube Transcription MCP Server',
},
  {
    capabilities: {
      prompts: {},
      resources: { subscribe: true },
      tools: {},
      logging: {},
    },
  }
);

// Zod schema for transcribe_youtube tool
const TranscribeYouTubeSchema = z.object({
  url: z.string().describe("YouTube video URL"),
});

// Zod schema for transcript data structure
const TranscriptSegmentSchema = z.object({
  start: z.number().int().describe("Start time in seconds"),
  duration: z.number().int().describe("Duration in seconds"),
  text: z.string().describe("Transcript text"),
});

const TranscriptMetadataSchema = z.object({
  transcription_date: z.string().describe("ISO datetime when transcript was created"),
  source: z.enum(["yt_dlp"]).describe("Source of transcription"),
  language: z.string().describe("Language of the transcript"),
  confidence: z.number().min(0).max(1).describe("Confidence score of transcription"),
});

const TranscriptSchema = z.object({
  success: z.literal(true),
  video_id: z.string().describe("YouTube video ID"),
  title: z.string().describe("Video title"),
  uploader: z.string().describe("Channel/uploader name"),
  duration: z.number().int().describe("Video duration in seconds"),
  url: z.string().describe("Original YouTube URL"),
  transcript: z.array(TranscriptSegmentSchema).describe("Array of transcript segments"),
  metadata: TranscriptMetadataSchema,
});

// Tool names enum
enum ToolName {
  TRANSCRIBE_YOUTUBE = "transcribe_youtube",
}

// Ensure transcripts folder exists
async function ensureTranscriptsFolder() {
  try {
    await fs.mkdir(TRANSCRIPTS_FOLDER, { recursive: true });
  } catch (error) {
    console.error('Failed to create transcripts folder:', error);
  }
}

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: ToolName.TRANSCRIBE_YOUTUBE,
        description: "Extract transcript from YouTube video with progress reporting and save to configurable folder",
        inputSchema: zodToJsonSchema(TranscribeYouTubeSchema),
      },
    ],
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === ToolName.TRANSCRIBE_YOUTUBE) {
    const validatedArgs = TranscribeYouTubeSchema.parse(args);
    const { url } = validatedArgs;

    // Extract progress token from request metadata
    const progressToken = request.params._meta?.progressToken;

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

      // Send initial progress notification
      if (progressToken !== undefined) {
        await server.notification({
          method: "notifications/progress",
          params: {
            progress: 0,
            total: 100,
            progressToken,
            message: "Starting YouTube transcript extraction..."
          },
        });
      }

      // First, get video metadata
      console.error("Getting video metadata...");

      if (progressToken !== undefined) {
        await server.notification({
          method: "notifications/progress",
          params: {
            progress: 10,
            total: 100,
            progressToken,
            message: "Getting video metadata..."
          },
        });
      }

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

      if (progressToken !== undefined) {
        await server.notification({
          method: "notifications/progress",
          params: {
            progress: 30,
            total: 100,
            progressToken,
            message: `Found video: "${title}" by ${uploader}`
          },
        });
      }

      // Now get subtitles/transcript
      let transcriptData: Array<{ start: number, duration: number, text: string }> = [];
      let language = "unknown";

      try {
        console.error("Extracting subtitles...");

        if (progressToken !== undefined) {
          await server.notification({
            method: "notifications/progress",
            params: {
              progress: 50,
              total: 100,
              progressToken,
              message: "Extracting subtitles..."
            },
          });
        }

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

        if (progressToken !== undefined) {
          await server.notification({
            method: "notifications/progress",
            params: {
              progress: 70,
              total: 100,
              progressToken,
              message: "Processing subtitle file..."
            },
          });
        }

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

      if (progressToken !== undefined) {
        await server.notification({
          method: "notifications/progress",
          params: {
            progress: 85,
            total: 100,
            progressToken,
            message: "Saving transcript to file..."
          },
        });
      }

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
      const filename = `${actualVideoId}.json`;
      const filepath = path.join(TRANSCRIPTS_FOLDER, filename);

      await fs.writeFile(filepath, JSON.stringify(structuredResult, null, 2));

      console.error(`Transcript saved to ${filepath}`);

      // Add the new transcript as a discoverable resource
      await addTranscriptResource(filepath, structuredResult);

      // Final progress notification
      if (progressToken !== undefined) {
        await server.notification({
          method: "notifications/progress",
          params: {
            progress: 100,
            total: 100,
            progressToken,
            message: `Transcript saved to ${filepath}`
          },
        });
      }

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
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Dynamic resource list for transcript files
let TRANSCRIPT_RESOURCES: Resource[] = [];

const PAGE_SIZE = 10;

// Load existing transcript files as resources
async function loadTranscriptResources() {
  try {
    await ensureTranscriptsFolder();
    const files = await fs.readdir(TRANSCRIPTS_FOLDER);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    TRANSCRIPT_RESOURCES = [];

    for (const file of jsonFiles) {
      const filepath = path.join(TRANSCRIPTS_FOLDER, file);
      try {
        const content = await fs.readFile(filepath, 'utf-8');
        const transcriptData = JSON.parse(content);

        const resource: Resource = {
          uri: `file://${path.resolve(filepath)}`,
          name: `${transcriptData.title || 'Unknown Video'} - Transcript`,
          description: `YouTube transcript from ${transcriptData.uploader || 'Unknown'} (${transcriptData.video_id})`,
          mimeType: "application/json",
        };

        TRANSCRIPT_RESOURCES.push(resource);
      } catch (error) {
        console.error(`Failed to load transcript resource ${file}:`, error);
      }
    }

    console.error(`Loaded ${TRANSCRIPT_RESOURCES.length} transcript resources`);
  } catch (error) {
    console.error('Failed to load transcript resources:', error);
  }
}

// Add or update a transcript resource when one is created
async function addTranscriptResource(filepath: string, transcriptData: any) {
  const resourceUri = `file://${path.resolve(filepath)}`;
  const resource: Resource = {
    uri: resourceUri,
    name: `${transcriptData.title || 'Unknown Video'} - Transcript`,
    description: `YouTube transcript from ${transcriptData.uploader || 'Unknown'} (${transcriptData.video_id})`,
    mimeType: "application/json",
  };

  // Check if resource already exists and update it, otherwise add new
  const existingIndex = TRANSCRIPT_RESOURCES.findIndex(r => r.uri === resourceUri);
  if (existingIndex >= 0) {
    TRANSCRIPT_RESOURCES[existingIndex] = resource;
    console.error(`Updated transcript resource: ${resource.name}`);
  } else {
    TRANSCRIPT_RESOURCES.push(resource);
    console.error(`Added transcript resource: ${resource.name}`);
  }

  // Notify clients that the resource list has changed
  try {
    await server.sendResourceListChanged();
  } catch (error) {
    console.error('Failed to send resource list changed notification:', error);
  }
}

// List resources handler
server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  // Refresh the resources
  await loadTranscriptResources();

  const cursor = request.params?.cursor;
  let startIndex = 0;

  if (cursor) {
    const decodedCursor = parseInt(atob(cursor), 10);
    if (!isNaN(decodedCursor)) {
      startIndex = decodedCursor;
    }
  }

  const endIndex = Math.min(startIndex + PAGE_SIZE, TRANSCRIPT_RESOURCES.length);
  const resources = TRANSCRIPT_RESOURCES.slice(startIndex, endIndex);

  let nextCursor: string | undefined;
  if (endIndex < TRANSCRIPT_RESOURCES.length) {
    nextCursor = btoa(endIndex.toString());
  }

  return {
    resources,
    nextCursor,
  };
});

// List resource templates handler
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        uriTemplate: `file://${path.resolve(TRANSCRIPTS_FOLDER)}/{video_id}.json`,
        name: "YouTube Transcript",
        description: "JSON file containing YouTube video transcript data with metadata",
        mimeType: "application/json",
        schema: zodToJsonSchema(TranscriptSchema),
      },
    ],
  };
});

// List prompts handler  
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [],
  };
});

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  console.error(`ReadResource request for URI: ${uri}`);

  // Check if this is a transcript file resource by looking at our resource list first
  let resource = TRANSCRIPT_RESOURCES.find(r => r.uri === uri);
  
  // If not found in our list, check if it's a valid transcript file path
  if (!resource && uri.startsWith('file://')) {
    const filePath = uri.replace('file://', '');
    const resolvedTranscriptsFolder = path.resolve(TRANSCRIPTS_FOLDER);
    
    // Check if the file is in our transcripts folder and exists
    if (filePath.startsWith(resolvedTranscriptsFolder) && filePath.endsWith('.json')) {
      try {
        await fs.access(filePath); // Check if file exists
        console.error(`Found transcript file at: ${filePath}`);
        // Create a temporary resource entry for this file
        resource = { uri, name: 'Transcript File', mimeType: 'application/json' };
      } catch (error) {
        console.error(`File not found: ${filePath}`);
      }
    }
  }

  if (resource && uri.startsWith('file://')) {
    try {
      const filePath = uri.replace('file://', '');
      const content = await fs.readFile(filePath, 'utf-8');
      const transcriptData = JSON.parse(content);

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(transcriptData, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  throw new Error(`Resource not found: ${uri}`);
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
  // Load existing transcript files as resources
  await loadTranscriptResources();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP YouTube server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});