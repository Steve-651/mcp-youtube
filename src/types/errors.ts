// Interface for execFile error with proper typing
export interface ExecError extends Error {
  code?: string | number;
  stderr?: string;
  stdout?: string;
}

// Interface for Node.js file system errors
export interface FSError extends Error {
  code?: string;
  errno?: number;
  path?: string;
}

// Simple error class for file system operations
export class FileSystemError extends Error {
  public readonly path: string;
  public readonly operation: string;
  public readonly code?: string;

  constructor(message: string, operation: string, filePath: string, code?: string) {
    super(message);
    this.name = 'FileSystemError';
    this.operation = operation;
    this.path = filePath;
    this.code = code;
  }

  toJSON(): string {
    return JSON.stringify({
      error: 'file_system_error',
      operation: this.operation,
      path: this.path,
      code: this.code,
      message: this.message
    }, null, 2);
  }
}

// Simple error class that wraps yt-dlp errors directly
export class YtDlpError extends Error {
  public readonly exitCode: number | string;
  public readonly stderr: string;

  constructor(message: string, exitCode: number | string, stderr: string = '') {
    super(message);
    this.name = 'YtDlpError';
    this.exitCode = exitCode;
    this.stderr = stderr;
  }

  // Convert to JSON for MCP error responses
  toJSON(): string {
    return JSON.stringify({
      error: 'yt-dlp execution failed',
      exit_code: this.exitCode,
      message: this.message,
      stderr: this.stderr
    }, null, 2);
  }
}

// Simple error for missing transcripts
export class TranscriptNotFoundError extends Error {
  public readonly videoId: string;

  constructor(videoId: string) {
    super(`No transcript found for video ID: ${videoId}`);
    this.name = 'TranscriptNotFoundError';
    this.videoId = videoId;
  }

  toJSON(): string {
    return JSON.stringify({
      error: 'transcript_not_found',
      video_id: this.videoId,
      message: this.message,
      suggested_action: 'Use transcribe_youtube tool to create a transcript for this video first'
    }, null, 2);
  }
}

// Handle any error and convert to proper MCP error format
export function handleError(error: unknown): never {
  if (error instanceof YtDlpError) {
    console.error('yt-dlp error:', { exitCode: error.exitCode });
    throw new Error(error.toJSON());
  }

  if (error instanceof TranscriptNotFoundError) {
    console.error('transcript not found:', error.videoId);
    throw new Error(error.toJSON());
  }

  // Handle any other error
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  console.error('Unhandled error:', error);
  throw new Error(JSON.stringify({ error: 'unknown', message: errorMessage }, null, 2));
}