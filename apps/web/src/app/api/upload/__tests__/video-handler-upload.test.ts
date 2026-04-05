/**
 * Tests for video-handler.ts — handleVideoUpload.
 * Covers: validation, duration gating, R2 upload, local fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockValidateVideoBytes, mockDetectVideoType,
  mockUploadListingVideo,
  mockIsR2Configured,
  mockWriteFile, mockMkdir, mockExistsSync,
  mockExtractVideoDuration,
} = vi.hoisted(() => ({
  mockValidateVideoBytes: vi.fn(),
  mockDetectVideoType: vi.fn(),
  mockUploadListingVideo: vi.fn(),
  mockIsR2Configured: vi.fn(),
  mockWriteFile: vi.fn(),
  mockMkdir: vi.fn(),
  mockExistsSync: vi.fn(),
  mockExtractVideoDuration: vi.fn(),
}));

vi.mock('@/lib/upload/validate-video', () => ({
  validateVideoBytes: (...args: unknown[]) => mockValidateVideoBytes(...args),
  detectVideoType: (...args: unknown[]) => mockDetectVideoType(...args),
  MIN_VIDEO_DURATION: 15,
  MAX_VIDEO_DURATION: 60,
}));

vi.mock('@/lib/upload/validate', () => ({
  validateImageBytes: vi.fn(),
  detectImageType: vi.fn(),
  getExtension: vi.fn().mockReturnValue('jpg'),
}));

vi.mock('@twicely/storage/video-service', () => ({
  uploadListingVideo: (...args: unknown[]) => mockUploadListingVideo(...args),
  uploadVideoThumbnail: vi.fn(),
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

vi.mock('@/lib/upload/extract-video-duration', () => ({
  extractVideoDuration: (...args: unknown[]) => mockExtractVideoDuration(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeVideoFormData(overrides: Record<string, string | null> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string | null> = {
    durationSeconds: '30',
    listingId: 'lst-test-001',
  };
  const merged = { ...defaults, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v !== null) fd.append(k, v);
  }
  return fd;
}

function makeFile(content = 'fake-video', mimeType = 'video/mp4'): File {
  return new File([content], 'video.mp4', { type: mimeType });
}

// ─── handleVideoUpload ────────────────────────────────────────────────────────

describe('handleVideoUpload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockValidateVideoBytes.mockReturnValue({ valid: true });
    mockDetectVideoType.mockReturnValue('mp4');
    mockIsR2Configured.mockReturnValue(true);
    mockUploadListingVideo.mockResolvedValue({
      success: true,
      videoUrl: 'https://cdn.twicely.com/videos/listings/lst-test-001/1234.mp4',
    });
    mockExistsSync.mockReturnValue(true);
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    // SEC-033: Server-side extraction succeeds by default
    mockExtractVideoDuration.mockResolvedValue({ durationSeconds: 30 });
  });

  it('returns 400 when validateVideoBytes fails', async () => {
    mockValidateVideoBytes.mockReturnValue({ valid: false, error: 'File is empty' });
    const { handleVideoUpload } = await import('../video-handler');
    const res = await handleVideoUpload(makeVideoFormData(), makeFile());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('File is empty');
  });

  it('returns 400 when detectVideoType returns null after validation passes', async () => {
    mockDetectVideoType.mockReturnValue(null);
    const { handleVideoUpload } = await import('../video-handler');
    const res = await handleVideoUpload(makeVideoFormData(), makeFile());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid video format');
  });

  it('returns 400 when durationSeconds is missing', async () => {
    // Server extraction fails → falls back to client → client missing → 400
    mockExtractVideoDuration.mockResolvedValueOnce({ durationSeconds: null, error: 'Could not extract duration' });
    const { handleVideoUpload } = await import('../video-handler');
    const res = await handleVideoUpload(makeVideoFormData({ durationSeconds: null }), makeFile());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('duration');
  });

  it('returns 400 when durationSeconds is not a number', async () => {
    // Server extraction fails → falls back to client → client NaN → 400
    mockExtractVideoDuration.mockResolvedValueOnce({ durationSeconds: null, error: 'Could not extract duration' });
    const { handleVideoUpload } = await import('../video-handler');
    const res = await handleVideoUpload(makeVideoFormData({ durationSeconds: 'not-a-number' }), makeFile());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('duration');
  });

  it('returns 400 when durationSeconds is below 15', async () => {
    mockExtractVideoDuration.mockResolvedValueOnce({ durationSeconds: 14 });
    const { handleVideoUpload } = await import('../video-handler');
    const res = await handleVideoUpload(makeVideoFormData(), makeFile());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('15');
    expect(body.error).toContain('60');
  });

  it('returns 400 when durationSeconds is above 60', async () => {
    mockExtractVideoDuration.mockResolvedValueOnce({ durationSeconds: 61 });
    const { handleVideoUpload } = await import('../video-handler');
    const res = await handleVideoUpload(makeVideoFormData(), makeFile());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('60');
  });

  it('accepts durationSeconds of exactly 15', async () => {
    mockExtractVideoDuration.mockResolvedValueOnce({ durationSeconds: 15 });
    const { handleVideoUpload } = await import('../video-handler');
    const res = await handleVideoUpload(makeVideoFormData(), makeFile());
    expect(res.status).toBe(200);
  });

  it('accepts durationSeconds of exactly 60', async () => {
    mockExtractVideoDuration.mockResolvedValueOnce({ durationSeconds: 60 });
    const { handleVideoUpload } = await import('../video-handler');
    const res = await handleVideoUpload(makeVideoFormData(), makeFile());
    expect(res.status).toBe(200);
  });

  it('returns success with video object when R2 upload succeeds', async () => {
    const { handleVideoUpload } = await import('../video-handler');
    const res = await handleVideoUpload(makeVideoFormData(), makeFile());
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; video: { url: string; durationSeconds: number } };
    expect(body.success).toBe(true);
    expect(body.video.url).toContain('cdn.twicely.com');
    expect(body.video.durationSeconds).toBe(30);
  });

  it('returns 400 when R2 upload fails', async () => {
    mockUploadListingVideo.mockResolvedValueOnce({ success: false, error: 'R2 timeout' });
    const { handleVideoUpload } = await import('../video-handler');
    const res = await handleVideoUpload(makeVideoFormData(), makeFile());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('R2 timeout');
  });

  it('uses listingId from formData when provided', async () => {
    const { handleVideoUpload } = await import('../video-handler');
    await handleVideoUpload(makeVideoFormData({ listingId: 'lst-custom-001' }), makeFile());
    const [calledListingId] = mockUploadListingVideo.mock.calls[0] as [string, ...unknown[]];
    expect(calledListingId).toBe('lst-custom-001');
  });

  it('generates a listingId when not provided', async () => {
    const { handleVideoUpload } = await import('../video-handler');
    await handleVideoUpload(makeVideoFormData({ listingId: null }), makeFile());
    const [calledListingId] = mockUploadListingVideo.mock.calls[0] as [string, ...unknown[]];
    expect(typeof calledListingId).toBe('string');
    expect(calledListingId.length).toBeGreaterThan(0);
  });

  it('returns local filesystem URL when R2 is not configured', async () => {
    mockIsR2Configured.mockReturnValue(false);
    const { handleVideoUpload } = await import('../video-handler');
    const res = await handleVideoUpload(makeVideoFormData(), makeFile());
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; video: { url: string } };
    expect(body.success).toBe(true);
    expect(body.video.url).toMatch(/^\/uploads\/videos\//);
  });

  it('response video object contains an id field', async () => {
    const { handleVideoUpload } = await import('../video-handler');
    const res = await handleVideoUpload(makeVideoFormData(), makeFile());
    const body = await res.json() as { video: { id: string } };
    expect(typeof body.video.id).toBe('string');
    expect(body.video.id.length).toBeGreaterThan(0);
  });
});
