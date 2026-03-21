/**
 * Extended tests for message-attachment-handler.ts — edge cases not covered in the base test file.
 *
 * Covers:
 * - GIF87a magic bytes (87a variant, not just 89a)
 * - File with < 12 bytes returns invalid type (too short)
 * - JPEG files get `.jpg` extension (not `.jpeg`)
 * - R2 key includes userId from the parameter
 * - R2 content-type is correctly set per image type
 * - Local path uses `messages/` subdirectory prefix
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { handleMessageAttachmentUpload } from '../message-attachment-handler';
import { isR2Configured, uploadToR2 } from '@twicely/storage/r2-client';
import type { Mock } from 'vitest';

const mockIsR2Configured = isR2Configured as Mock;
const mockUploadToR2 = uploadToR2 as Mock;

// ─── Magic byte constants ─────────────────────────────────────────────────────

// GIF87a magic bytes (alternate GIF variant — must also be accepted)
const GIF87A_BYTES = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x10, 0x00, 0x10, 0x00, 0x80, 0x00];
// GIF89a magic bytes (standard — already in base tests, included for contrast)
const GIF89A_BYTES = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x00, 0x10, 0x00, 0x80, 0x00];
// JPEG magic bytes
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
// PNG magic bytes
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];
// WebP magic bytes: RIFF....WEBP
const WEBP_BYTES = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
// Short buffer — only 8 bytes (< 12 required for type detection)
const SHORT_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];

function makeImageFile(bytes: number[], name: string): File {
  const uint8 = new Uint8Array(bytes);
  return new File([uint8], name, { type: 'image/jpeg' });
}

describe('handleMessageAttachmentUpload — GIF87a support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsR2Configured.mockReturnValue(false);
  });

  it('accepts GIF87a files (alternate GIF variant)', async () => {
    const file = makeImageFile(GIF87A_BYTES, 'old-animation.gif');
    const response = await handleMessageAttachmentUpload(file, 'user-gif87-test');
    const body = await response.json() as { success: boolean; url: string };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.url).toBe('string');
  });

  it('both GIF87a and GIF89a variants are accepted', async () => {
    const file87 = makeImageFile(GIF87A_BYTES, 'gif87.gif');
    const file89 = makeImageFile(GIF89A_BYTES, 'gif89.gif');

    const res87 = await handleMessageAttachmentUpload(file87, 'user-test-gif');
    const res89 = await handleMessageAttachmentUpload(file89, 'user-test-gif');

    const body87 = await res87.json() as { success: boolean };
    const body89 = await res89.json() as { success: boolean };

    expect(body87.success).toBe(true);
    expect(body89.success).toBe(true);
  });
});

describe('handleMessageAttachmentUpload — too-short buffer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsR2Configured.mockReturnValue(false);
  });

  it('rejects files with fewer than 12 bytes (cannot detect type)', async () => {
    const file = makeImageFile(SHORT_BYTES, 'short.bin');
    const response = await handleMessageAttachmentUpload(file, 'user-short-test');
    const body = await response.json() as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Invalid image type');
  });
});

describe('handleMessageAttachmentUpload — JPEG extension mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsR2Configured.mockReturnValue(true);
    mockUploadToR2.mockResolvedValue('https://cdn.twicely.com/messages/user-1/some-id.jpg');
  });

  it('JPEG files use .jpg extension (not .jpeg) in R2 key', async () => {
    const file = makeImageFile(JPEG_BYTES, 'photo.jpeg');
    await handleMessageAttachmentUpload(file, 'user-ext-test');

    const callArgs = mockUploadToR2.mock.calls[0] as [string, Buffer, string];
    const r2Key = callArgs[0];
    // Key must end with .jpg, NOT .jpeg
    expect(r2Key).toMatch(/\.jpg$/);
    expect(r2Key).not.toMatch(/\.jpeg$/);
  });

  it('PNG files use .png extension in R2 key', async () => {
    const file = makeImageFile(PNG_BYTES, 'image.png');
    await handleMessageAttachmentUpload(file, 'user-ext-test');

    const callArgs = mockUploadToR2.mock.calls[0] as [string, Buffer, string];
    expect(callArgs[0]).toMatch(/\.png$/);
  });

  it('GIF87a files use .gif extension in R2 key', async () => {
    const file = makeImageFile(GIF87A_BYTES, 'anim.gif');
    await handleMessageAttachmentUpload(file, 'user-ext-test');

    const callArgs = mockUploadToR2.mock.calls[0] as [string, Buffer, string];
    expect(callArgs[0]).toMatch(/\.gif$/);
  });

  it('WebP files use .webp extension in R2 key', async () => {
    const file = makeImageFile(WEBP_BYTES, 'photo.webp');
    await handleMessageAttachmentUpload(file, 'user-ext-test');

    const callArgs = mockUploadToR2.mock.calls[0] as [string, Buffer, string];
    expect(callArgs[0]).toMatch(/\.webp$/);
  });
});

describe('handleMessageAttachmentUpload — R2 key namespacing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsR2Configured.mockReturnValue(true);
    mockUploadToR2.mockResolvedValue('https://cdn.twicely.com/messages/specific-user/abc.jpg');
  });

  it('R2 key includes the userId from the parameter', async () => {
    const userId = 'specific-user-abc-123';
    const file = makeImageFile(JPEG_BYTES, 'photo.jpg');
    await handleMessageAttachmentUpload(file, userId);

    const callArgs = mockUploadToR2.mock.calls[0] as [string, ...unknown[]];
    expect(callArgs[0]).toContain(userId);
  });

  it('R2 key is always under messages/ prefix', async () => {
    const file = makeImageFile(JPEG_BYTES, 'photo.jpg');
    await handleMessageAttachmentUpload(file, 'any-user-id');

    const callArgs = mockUploadToR2.mock.calls[0] as [string, ...unknown[]];
    expect(callArgs[0]).toMatch(/^messages\//);
  });

  it('JPEG content-type passed to R2 is image/jpeg', async () => {
    const file = makeImageFile(JPEG_BYTES, 'photo.jpg');
    await handleMessageAttachmentUpload(file, 'user-ct-test');

    const callArgs = mockUploadToR2.mock.calls[0] as [string, Buffer, string];
    expect(callArgs[2]).toBe('image/jpeg');
  });

  it('PNG content-type passed to R2 is image/png', async () => {
    const file = makeImageFile(PNG_BYTES, 'image.png');
    await handleMessageAttachmentUpload(file, 'user-ct-test');

    const callArgs = mockUploadToR2.mock.calls[0] as [string, Buffer, string];
    expect(callArgs[2]).toBe('image/png');
  });

  it('GIF content-type passed to R2 is image/gif', async () => {
    const file = makeImageFile(GIF89A_BYTES, 'anim.gif');
    await handleMessageAttachmentUpload(file, 'user-ct-test');

    const callArgs = mockUploadToR2.mock.calls[0] as [string, Buffer, string];
    expect(callArgs[2]).toBe('image/gif');
  });

  it('WebP content-type passed to R2 is image/webp', async () => {
    const file = makeImageFile(WEBP_BYTES, 'photo.webp');
    await handleMessageAttachmentUpload(file, 'user-ct-test');

    const callArgs = mockUploadToR2.mock.calls[0] as [string, Buffer, string];
    expect(callArgs[2]).toBe('image/webp');
  });
});

describe('handleMessageAttachmentUpload — local fallback path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsR2Configured.mockReturnValue(false);
  });

  it('local URL is under /uploads/messages/ path', async () => {
    const file = makeImageFile(JPEG_BYTES, 'photo.jpg');
    const response = await handleMessageAttachmentUpload(file, 'user-local-test');
    const body = await response.json() as { success: boolean; url: string };

    expect(body.success).toBe(true);
    expect(body.url).toMatch(/^\/uploads\/messages\//);
  });

  it('local URL ends with .jpg for JPEG files', async () => {
    const file = makeImageFile(JPEG_BYTES, 'photo.jpg');
    const response = await handleMessageAttachmentUpload(file, 'user-local-ext');
    const body = await response.json() as { success: boolean; url: string };

    expect(body.url).toMatch(/\.jpg$/);
  });
});

describe('handleMessageAttachmentUpload — size limit from platform_settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsR2Configured.mockReturnValue(false);
  });

  it('uses platform_settings value for max size (not hardcoded)', async () => {
    const { getPlatformSetting } = await import('@/lib/queries/platform-settings');
    (getPlatformSetting as Mock).mockResolvedValueOnce(5_242_880); // 5 MB override

    const oversizedFile = {
      size: 5_242_881, // 1 byte over 5 MB
      arrayBuffer: async () => new ArrayBuffer(5_242_881),
    } as unknown as File;

    const response = await handleMessageAttachmentUpload(oversizedFile, 'user-limit-test');
    const body = await response.json() as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('smaller than');
    // Error message should reference 5 MB (5242880 / 1024 / 1024 = 5)
    expect(body.error).toContain('5MB');
  });
});
