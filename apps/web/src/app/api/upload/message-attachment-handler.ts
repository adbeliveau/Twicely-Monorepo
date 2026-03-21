/**
 * Message attachment upload handler.
 * Handles type=message-attachment uploads for buyer-seller messaging.
 * Accepts JPEG, PNG, GIF, WebP. Max size from platform_settings.
 * Uploads to R2 under messages/{userId}/{cuid2}.{ext}
 */

import { NextResponse } from 'next/server';
import { createId } from '@paralleldrive/cuid2';
import { uploadToR2, isR2Configured, R2_PUBLIC_URL } from '@twicely/storage/r2-client';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DEFAULT_MAX_BYTES = 10_485_760; // 10 MB

// GIF magic bytes: 47 49 46 38
const GIF_SIGNATURE_87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]; // GIF87a
const GIF_SIGNATURE_89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]; // GIF89a

function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

function detectAttachmentType(bytes: Uint8Array): 'jpeg' | 'png' | 'gif' | 'webp' | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  // GIF87a or GIF89a
  if (matchesSignature(bytes, GIF_SIGNATURE_87) || matchesSignature(bytes, GIF_SIGNATURE_89)) return 'gif';
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'webp';
  return null;
}

function getAttachmentExt(type: 'jpeg' | 'png' | 'gif' | 'webp'): string {
  if (type === 'jpeg') return 'jpg';
  return type;
}

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

async function uploadMessageAttachmentLocal(bytes: Uint8Array, ext: string): Promise<string> {
  const id = createId();
  const filename = `${id}.${ext}`;
  const uploadDir = path.join(LOCAL_UPLOAD_DIR, 'messages');
  const filepath = path.join(uploadDir, filename);

  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }

  await writeFile(filepath, bytes);
  return `/uploads/messages/${filename}`;
}

export async function handleMessageAttachmentUpload(
  file: File,
  userId: string,
): Promise<NextResponse> {
  const maxBytes = await getPlatformSetting<number>(
    'comms.messaging.attachmentMaxBytes',
    DEFAULT_MAX_BYTES,
  );

  if (file.size > maxBytes) {
    return NextResponse.json(
      { success: false, error: `File must be smaller than ${Math.round(maxBytes / 1024 / 1024)}MB` },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const imageType = detectAttachmentType(bytes);

  if (!imageType) {
    return NextResponse.json(
      { success: false, error: 'Invalid image type. Only JPEG, PNG, GIF, and WebP are allowed.' },
      { status: 400 },
    );
  }

  const ext = getAttachmentExt(imageType);

  if (isR2Configured()) {
    const key = `messages/${userId}/${createId()}.${ext}`;
    const contentType = imageType === 'jpeg' ? 'image/jpeg'
      : imageType === 'png' ? 'image/png'
      : imageType === 'gif' ? 'image/gif'
      : 'image/webp';
    const buffer = Buffer.from(bytes);
    const url = await uploadToR2(key, buffer, contentType);
    return NextResponse.json({ success: true, url });
  }

  // Local fallback
  const url = await uploadMessageAttachmentLocal(bytes, ext);
  return NextResponse.json({ success: true, url });
}

/** Check whether an R2 URL is under the messages/ prefix (for test assertion). */
export function isMessageAttachmentKey(key: string): boolean {
  return key.startsWith('messages/');
}

/** Build a mock message attachment URL (for testing). */
export function mockMessageAttachmentUrl(userId: string): string {
  return `${R2_PUBLIC_URL}/messages/${userId}/${createId()}.jpg`;
}
