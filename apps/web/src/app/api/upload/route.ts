/**
 * Upload API Route
 *
 * Handles multipart form data uploads for listings, avatars, and banners.
 * Uses R2 storage when configured, falls back to local filesystem in dev.
 * Rate limited to 20 uploads per minute per user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createId } from '@paralleldrive/cuid2';
import { authorize } from '@twicely/casl/authorize';
import { sub } from '@twicely/casl';
import { validateImageBytes, detectImageType, getExtension } from '@/lib/upload/validate';
import { uploadListingImage, uploadAvatar, uploadStoreBanner, uploadReceiptImage, uploadMeetupPhoto } from '@twicely/storage/image-service';
import { isR2Configured } from '@twicely/storage/r2-client';
import { logger } from '@twicely/logger';
import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { handleVideoUpload, handleVideoThumbnailUpload } from './video-handler';
import { handleMessageAttachmentUpload } from './message-attachment-handler';
import { getValkeyClient } from '@twicely/db/cache';

// SEC-011: Valkey-backed rate limiter (consistent across instances)
const RATE_LIMIT = 20;
const RATE_WINDOW_SECONDS = 60;

async function checkRateLimit(userId: string): Promise<boolean> {
  try {
    const valkey = getValkeyClient();
    const key = `upload-rl:${userId}`;
    const count = await valkey.incr(key);
    if (count === 1) {
      await valkey.expire(key, RATE_WINDOW_SECONDS);
    }
    return count <= RATE_LIMIT;
  } catch {
    // If Valkey is down, allow the upload (fail-open for availability)
    return true;
  }
}

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

async function uploadToLocal(
  bytes: Uint8Array,
  imageType: 'jpeg' | 'png' | 'webp',
  subdir: string
): Promise<string> {
  const id = createId();
  const ext = getExtension(imageType);
  const filename = `${id}.${ext}`;
  const uploadDir = path.join(LOCAL_UPLOAD_DIR, subdir);
  const filepath = path.join(uploadDir, filename);

  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }

  await writeFile(filepath, bytes);
  return `/uploads/${subdir}/${filename}`;
}

const PHOTO_UPLOAD_STATUSES = ['BOTH_CHECKED_IN', 'ADJUSTMENT_PENDING'] as const;
type PhotoUploadStatus = typeof PHOTO_UPLOAD_STATUSES[number];

function isPhotoUploadAllowed(status: string): status is PhotoUploadStatus {
  return (PHOTO_UPLOAD_STATUSES as readonly string[]).includes(status);
}

export async function POST(request: NextRequest) {
  // Auth check
  const { session, ability } = await authorize();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.userId;

  // Rate limit check
  if (!(await checkRateLimit(userId))) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Please wait before uploading more.' },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const type = (formData.get('type') as string | null) ?? 'listing';

    // CASL gate based on upload type
    if (type === 'listing') {
      if (!ability.can('create', 'Listing')) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    } else if (type === 'avatar' || type === 'banner') {
      if (!ability.can('update', 'User')) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    } else if (type === 'receipt') {
      if (!ability.can('create', 'Expense')) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    } else if (type === 'meetup-photo') {
      if (!ability.can('update', sub('LocalTransaction', { buyerId: userId }))) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    } else if (type === 'video' || type === 'video-thumbnail') {
      if (!ability.can('create', 'Listing')) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    } else if (type === 'message-attachment') {
      if (!ability.can('create', 'Message')) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Video types are handled by dedicated handlers (bypass image validation)
    if (type === 'video') {
      return handleVideoUpload(formData, file);
    }
    if (type === 'video-thumbnail') {
      return handleVideoThumbnailUpload(formData, file);
    }
    // Message attachment — handled by dedicated handler (supports GIF + dynamic size limit)
    if (type === 'message-attachment') {
      return handleMessageAttachmentUpload(file, userId);
    }

    // Read and validate image
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateImageBytes(bytes, file.size);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const imageType = detectImageType(bytes);
    if (!imageType) {
      return NextResponse.json({ success: false, error: 'Invalid image type' }, { status: 400 });
    }

    // Meetup-photo validation runs before storage branch (R2 or local)
    let meetupPhotoPosition = 0;
    let meetupTransactionId: string | null = null;
    if (type === 'meetup-photo') {
      meetupTransactionId = formData.get('localTransactionId') as string | null;
      if (!meetupTransactionId) {
        return NextResponse.json({ success: false, error: 'localTransactionId required' }, { status: 400 });
      }

      const [tx] = await db
        .select()
        .from(localTransaction)
        .where(eq(localTransaction.id, meetupTransactionId))
        .limit(1);

      if (!tx || tx.buyerId !== userId) {
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      }
      if (!isPhotoUploadAllowed(tx.status)) {
        return NextResponse.json({ success: false, error: 'Photos can only be uploaded before confirming receipt' }, { status: 400 });
      }
      if (tx.confirmedAt !== null) {
        return NextResponse.json({ success: false, error: 'Transaction already confirmed' }, { status: 400 });
      }
      const currentCount = tx.meetupPhotoUrls.length;
      if (currentCount >= 5) {
        return NextResponse.json({ success: false, error: 'Maximum 5 photos per transaction' }, { status: 400 });
      }
      meetupPhotoPosition = currentCount;
    }

    // Use R2 if configured, otherwise fall back to local filesystem
    if (isR2Configured()) {
      const buffer = Buffer.from(bytes);
      let result;

      switch (type) {
        case 'listing': {
          const listingId = (formData.get('listingId') as string | null) ?? createId();
          const positionStr = formData.get('position') as string | null;
          const position = positionStr ? parseInt(positionStr, 10) : 0;

          if (isNaN(position) || position < 0 || position > 11) {
            return NextResponse.json({ success: false, error: 'Invalid position' }, { status: 400 });
          }

          result = await uploadListingImage(listingId, buffer, position);
          break;
        }
        case 'avatar':
          result = await uploadAvatar(userId, buffer);
          break;
        case 'banner': {
          result = await uploadStoreBanner(userId, buffer);
          break;
        }
        case 'receipt': {
          result = await uploadReceiptImage(userId, buffer);
          break;
        }
        case 'meetup-photo': {
          result = await uploadMeetupPhoto(meetupTransactionId!, buffer, meetupPhotoPosition);
          if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
          }
          return NextResponse.json({
            success: true,
            image: { id: createId(), url: result.url, position: meetupPhotoPosition },
          });
        }
        default:
          return NextResponse.json({ success: false, error: 'Invalid upload type' }, { status: 400 });
      }

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        image: {
          id: createId(),
          url: result.url,
          thumbnailUrl: result.thumbnailUrl,
          position: 0,
        },
      });
    }

    // Local filesystem fallback
    const subdir = type === 'avatar' ? 'avatars'
      : type === 'banner' ? 'banners'
      : type === 'receipt' ? 'receipts'
      : type === 'meetup-photo' ? 'meetup-photos'
      : 'listings';
    const url = await uploadToLocal(bytes, imageType, subdir);

    return NextResponse.json({
      success: true,
      image: {
        id: createId(),
        url,
        position: type === 'meetup-photo' ? meetupPhotoPosition : 0,
      },
    });
  } catch (error) {
    logger.error('[Upload API] Error', { error });
    return NextResponse.json(
      { success: false, error: 'Upload failed. Please try again.' },
      { status: 500 }
    );
  }
}
