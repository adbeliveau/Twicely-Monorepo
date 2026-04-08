import type { ValidationResult } from '@/types/upload';

// Constants
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
// FALLBACK only — real limit comes from platform_settings key 'listing.maxImagesPerListing'
// Read via getPlatformSetting on the server and pass as a prop. Never use this for enforcement.
export const FALLBACK_MAX_IMAGES = 24;
export const MIN_DIMENSION = 200;
export const MAX_DIMENSION = 8000;
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Magic byte signatures
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const WEBP_SIGNATURE_RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE_WEBP = [0x57, 0x45, 0x42, 0x50];

/**
 * Check if bytes match a signature
 */
function matchesSignature(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Detect image type from magic bytes
 */
export function detectImageType(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | null {
  if (bytes.length < 12) return null;

  // Check JPEG: starts with FF D8 FF
  if (matchesSignature(bytes, JPEG_SIGNATURE)) {
    return 'jpeg';
  }

  // Check PNG: starts with 89 50 4E 47
  if (matchesSignature(bytes, PNG_SIGNATURE)) {
    return 'png';
  }

  // Check WebP: starts with RIFF....WEBP
  if (
    matchesSignature(bytes, WEBP_SIGNATURE_RIFF) &&
    matchesSignature(bytes, WEBP_SIGNATURE_WEBP, 8)
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Get file extension from detected type
 */
export function getExtension(type: 'jpeg' | 'png' | 'webp'): string {
  switch (type) {
    case 'jpeg':
      return 'jpg';
    case 'png':
      return 'png';
    case 'webp':
      return 'webp';
  }
}

/**
 * Validate an image file
 * Checks file type by magic bytes and file size
 */
export async function validateImage(file: File): Promise<ValidationResult> {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Read first 12 bytes for magic byte detection
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const imageType = detectImageType(bytes);

  if (!imageType) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.',
    };
  }

  return { valid: true };
}

/**
 * Validate image bytes (for server-side validation)
 */
export function validateImageBytes(bytes: Uint8Array, size: number): ValidationResult {
  // Check file size
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check magic bytes
  const imageType = detectImageType(bytes);
  if (!imageType) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.',
    };
  }

  return { valid: true };
}
