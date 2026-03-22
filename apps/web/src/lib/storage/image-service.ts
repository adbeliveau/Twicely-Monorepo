/**
 * Image Service — High-level image upload operations
 *
 * Handles listing images, avatars, and store banners with validation.
 */

import { logger } from '@twicely/logger';
import { uploadToR2, deleteFromR2, extractKeyFromUrl, R2_PUBLIC_URL } from './r2-client';
import { validateImageBytes, detectImageType, getExtension } from '@/lib/upload/validate';

export interface UploadResult {
  success: boolean;
  url?: string;
  thumbnailUrl?: string;
  error?: string;
}

/**
 * Upload a listing image.
 *
 * @param listingId - The listing ID
 * @param buffer - The image data as a Buffer
 * @param position - The image position (0-11)
 */
export async function uploadListingImage(
  listingId: string,
  buffer: Buffer,
  position: number
): Promise<UploadResult> {
  // Validate
  const bytes = new Uint8Array(buffer);
  const validation = validateImageBytes(bytes, buffer.length);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Detect type
  const imageType = detectImageType(bytes);
  if (!imageType) {
    return { success: false, error: 'Unable to detect image type' };
  }

  const ext = getExtension(imageType);
  const contentType = `image/${imageType}`;
  const timestamp = Date.now();

  // Generate key
  const key = `listings/${listingId}/${position}-${timestamp}.${ext}`;

  try {
    // Upload original
    const url = await uploadToR2(key, buffer, contentType);

    // TODO: Generate and upload thumbnail (requires sharp or similar)
    // For now, thumbnail is same as original
    const thumbnailUrl = url;

    return { success: true, url, thumbnailUrl };
  } catch (error) {
    logger.error('[ImageService] Failed to upload listing image', { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Upload a user avatar.
 */
export async function uploadAvatar(
  userId: string,
  buffer: Buffer
): Promise<UploadResult> {
  const bytes = new Uint8Array(buffer);
  const validation = validateImageBytes(bytes, buffer.length);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const imageType = detectImageType(bytes);
  if (!imageType) {
    return { success: false, error: 'Unable to detect image type' };
  }

  const ext = getExtension(imageType);
  const contentType = `image/${imageType}`;
  const timestamp = Date.now();
  const key = `avatars/${userId}/${timestamp}.${ext}`;

  try {
    const url = await uploadToR2(key, buffer, contentType);
    return { success: true, url };
  } catch (error) {
    logger.error('[ImageService] Failed to upload avatar', { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Upload a store banner.
 */
export async function uploadStoreBanner(
  sellerId: string,
  buffer: Buffer
): Promise<UploadResult> {
  const bytes = new Uint8Array(buffer);
  const validation = validateImageBytes(bytes, buffer.length);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const imageType = detectImageType(bytes);
  if (!imageType) {
    return { success: false, error: 'Unable to detect image type' };
  }

  const ext = getExtension(imageType);
  const contentType = `image/${imageType}`;
  const timestamp = Date.now();
  const key = `banners/${sellerId}/${timestamp}.${ext}`;

  try {
    const url = await uploadToR2(key, buffer, contentType);
    return { success: true, url };
  } catch (error) {
    logger.error('[ImageService] Failed to upload banner', { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Delete an image by URL.
 */
export async function deleteImage(url: string): Promise<{ success: boolean; error?: string }> {
  const key = extractKeyFromUrl(url);
  if (!key) {
    // Not an R2 URL, or mock URL - silently succeed
    return { success: true };
  }

  try {
    await deleteFromR2(key);
    return { success: true };
  } catch (error) {
    logger.error('[ImageService] Failed to delete image', { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

/**
 * Upload an expense receipt image.
 */
export async function uploadReceiptImage(
  userId: string,
  buffer: Buffer,
): Promise<UploadResult> {
  const bytes = new Uint8Array(buffer);
  const validation = validateImageBytes(bytes, buffer.length);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const imageType = detectImageType(bytes);
  if (!imageType) {
    return { success: false, error: 'Unable to detect image type' };
  }

  const ext = getExtension(imageType);
  const contentType = `image/${imageType}`;
  const timestamp = Date.now();
  const key = `receipts/${userId}/${timestamp}.${ext}`;

  try {
    const url = await uploadToR2(key, buffer, contentType);
    return { success: true, url };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Upload a meetup condition photo (buyer evidence before receipt confirmation).
 *
 * @param localTransactionId - The local transaction ID
 * @param buffer - The image data as a Buffer
 * @param position - The photo position index (0-4)
 */
export async function uploadMeetupPhoto(
  localTransactionId: string,
  buffer: Buffer,
  position: number
): Promise<UploadResult> {
  const bytes = new Uint8Array(buffer);
  const validation = validateImageBytes(bytes, buffer.length);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const imageType = detectImageType(bytes);
  if (!imageType) {
    return { success: false, error: 'Unable to detect image type' };
  }

  const ext = getExtension(imageType);
  const contentType = `image/${imageType}`;
  const timestamp = Date.now();
  const key = `meetup-photos/${localTransactionId}/${position}-${timestamp}.${ext}`;

  try {
    const url = await uploadToR2(key, buffer, contentType);
    return { success: true, url };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Generate a mock image URL for development.
 */
export function getMockImageUrl(type: 'listing' | 'avatar' | 'banner', id: string): string {
  return `${R2_PUBLIC_URL}/mock/${type}/${id}-${Date.now()}.webp`;
}
