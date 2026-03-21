/**
 * Tests for message-attachment-handler.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/casl/authorize', () => ({
  authorize: vi.fn(),
}));
vi.mock('@twicely/storage/r2-client', () => ({
  uploadToR2: vi.fn().mockResolvedValue('https://cdn.twicely.com/messages/user-1/abc.jpg'),
  isR2Configured: vi.fn().mockReturnValue(false),
  R2_PUBLIC_URL: 'https://cdn.twicely.com',
}));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(10_485_760),
}));
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

import { handleMessageAttachmentUpload, isMessageAttachmentKey } from '../message-attachment-handler';
import { isR2Configured, uploadToR2 } from '@twicely/storage/r2-client';
import type { Mock } from 'vitest';

const mockIsR2Configured = isR2Configured as Mock;
const mockUploadToR2 = uploadToR2 as Mock;

function makeImageFile(bytes: number[], name: string): File {
  const uint8 = new Uint8Array(bytes);
  return new File([uint8], name, { type: 'image/jpeg' });
}

// JPEG magic bytes: FF D8 FF + padding
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
// PNG magic bytes
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];
// GIF89a magic bytes
const GIF_BYTES = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x00, 0x10, 0x00, 0x80, 0x00];
// WebP magic bytes: RIFF....WEBP
const WEBP_BYTES = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
// Invalid bytes (PDF)
const PDF_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x00, 0x00, 0x00, 0x00];

describe('handleMessageAttachmentUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsR2Configured.mockReturnValue(false);
  });

  it('rejects oversized files', async () => {
    const { getPlatformSetting } = await import('@/lib/queries/platform-settings');
    (getPlatformSetting as Mock).mockResolvedValueOnce(1024); // 1 KB limit

    // Create a file that reports size > 1024
    const bigFile = {
      size: 2048,
      arrayBuffer: async () => new ArrayBuffer(2048),
    } as unknown as File;

    const response = await handleMessageAttachmentUpload(bigFile, 'user-1');
    const body = await response.json() as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('smaller than');
  });

  it('rejects non-image MIME (PDF magic bytes)', async () => {
    const file = makeImageFile(PDF_BYTES, 'doc.pdf');
    const response = await handleMessageAttachmentUpload(file, 'user-1');
    const body = await response.json() as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Invalid image type');
  });

  it('accepts JPEG files and returns URL', async () => {
    const file = makeImageFile(JPEG_BYTES, 'photo.jpg');
    const response = await handleMessageAttachmentUpload(file, 'user-1');
    const body = await response.json() as { success: boolean; url: string };

    expect(body.success).toBe(true);
    expect(body.url).toContain('/uploads/messages/');
  });

  it('accepts PNG files and returns URL', async () => {
    const file = makeImageFile(PNG_BYTES, 'image.png');
    const response = await handleMessageAttachmentUpload(file, 'user-1');
    const body = await response.json() as { success: boolean; url: string };

    expect(body.success).toBe(true);
    expect(typeof body.url).toBe('string');
  });

  it('accepts GIF files and returns URL', async () => {
    const file = makeImageFile(GIF_BYTES, 'animation.gif');
    const response = await handleMessageAttachmentUpload(file, 'user-1');
    const body = await response.json() as { success: boolean; url: string };

    expect(body.success).toBe(true);
    expect(typeof body.url).toBe('string');
  });

  it('accepts WebP files and returns URL', async () => {
    const file = makeImageFile(WEBP_BYTES, 'image.webp');
    const response = await handleMessageAttachmentUpload(file, 'user-1');
    const body = await response.json() as { success: boolean; url: string };

    expect(body.success).toBe(true);
    expect(typeof body.url).toBe('string');
  });

  it('uploads to R2 messages/ prefix when R2 is configured', async () => {
    mockIsR2Configured.mockReturnValue(true);
    mockUploadToR2.mockResolvedValueOnce('https://cdn.twicely.com/messages/user-1/abc.jpg');

    const file = makeImageFile(JPEG_BYTES, 'photo.jpg');
    const response = await handleMessageAttachmentUpload(file, 'user-1');
    const body = await response.json() as { success: boolean; url: string };

    expect(body.success).toBe(true);
    const callArgs = mockUploadToR2.mock.calls[0] as [string, ...unknown[]];
    expect(callArgs[0]).toMatch(/^messages\/user-1\//);
  });
});

describe('isMessageAttachmentKey', () => {
  it('returns true for messages/ prefix keys', () => {
    expect(isMessageAttachmentKey('messages/user-1/abc.jpg')).toBe(true);
  });

  it('returns false for other keys', () => {
    expect(isMessageAttachmentKey('listings/abc/image.jpg')).toBe(false);
    expect(isMessageAttachmentKey('avatars/user-1/photo.jpg')).toBe(false);
  });
});
