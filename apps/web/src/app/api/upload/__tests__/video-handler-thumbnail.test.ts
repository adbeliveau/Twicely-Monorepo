/**
 * Tests for video-handler.ts — handleVideoThumbnailUpload.
 * Covers: image validation, listingId requirement, R2 upload, local fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockValidateImageBytes, mockDetectImageType,
  mockUploadVideoThumbnail,
  mockIsR2Configured,
  mockWriteFile, mockMkdir, mockExistsSync,
} = vi.hoisted(() => ({
  mockValidateImageBytes: vi.fn(),
  mockDetectImageType: vi.fn(),
  mockUploadVideoThumbnail: vi.fn(),
  mockIsR2Configured: vi.fn(),
  mockWriteFile: vi.fn(),
  mockMkdir: vi.fn(),
  mockExistsSync: vi.fn(),
}));

vi.mock('@/lib/upload/validate-video', () => ({
  validateVideoBytes: vi.fn(),
  detectVideoType: vi.fn(),
  MIN_VIDEO_DURATION: 15,
  MAX_VIDEO_DURATION: 60,
}));

vi.mock('@/lib/upload/validate', () => ({
  validateImageBytes: (...args: unknown[]) => mockValidateImageBytes(...args),
  detectImageType: (...args: unknown[]) => mockDetectImageType(...args),
  getExtension: vi.fn().mockReturnValue('jpg'),
}));

vi.mock('@twicely/storage/video-service', () => ({
  uploadListingVideo: vi.fn(),
  uploadVideoThumbnail: (...args: unknown[]) => mockUploadVideoThumbnail(...args),
}));

vi.mock('@twicely/storage/r2-client', () => ({
  isR2Configured: (...args: unknown[]) => mockIsR2Configured(...args),
}));

vi.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeJpegFile(): File {
  return new File(['fake-thumbnail'], 'thumb.jpg', { type: 'image/jpeg' });
}

function makeFormDataWithListing(listingId = 'lst-test-001'): FormData {
  const fd = new FormData();
  fd.append('listingId', listingId);
  return fd;
}

// ─── handleVideoThumbnailUpload ───────────────────────────────────────────────

describe('handleVideoThumbnailUpload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockValidateImageBytes.mockReturnValue({ valid: true });
    mockDetectImageType.mockReturnValue('jpeg');
    mockIsR2Configured.mockReturnValue(true);
    mockUploadVideoThumbnail.mockResolvedValue({
      success: true,
      url: 'https://cdn.twicely.com/videos/listings/lst-test-001/thumb-1234.jpg',
    });
    mockExistsSync.mockReturnValue(true);
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  it('returns 400 when validateImageBytes fails', async () => {
    mockValidateImageBytes.mockReturnValue({ valid: false, error: 'File too large' });
    const { handleVideoThumbnailUpload } = await import('../video-handler');
    const res = await handleVideoThumbnailUpload(makeFormDataWithListing(), makeJpegFile());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('File too large');
  });

  it('returns 400 when detectImageType returns null', async () => {
    mockDetectImageType.mockReturnValue(null);
    const { handleVideoThumbnailUpload } = await import('../video-handler');
    const res = await handleVideoThumbnailUpload(makeFormDataWithListing(), makeJpegFile());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid thumbnail image type');
  });

  it('returns 400 when listingId is missing', async () => {
    const { handleVideoThumbnailUpload } = await import('../video-handler');
    const res = await handleVideoThumbnailUpload(new FormData(), makeJpegFile());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('listingId');
  });

  it('returns success with image object when R2 upload succeeds', async () => {
    const { handleVideoThumbnailUpload } = await import('../video-handler');
    const res = await handleVideoThumbnailUpload(makeFormDataWithListing(), makeJpegFile());
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; image: { url: string; id: string } };
    expect(body.success).toBe(true);
    expect(body.image.url).toContain('cdn.twicely.com');
    expect(typeof body.image.id).toBe('string');
  });

  it('returns 400 when R2 upload fails', async () => {
    mockUploadVideoThumbnail.mockResolvedValueOnce({ success: false, error: 'R2 thumb error' });
    const { handleVideoThumbnailUpload } = await import('../video-handler');
    const res = await handleVideoThumbnailUpload(makeFormDataWithListing(), makeJpegFile());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('R2 thumb error');
  });

  it('passes listingId to uploadVideoThumbnail', async () => {
    const { handleVideoThumbnailUpload } = await import('../video-handler');
    await handleVideoThumbnailUpload(makeFormDataWithListing('lst-thumb-999'), makeJpegFile());
    const [calledListingId] = mockUploadVideoThumbnail.mock.calls[0] as [string, ...unknown[]];
    expect(calledListingId).toBe('lst-thumb-999');
  });

  it('returns local filesystem URL when R2 is not configured', async () => {
    mockIsR2Configured.mockReturnValue(false);
    const { handleVideoThumbnailUpload } = await import('../video-handler');
    const res = await handleVideoThumbnailUpload(makeFormDataWithListing(), makeJpegFile());
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; image: { url: string } };
    expect(body.success).toBe(true);
    expect(body.image.url).toMatch(/^\/uploads\/video-thumbnails\//);
  });

  it('response image object contains an id field', async () => {
    const { handleVideoThumbnailUpload } = await import('../video-handler');
    const res = await handleVideoThumbnailUpload(makeFormDataWithListing(), makeJpegFile());
    const body = await res.json() as { image: { id: string } };
    expect(typeof body.image.id).toBe('string');
    expect(body.image.id.length).toBeGreaterThan(0);
  });

  it('local fallback creates directory if not exists', async () => {
    mockIsR2Configured.mockReturnValue(false);
    mockExistsSync.mockReturnValue(false);
    const { handleVideoThumbnailUpload } = await import('../video-handler');
    await handleVideoThumbnailUpload(makeFormDataWithListing(), makeJpegFile());
    expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining('video-thumbnails'), { recursive: true });
  });
});
