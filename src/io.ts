import path from "path";
import {
  ToolGetTranscriptOutput
} from "./types/tools.js";
import { TRANSCRIPTS_FOLDER } from "./config.js";
import { TranscriptNotFoundError } from "./types/errors.js";
import * as fs from "./fs.js";
import { Transcript, TranscriptSchema } from "./types/transcript.js";

// File I/O functions (using fs.ts wrapper)
export async function writeTranscriptFile(videoId: string, transcriptData: ToolGetTranscriptOutput): Promise<string> {
  await fs.mkdir(TRANSCRIPTS_FOLDER);

  const filename = `${videoId}.json`;
  const filepath = path.join(TRANSCRIPTS_FOLDER, filename);

  await fs.writeJSON(filepath, transcriptData, TranscriptSchema);

  return filepath;
}

export async function readTranscriptFile(videoId: string): Promise<Transcript> {
  const filename = `${videoId}.json`;
  const filepath = path.join(TRANSCRIPTS_FOLDER, filename);

  // Check if transcript file exists
  if (!(await fs.fileExists(filepath))) {
    throw new TranscriptNotFoundError(videoId);
  }

  // Read and parse the transcript file with schema validation
  return await fs.readJSON(filepath, TranscriptSchema);
}

export async function transcriptFileExists(videoId: string): Promise<boolean> {
  const filename = `${videoId}.json`;
  const filepath = path.join(TRANSCRIPTS_FOLDER, filename);
  return await fs.fileExists(filepath);
}

export async function listTranscriptFiles(): Promise<string[]> {
  await fs.mkdir(TRANSCRIPTS_FOLDER);
  const files = await fs.readDir(TRANSCRIPTS_FOLDER);
  return files.filter(file => file.endsWith('.json'));
}