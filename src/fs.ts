import { promises } from 'fs';
import { FSError, FileSystemError } from './types/errors.js';
import { z } from 'zod';

// Simple wrapper that throws FileSystemError
async function execFS<T>(operation: string, filePath: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const fsError = error as FSError;
    throw new FileSystemError(
      fsError.message || `Failed to ${operation}`,
      operation,
      filePath,
      fsError.code
    );
  }
}

// Generic file system operations
export async function readFile(filePath: string): Promise<string> {
  return execFS('read', filePath, () => promises.readFile(filePath, 'utf-8'));
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  return execFS('write', filePath, () => promises.writeFile(filePath, content));
}

// JSON file operations with optional schema validation
export async function readJSON<T = unknown>(filePath: string, schema?: z.ZodSchema<T>): Promise<T> {
  const content = await readFile(filePath);

  let jsonData: unknown;
  try {
    jsonData = JSON.parse(content);
  } catch (parseError) {
    throw new FileSystemError(
      `Invalid JSON in file: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
      'parse',
      filePath
    );
  }

  if (schema) {
    const result = schema.safeParse(jsonData);
    if (!result.success) {
      throw new FileSystemError(
        `JSON validation failed: ${result.error.message}`,
        'validate',
        filePath
      );
    }
    return result.data;
  }

  return jsonData as T;
}

export async function writeJSON<T>(filePath: string, data: T, schema?: z.ZodSchema<T>): Promise<void> {
  if (schema) {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new FileSystemError(
        `Data validation failed: ${result.error.message}`,
        'validate',
        filePath
      );
    }
  }

  const content = JSON.stringify(data, null, 2);
  return writeFile(filePath, content);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readDir(dirPath: string): Promise<string[]> {
  return execFS('readdir', dirPath, () => promises.readdir(dirPath));
}

export async function mkdir(dirPath: string, recursive: boolean = true): Promise<void> {
  return execFS('mkdir', dirPath, async () => {
    await promises.mkdir(dirPath, { recursive });
  });
}

export async function unlink(filePath: string): Promise<void> {
  return execFS('unlink', filePath, () => promises.unlink(filePath));
}