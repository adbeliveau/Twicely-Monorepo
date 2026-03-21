/**
 * Video Service — R2 upload/delete operations for listing videos + thumbnails.
 *
 * R2 key prefix: videos/listings/ (same bucket as images, different prefix)
 */

import { uploadToR2, deleteFromR2, extractKeyFromUrl } from './r2-client';
import { getVideoExtension, getVideoContentType } from '@/lib/upload/validate-video';
import type { UploadResult } from './image-service';

export interface VideoUploadResult {
  success: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

/**
 * Upload a listing video to R2.
 * Returns the public URL of the uploaded video.
 */
export async function uploadListingVideo(
  listingId: string,
  buffer: Buffer,
  videoType: 'mp4' | 'mov' | 'webm'
): Promise<VideoUploadResult> {
  const ext = getVideoExtension(videoType);
  const contentType = getVideoContentType(videoType);
  const timestamp = Date.now();
  const key = `videos/listings/${listingId}/${timestamp}.${ext}`;

  try {
    const videoUrl = await uploadToR2(key, buffer, contentType);
    return { success: true, videoUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Video upload failed',
    };
  }
}

/**
 * Upload a video thumbnail (client-extracted JPEG frame) to R2.
 * Returns the public URL of the thumbnail image.
 */
export async function uploadVideoThumbnail(
  listingId: string,
  buffer: Buffer
): Promise<UploadResult> {
  const timestamp = Date.now();
  const key = `videos/listings/${listingId}/thumb-${timestamp}.jpg`;

  try {
    const url = await uploadToR2(key, buffer, 'image/jpeg');
    return { success: true, url };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Thumbnail upload failed',
    };
  }
}

/**
 * Delete a listing video and its thumbnail from R2.
 * Gracefully handles missing thumbnail URL.
 */
export async function deleteListingVideo(
  videoUrl: string,
  thumbUrl: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const videoKey = extractKeyFromUrl(videoUrl);
    if (videoKey) {
      await deleteFromR2(videoKey);
    }

    if (thumbUrl) {
      const thumbKey = extractKeyFromUrl(thumbUrl);
      if (thumbKey) {
        await deleteFromR2(thumbKey);
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}
