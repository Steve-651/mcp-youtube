import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import zodToJsonSchema from "zod-to-json-schema";
import {
  ToolName,
  ToolTranscribeYoutubeInputSchema,
  ToolGetTranscriptInputSchema,
  ToolGetTranscriptOutput,
  ToolTranscribeYoutubeOutput
} from "./types/tools.js";
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getVideoMetadata, extractSubtitles, writeTranscriptFile, readTranscriptFile } from "./io.js";

export default function registerTools(server: Server) {
  console.debug('Registering Tools...');

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: ToolName.TRANSCRIBE_YOUTUBE,
          description: "Extract transcript from YouTube video with progress reporting and save to configurable folder",
          inputSchema: zodToJsonSchema(ToolTranscribeYoutubeInputSchema),
        },
        {
          name: ToolName.GET_TRANSCRIPT,
          description: "Get existing transcript by video ID",
          inputSchema: zodToJsonSchema(ToolGetTranscriptInputSchema),
        },
      ],
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: action, arguments: args } = request.params;

    if (action === ToolName.TRANSCRIBE_YOUTUBE) {
      const validatedArgs = ToolTranscribeYoutubeInputSchema.parse(args);
      const { url } = validatedArgs;

      // Extract progress token from request metadata
      const progressToken = request.params._meta?.progressToken;

      try {

        if (progressToken !== undefined) {
          await server.notification({
            method: "notifications/progress",
            params: {
              progress: 0,
              total: 4,
              progressToken,
              message: "Getting video metadata..."
            },
          });
        }

        const metadata = await getVideoMetadata(url);
        const actualVideoId = metadata.id;
        const title = metadata.title;
        const uploader = metadata.uploader;
        const duration = metadata.duration;

        if (progressToken !== undefined) {
          await server.notification({
            method: "notifications/progress",
            params: {
              progress: 1,
              total: 4,
              progressToken,
              message: `Found video: "${title}" by ${uploader}`
            },
          });
        }

        let transcriptSegments: Array<{ start: number, duration: number, text: string }> = [];
        let language = "unknown";

        // Now get subtitles/transcript
        try {
          if (progressToken !== undefined) {
            await server.notification({
              method: "notifications/progress",
              params: {
                progress: 2,
                total: 4,
                progressToken,
                message: "Extracting subtitles..."
              },
            });
          }

          const subtitleResult = await extractSubtitles(url, actualVideoId);
          transcriptSegments = subtitleResult.transcriptSegments;
          language = subtitleResult.language;

        } catch (subtitleError) {
          console.error('Subtitle extraction failed:', subtitleError);
        }

        if (progressToken !== undefined) {
          await server.notification({
            method: "notifications/progress",
            params: {
              progress: 3,
              total: 4,
              progressToken,
              message: "Saving transcript to file..."
            },
          });
        }

        const transcriptData: ToolGetTranscriptOutput = {
          video_id: actualVideoId,
          title: title,
          uploader: uploader,
          duration: duration,
          url: url,
          transcript: transcriptSegments.length > 0 ? transcriptSegments : [{
            start: 0,
            duration: 0,
            text: "No transcript available for this video"
          }],
          metadata: {
            transcription_date: new Date().toISOString(),
            source: "yt_dlp" as const,
            language: language,
            confidence: transcriptSegments.length > 0 ? 0.95 : 0.0 // whar
          }
        };

        // Save transcript to file using resource function (automatically adds to resource list)
        const filepath = await writeTranscriptFile(actualVideoId, transcriptData);

        // Final progress notification
        if (progressToken !== undefined) {
          await server.notification({
            method: "notifications/progress",
            params: {
              progress: 4,
              total: 4,
              progressToken,
              message: `Transcript saved to ${filepath}`
            },
          });
        }

        const transcriptionResult: ToolTranscribeYoutubeOutput = {
          video_id: actualVideoId,
          title: title,
          uploader: uploader,
          transcript_segments_count: transcriptSegments.length,
          next_action: {
            tool: ToolName.GET_TRANSCRIPT,
            parameters: {
              videoId: actualVideoId
            }
          }
        };

        return {
          content: [{
            type: 'text' as const,
            text: `Successfully extracted transcript for "${title}" by ${uploader}. Found ${transcriptSegments.length} transcript segments.\n\nTo access the full transcript data, use the get_transcript tool with videoId: "${actualVideoId}"`
          }],
          structuredContent: transcriptionResult
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

        console.error(structuredError);
        throw new Error(JSON.stringify(structuredError, null, 2));
      }
    }

    if (action === ToolName.GET_TRANSCRIPT) {
      const validatedArgs = ToolGetTranscriptInputSchema.parse(args);
      const { videoId } = validatedArgs;

      try {
        // Read transcript using resource function
        const transcriptData = await readTranscriptFile(videoId);

        return {
          content: [{
            type: 'text' as const,
            text: `Found transcript for "${transcriptData.title}" by ${transcriptData.uploader}. Contains ${transcriptData.transcript.length} transcript segments.`
          }],
          structuredContent: transcriptData
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        const structuredError = {
          error_type: "transcript_not_found",
          message: errorMessage,
          video_id: videoId,
          suggested_action: "Use transcribe_youtube tool to create a transcript for this video first"
        };

        console.error(structuredError);
        throw new Error(JSON.stringify(structuredError, null, 2));
      }
    }

    throw new Error(`Unknown tool: ${action}`);
  });
}