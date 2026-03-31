import type { ValidationResult } from './validate';

// Constants — match platform setting defaults
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
export const MIN_VIDEO_DURATION = 15; // seconds
export const MAX_VIDEO_DURATION = 60; // seconds
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'] as const;

// Magic byte signatures
// MP4 / MOV both use ISO Base Media File Format — bytes 4-7 = 'ftyp'
const FTYP_SIGNATURE = [0x66, 0x74, 0x79, 0x70]; // 'ftyp'
// MOV brand bytes at offset 8 = 'qt  ' (0x71, 0x74, 0x20, 0x20)
const MOV_BRAND = [0x71, 0x74, 0x20, 0x20]; // 'qt  '
// WebM: EBML header — first 4 bytes
const WEBM_SIGNATURE = [0x1a, 0x45, 0xdf, 0xa3];

function matchesSignature(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

/**
 * Detect video type from magic bytes.
 * Returns null if the bytes do not correspond to a supported video format.
 */
export function detectVideoType(bytes: Uint8Array): 'mp4' | 'mov' | 'webm' | null {
  if (bytes.length < 12) return null;

  // WebM: EBML header at offset 0
  if (matchesSignature(bytes, WEBM_SIGNATURE, 0)) {
    return 'webm';
  }

  // MP4/MOV: 'ftyp' at offset 4
  if (matchesSignature(bytes, FTYP_SIGNATURE, 4)) {
    // Distinguish MOV from MP4 by brand at offset 8
    if (matchesSignature(bytes, MOV_BRAND, 8)) {
      return 'mov';
    }
    return 'mp4';
  }

  return null;
}

/**
 * Get file extension from video type.
 */
export function getVideoExtension(type: 'mp4' | 'mov' | 'webm'): string {
  switch (type) {
    case 'mp4': return 'mp4';
    case 'mov': return 'mov';
    case 'webm': return 'webm';
  }
}

/**
 * Get MIME type from video type.
 */
export function getVideoContentType(type: 'mp4' | 'mov' | 'webm'): string {
  switch (type) {
    case 'mp4': return 'video/mp4';
    case 'mov': return 'video/quicktime';
    case 'webm': return 'video/webm';
  }
}

/**
 * Validate video bytes server-side.
 * Checks magic bytes and file size.
 * Duration is validated client-side (no ffprobe in V1).
 */
export function validateVideoBytes(bytes: Uint8Array, size: number): ValidationResult {
  if (size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  if (size > MAX_VIDEO_SIZE) {
    const maxMb = MAX_VIDEO_SIZE / 1024 / 1024;
    return { valid: false, error: `File size must be less than ${maxMb}MB` };
  }

  const videoType = detectVideoType(bytes);
  if (!videoType) {
    return {
      valid: false,
      error: 'Invalid video format. Only MP4, MOV, and WebM are allowed.',
    };
  }

  return { valid: true };
}
