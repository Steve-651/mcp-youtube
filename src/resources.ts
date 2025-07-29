import {
  Resource,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import zodToJsonSchema from "zod-to-json-schema";
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { TranscriptSchema, TranscriptData } from "./types/index.js";
import { TRANSCRIPTS_FOLDER } from "./config.js";
import { promises as fs } from 'fs';
import { ensureTranscriptsFolder } from "./util.js";

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
export async function addTranscriptResource(server: Server, filepath: string, transcriptData: TranscriptData) {
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

export default function registerResources(server: Server) {
  console.error('Registering Resources...');

  // Load existing files as resources
  // await loadTranscriptResources();

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
}