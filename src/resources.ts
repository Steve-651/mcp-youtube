import {
  Resource,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import zodToJsonSchema from "zod-to-json-schema";
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { readTranscriptFile, listTranscriptFiles, transcriptFileExists } from "./io.js";
import { TRANSCRIPTS_FOLDER } from "./config.js";
import { TranscriptSchema } from "./types/transcript.js";

// Dynamic resource list for transcript files
let TRANSCRIPT_RESOURCES: Resource[] = [];

const PAGE_SIZE = 10;

// Load existing transcript files as resources
async function loadTranscriptResources() {
  try {
    const jsonFiles = await listTranscriptFiles();

    TRANSCRIPT_RESOURCES = [];

    for (const file of jsonFiles) {
      const filepath = path.join(TRANSCRIPTS_FOLDER, file);
      try {
        const transcriptData = await readTranscriptFile(path.basename(file, '.json'));

        const resource: Resource = {
          uri: `file://${path.resolve(filepath)}`,
          name: `${transcriptData.title || 'Unknown Video'} - Transcript`,
          description: `YouTube transcript from ${transcriptData.uploader || 'Unknown'} (${transcriptData.video_id})`,
          mimeType: "application/json",
        };

        TRANSCRIPT_RESOURCES.push(resource);
      } catch (error) {
        // Silently skip failed resources
      }
    }

  } catch (error) {
    // Silently handle resource loading errors
  }
}

export default function registerResources(server: Server) {

  // Load existing files as resources (async, but don't block registration)
  loadTranscriptResources().catch(() => {
    // Silently handle initial loading errors
  });

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

  // Read resource handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    // Check if this is a transcript file resource by looking at our resource list first
    let resource = TRANSCRIPT_RESOURCES.find(r => r.uri === uri);

    // If not found in our list, check if it's a valid transcript file path
    if (!resource && uri.startsWith('file://')) {
      const filePath = uri.replace('file://', '');
      const resolvedTranscriptsFolder = path.resolve(TRANSCRIPTS_FOLDER);

      // Check if the file is in our transcripts folder and exists
      if (filePath.startsWith(resolvedTranscriptsFolder) && filePath.endsWith('.json')) {
        try {
          const exists = await transcriptFileExists(path.basename(filePath, '.json'));
          if (exists) {
            // Create a temporary resource entry for this file
            resource = { uri, name: 'Transcript File', mimeType: 'application/json' };
          } else {
            // File not found - silently continue
          }
        } catch (error) {
          // File access error - silently continue
        }
      }
    }

    if (resource && uri.startsWith('file://')) {
      try {
        const filePath = uri.replace('file://', '');
        const transcriptData = await readTranscriptFile(path.basename(filePath, '.json'));

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
}