import { promises as fs } from 'fs';
import { TRANSCRIPTS_FOLDER } from './config.js';

// Ensure transcripts folder exists
export async function ensureTranscriptsFolder() {
  try {
    await fs.mkdir(TRANSCRIPTS_FOLDER, { recursive: true });
  } catch (error) {
    console.error('Failed to create transcripts folder:', error);
  }
}