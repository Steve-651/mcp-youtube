#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Innertube } from 'youtubei.js';

const mcpServer = new McpServer({
  name: 'mcp-youtube',
  version: '1.0.0',
  title: 'YouTube Transcription MCP Server'
});

// Helper function to create authenticated Innertube client
function createYouTubeClient() {
  const sessionConfig: any = {
    retrieve_player: false,
    enable_session_cache: false // Disable caching to avoid stale sessions
  };
  
  // Add authentication if environment variables are provided
  if (process.env.YOUTUBE_COOKIE || process.env.YOUTUBE_VISITOR_DATA) {
    sessionConfig.session = {};
    
    if (process.env.YOUTUBE_COOKIE) {
      sessionConfig.session.cookie = process.env.YOUTUBE_COOKIE;
    }
    
    if (process.env.YOUTUBE_VISITOR_DATA) {
      sessionConfig.session.visitor_data = process.env.YOUTUBE_VISITOR_DATA;
    }
    
    if (process.env.YOUTUBE_PO_TOKEN) {
      sessionConfig.session.po_token = process.env.YOUTUBE_PO_TOKEN;
    }
    
    console.error('Using authenticated YouTube session with enhanced config');
  } else {
    console.error('Using unauthenticated YouTube session - some videos may be unavailable');
  }
  
  return Innertube.create(sessionConfig);
}

// Simple tool registration using MCP SDK
mcpServer.registerTool("hello", {
  description: "Say hello with a personalized greeting",
  inputSchema: {
    name: z.string().optional().describe("Name to greet (optional)"),
  },
}, async ({ name }) => {
  const greeting = name ? `Hello, ${name}!` : "Hello, World!";
  return {
    content: [
      {
        type: "text",
        text: greeting,
      },
    ],
  };
});

mcpServer.registerTool("transcribe_youtube", {
  description: "Extract transcript from YouTube video using InnerTube API",
  inputSchema: {
    url: z.string().describe("YouTube video URL"),
  },
  outputSchema: {
    success: z.literal(true),
    video_id: z.string(),
    title: z.string(),
    uploader: z.string(),
    duration: z.number().int().describe("seconds"),
    url: z.string(),
    transcript: z.array(
      z.object({
        start: z.number().int().describe("seconds"),
        duration: z.number().int().describe("seconds"),
        text: z.string(),
      })
    ),
    metadata: z.object({
      transcription_date: z.string().describe("ISO Datetime"),
      source: z.enum(["youtube_innertube"]),
      language: z.string(),
      confidence: z.number().min(0).max(1)
    })
  },
}, async ({ url }) => {
  try {
    console.error(`Attempting to extract transcript from: ${url}`);
    
    // Try multiple approaches if the first fails
    let youtube;
    let info;
    
    try {
      console.error('Trying with authenticated session...');
      youtube = await createYouTubeClient();
      info = await youtube.getInfo(url);
    } catch (firstError) {
      console.error('First attempt failed, trying without authentication...');
      try {
        youtube = await Innertube.create({
          retrieve_player: false,
          enable_session_cache: false
        });
        info = await youtube.getInfo(url);
      } catch (secondError) {
        console.error('Second attempt failed, trying with different client type...');
        youtube = await Innertube.create({
          retrieve_player: false,
          enable_session_cache: false
        });
        info = await youtube.getInfo(url);
      }
    }
    
    console.error(`Video info retrieved for: ${info.basic_info.title}`);
    const title = info.basic_info.title ?? "TITLE NOT FOUND";
    const uploader = info.basic_info.channel?.name ?? "CHANNEL NOT FOUND";
    const videoId = info.basic_info.id ?? "VIDEO ID NOT FOUND";
    const duration = info.basic_info.duration ?? 0;
    
    let transcriptData: Array<{start: number, duration: number, text: string}> = [];
    let language = "unknown";
    
    try {
      console.error('Attempting to get transcript...');
      const transcript = await info.getTranscript();
      console.error('Transcript object:', transcript);
      
      if (transcript && transcript.transcript && transcript.transcript.content && transcript.transcript.content.body) {
        console.error('Found transcript data, processing segments...');
        transcriptData = transcript.transcript.content.body.initial_segments.map((segment: any) => ({
          start: Math.floor(parseInt(segment.start_ms) / 1000),
          duration: Math.floor((parseInt(segment.end_ms) - parseInt(segment.start_ms)) / 1000),
          text: segment.snippet.text
        }));
        language = transcript.selectedLanguage ?? "unknown";
        console.error(`Processed ${transcriptData.length} transcript segments`);
      } else {
        console.error('Transcript structure not as expected:', {
          hasTranscript: !!transcript,
          hasTranscriptProperty: !!(transcript && transcript.transcript),
          hasContent: !!(transcript && transcript.transcript && transcript.transcript.content),
          hasBody: !!(transcript && transcript.transcript && transcript.transcript.content && transcript.transcript.content.body)
        });
      }
    } catch (transcriptError) {
      console.error('Transcript extraction failed:', transcriptError);
    }

    const structuredResult = {
      success: true as const,
      video_id: videoId,
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
        source: "youtube_innertube" as const,
        language: language,
        confidence: transcriptData.length > 0 ? 0.9 : 0.0
      }
    };

    return {
      content: [{
        type: 'text',
        text: `Successfully extracted transcript for "${title}" by ${uploader}. Found ${transcriptData.length} transcript segments.`
      }],
      structuredContent: structuredResult
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('YouTube extraction error:', error);
    
    // Try to extract video ID for debugging
    let videoId = "UNKNOWN";
    try {
      const urlObj = new URL(url);
      videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop() || "UNKNOWN";
    } catch (urlError) {
      console.error('URL parsing error:', urlError);
    }
    
    // Determine error type based on error message using switch-like logic
    let errorType: "transcript_unavailable" | "rate_limited" | "private_video" | "invalid_url" | "region_restricted" | "age_restricted" | "unknown" = "unknown";
    let message = "An unexpected error occurred while processing the video.";
    let suggestedAction = "Try again with a different video or check if the video is publicly accessible.";
    
    const errorLower = errorMessage.toLowerCase();
    
    switch (true) {
      case errorLower.includes("unavailable"):
        errorType = "private_video";
        message = "This video is unavailable. It may be private, deleted, or restricted in your region.";
        suggestedAction = "Try a different public video that's available in your region.";
        break;
      case errorLower.includes("age") || errorLower.includes("sign"):
        errorType = "age_restricted";
        message = "This video is age-restricted and requires authentication.";
        suggestedAction = "Try a non-age-restricted video, or consider implementing authentication.";
        break;
      case errorLower.includes("region") || errorLower.includes("country"):
        errorType = "region_restricted";
        message = "This video is not available in your region.";
        suggestedAction = "Try a video that's available globally.";
        break;
      case errorLower.includes("transcript") || errorLower.includes("caption"):
        errorType = "transcript_unavailable";
        message = "No transcript is available for this video.";
        suggestedAction = "Try a video that has captions or subtitles enabled.";
        break;
      case errorLower.includes("rate") || errorLower.includes("limit"):
        errorType = "rate_limited";
        message = "YouTube API rate limit exceeded.";
        suggestedAction = "Wait a few minutes before trying again.";
        break;
      case errorLower.includes("invalid") || errorLower.includes("url"):
        errorType = "invalid_url";
        message = "The provided URL is not a valid YouTube video URL.";
        suggestedAction = "Check the URL format and try again.";
        break;
      default:
        errorType = "unknown";
        message = "An unexpected error occurred while processing the video.";
        suggestedAction = "Try again with a different video or check if the video is publicly accessible.";
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

async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('MCP YouTube server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});