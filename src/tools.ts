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
import { handleError } from "./types/errors.js";
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getVideoMetadata, extractSubtitles } from "./ytdlp.js";
import { writeTranscriptFile, readTranscriptFile } from "./io.js";
import { Transcript } from "./types/transcript.js";

export default function registerTools(server: Server) {

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

        let transcriptSegments: Array<{ start_time: string, end_time: string, text: string }> = [];
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

        const transcriptData: Transcript = {
          video_id: actualVideoId,
          title: title,
          uploader: uploader,
          duration: duration,
          url: url,
          transcript: transcriptSegments.length > 0 ? transcriptSegments : [{
            start_time: "00:00:00.000",
            end_time: "00:00:00.000",
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
        handleError(error);
      }
    }

    if (action === ToolName.GET_TRANSCRIPT) {
      const validatedArgs = ToolGetTranscriptInputSchema.parse(args);
      const { videoId } = validatedArgs;

      try {
        // Read transcript using resource function
        const transcriptData: ToolGetTranscriptOutput = await readTranscriptFile(videoId);

        return {
          content: [{
            type: 'text' as const,
            text: `Found transcript for "${transcriptData.title}" by ${transcriptData.uploader}. Contains ${transcriptData.transcript.length} transcript segments.`
          }],
          structuredContent: transcriptData
        };

      } catch (error) {
        handleError(error);
      }
    }

    throw new Error(`Unknown tool: ${action}`);
  });
}