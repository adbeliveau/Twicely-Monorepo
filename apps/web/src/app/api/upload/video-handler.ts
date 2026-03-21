/**
 * Video upload handlers for /api/upload
 * Handles 'video' and 'video-thumbnail' upload types.
 */

import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createId } from '@paralleldrive/cuid2';
import { validateVideoBytes, detectVideoType, MIN_VIDEO_DURATION, MAX_VIDEO_DURATION } from '@/lib/upload/validate-video';
import { validateImageBytes, detectImageType, getExtension } from '@/lib/upload/validate';
import { uploadListingVideo, uploadVideoThumbnail } from '@twicely/storage/video-service';
import { isR2Configured } from '@twicely/storage/r2-client';

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

async function saveVideoToLocal(bytes: Uint8Array, ext: string): Promise<string> {
  const id = createId();
  const filename = `${id}.${ext}`;
  const uploadDir = path.join(LOCAL_UPLOAD_DIR, 'videos');

  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }

  await writeFile(path.join(uploadDir, filename), bytes);
  return `/uploads/videos/${filename}`;
}

/**
 * Handle video upload (type === 'video').
 */
export async function handleVideoUpload(
  formData: FormData,
  file: File
): Promise<NextResponse> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  // Validate video bytes (magic bytes + size)
  const validation = validateVideoBytes(bytes, file.size);
  if (!validation.valid) {
    return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
  }

  const videoType = detectVideoType(bytes);
  if (!videoType) {
    return NextResponse.json({ success: false, error: 'Invalid video format' }, { status: 400 });
  }

  // Validate client-reported duration
  const durationStr = formData.get('durationSeconds') as string | null;
  const durationSeconds = durationStr ? parseInt(durationStr, 10) : null;

  if (durationSeconds === null || isNaN(durationSeconds)) {
    return NextResponse.json({ success: false, error: 'durationSeconds is required' }, { status: 400 });
  }

  if (durationSeconds < MIN_VIDEO_DURATION || durationSeconds > MAX_VIDEO_DURATION) {
    return NextResponse.json(
      { success: false, error: `Video must be between ${MIN_VIDEO_DURATION} and ${MAX_VIDEO_DURATION} seconds` },
      { status: 400 }
    );
  }

  const listingId = (formData.get('listingId') as string | null) ?? createId();

  if (isR2Configured()) {
    const buffer = Buffer.from(bytes);
    const result = await uploadListingVideo(listingId, buffer, videoType);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      video: {
        id: createId(),
        url: result.videoUrl,
        durationSeconds,
      },
    });
  }

  // Local filesystem fallback
  const url = await saveVideoToLocal(bytes, videoType);
  return NextResponse.json({
    success: true,
    video: {
      id: createId(),
      url,
      durationSeconds,
    },
  });
}

/**
 * Handle video thumbnail upload (type === 'video-thumbnail').
 */
export async function handleVideoThumbnailUpload(
  formData: FormData,
  file: File
): Promise<NextResponse> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  // Validate as image (JPEG thumbnail from canvas)
  const validation = validateImageBytes(bytes, file.size);
  if (!validation.valid) {
    return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
  }

  const imageType = detectImageType(bytes);
  if (!imageType) {
    return NextResponse.json({ success: false, error: 'Invalid thumbnail image type' }, { status: 400 });
  }

  const listingId = formData.get('listingId') as string | null;
  if (!listingId) {
    return NextResponse.json({ success: false, error: 'listingId is required' }, { status: 400 });
  }

  if (isR2Configured()) {
    const buffer = Buffer.from(bytes);
    const result = await uploadVideoThumbnail(listingId, buffer);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      image: {
        id: createId(),
        url: result.url,
      },
    });
  }

  // Local filesystem fallback
  const ext = getExtension(imageType);
  const id = createId();
  const filename = `${id}.${ext}`;
  const uploadDir = path.join(LOCAL_UPLOAD_DIR, 'video-thumbnails');

  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }

  await writeFile(path.join(uploadDir, filename), bytes);
  const url = `/uploads/video-thumbnails/${filename}`;

  return NextResponse.json({
    success: true,
    image: {
      id: createId(),
      url,
    },
  });
}
