/**
 * Server-side video duration extraction using music-metadata.
 * SEC-033: Replaces client-reported duration with server-verified value.
 * Pure JS — no native binaries (ffprobe) required.
 */
import { parseBuffer } from 'music-metadata';
import { logger } from '@twicely/logger';

export interface DurationResult {
  durationSeconds: number | null;
  error?: string;
}

export async function extractVideoDuration(
  buffer: Buffer,
  mimeType: string,
): Promise<DurationResult> {
  try {
    const metadata = await parseBuffer(buffer, { mimeType });
    const duration = metadata.format.duration;
    if (duration === undefined || duration === null) {
      return { durationSeconds: null, error: 'Could not extract duration from video metadata' };
    }
    return { durationSeconds: Math.round(duration) };
  } catch (err) {
    logger.warn('[extractVideoDuration] Failed to parse video metadata', {
      error: String(err),
    });
    return { durationSeconds: null, error: 'Failed to read video file metadata' };
  }
}
