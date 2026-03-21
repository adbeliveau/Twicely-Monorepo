import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the R2 client
const mockUploadToR2 = vi.fn();
const mockDeleteFromR2 = vi.fn();
const mockExtractKeyFromUrl = vi.fn();

vi.mock('../r2-client', () => ({
  uploadToR2: mockUploadToR2,
  deleteFromR2: mockDeleteFromR2,
  extractKeyFromUrl: mockExtractKeyFromUrl,
  R2_PUBLIC_URL: 'https://cdn.twicely.com',
}));

describe('Video Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadToR2.mockResolvedValue('https://cdn.twicely.com/videos/listings/lst-123/1234567890.mp4');
    mockDeleteFromR2.mockResolvedValue(undefined);
    mockExtractKeyFromUrl.mockImplementation((url: string) => {
      const base = 'https://cdn.twicely.com/';
      return url.startsWith(base) ? url.slice(base.length) : null;
    });
  });

  describe('uploadListingVideo', () => {
    it('uploads video to R2 with correct key prefix', async () => {
      const { uploadListingVideo } = await import('../video-service');
      const buffer = Buffer.from('fake video data');
      await uploadListingVideo('lst-123', buffer, 'mp4');

      expect(mockUploadToR2).toHaveBeenCalledWith(
        expect.stringContaining('videos/listings/lst-123/'),
        buffer,
        'video/mp4'
      );
    });

    it('returns public URL on success', async () => {
      const { uploadListingVideo } = await import('../video-service');
      const result = await uploadListingVideo('lst-123', Buffer.from('data'), 'mp4');
      expect(result.success).toBe(true);
      expect(result.videoUrl).toContain('https://cdn.twicely.com');
    });

    it('returns error result on R2 failure', async () => {
      mockUploadToR2.mockRejectedValueOnce(new Error('R2 network error'));
      const { uploadListingVideo } = await import('../video-service');
      const result = await uploadListingVideo('lst-123', Buffer.from('data'), 'mp4');
      expect(result.success).toBe(false);
      expect(result.error).toBe('R2 network error');
    });

    it('uses videos/listings/{listingId}/ key pattern', async () => {
      const { uploadListingVideo } = await import('../video-service');
      await uploadListingVideo('lst-abc', Buffer.from('data'), 'webm');
      const [key] = mockUploadToR2.mock.calls[0] as [string, ...unknown[]];
      expect(key).toMatch(/^videos\/listings\/lst-abc\//);
    });

    it('uses video/quicktime content-type and .mov extension for MOV', async () => {
      mockUploadToR2.mockResolvedValueOnce('https://cdn.twicely.com/videos/listings/lst-mov/1.mov');
      const { uploadListingVideo } = await import('../video-service');
      await uploadListingVideo('lst-mov', Buffer.from('data'), 'mov');
      const [key, , contentType] = mockUploadToR2.mock.calls[0] as [string, unknown, string];
      expect(key).toMatch(/\.mov$/);
      expect(contentType).toBe('video/quicktime');
    });

    it('uses video/webm content-type and .webm extension for WebM', async () => {
      mockUploadToR2.mockResolvedValueOnce('https://cdn.twicely.com/videos/listings/lst-wbm/1.webm');
      const { uploadListingVideo } = await import('../video-service');
      await uploadListingVideo('lst-wbm', Buffer.from('data'), 'webm');
      const [key, , contentType] = mockUploadToR2.mock.calls[0] as [string, unknown, string];
      expect(key).toMatch(/\.webm$/);
      expect(contentType).toBe('video/webm');
    });

    it('uses video/mp4 content-type and .mp4 extension for MP4', async () => {
      const { uploadListingVideo } = await import('../video-service');
      await uploadListingVideo('lst-mp4', Buffer.from('data'), 'mp4');
      const [key, , contentType] = mockUploadToR2.mock.calls[0] as [string, unknown, string];
      expect(key).toMatch(/\.mp4$/);
      expect(contentType).toBe('video/mp4');
    });

    it('includes a timestamp in the key', async () => {
      const before = Date.now();
      const { uploadListingVideo } = await import('../video-service');
      await uploadListingVideo('lst-ts', Buffer.from('data'), 'mp4');
      const after = Date.now();
      const [key] = mockUploadToR2.mock.calls[0] as [string, ...unknown[]];
      // key format: videos/listings/{id}/{timestamp}.mp4
      const tsStr = key.replace('videos/listings/lst-ts/', '').replace('.mp4', '');
      const ts = parseInt(tsStr, 10);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe('uploadVideoThumbnail', () => {
    it('uploads thumbnail to R2 with correct key prefix', async () => {
      mockUploadToR2.mockResolvedValueOnce('https://cdn.twicely.com/videos/listings/lst-123/thumb-000.jpg');
      const { uploadVideoThumbnail } = await import('../video-service');
      await uploadVideoThumbnail('lst-123', Buffer.from('thumb data'));

      expect(mockUploadToR2).toHaveBeenCalledWith(
        expect.stringContaining('videos/listings/lst-123/thumb-'),
        expect.any(Buffer),
        'image/jpeg'
      );
    });

    it('returns public URL on success', async () => {
      mockUploadToR2.mockResolvedValueOnce('https://cdn.twicely.com/videos/listings/lst-123/thumb-000.jpg');
      const { uploadVideoThumbnail } = await import('../video-service');
      const result = await uploadVideoThumbnail('lst-123', Buffer.from('thumb'));
      expect(result.success).toBe(true);
      expect(result.url).toContain('https://cdn.twicely.com');
    });

    it('uses videos/listings/{listingId}/thumb- key pattern', async () => {
      mockUploadToR2.mockResolvedValueOnce('https://cdn.twicely.com/videos/listings/lst-xyz/thumb-1.jpg');
      const { uploadVideoThumbnail } = await import('../video-service');
      await uploadVideoThumbnail('lst-xyz', Buffer.from('data'));
      const [key] = mockUploadToR2.mock.calls[0] as [string, ...unknown[]];
      expect(key).toMatch(/^videos\/listings\/lst-xyz\/thumb-/);
    });

    it('uses image/jpeg content-type for thumbnail', async () => {
      mockUploadToR2.mockResolvedValueOnce('https://cdn.twicely.com/videos/listings/lst-ct/thumb-0.jpg');
      const { uploadVideoThumbnail } = await import('../video-service');
      await uploadVideoThumbnail('lst-ct', Buffer.from('data'));
      const [, , contentType] = mockUploadToR2.mock.calls[0] as [string, unknown, string];
      expect(contentType).toBe('image/jpeg');
    });

    it('returns error result on R2 failure', async () => {
      mockUploadToR2.mockRejectedValueOnce(new Error('thumb upload failed'));
      const { uploadVideoThumbnail } = await import('../video-service');
      const result = await uploadVideoThumbnail('lst-fail', Buffer.from('data'));
      expect(result.success).toBe(false);
      expect(result.error).toBe('thumb upload failed');
    });
  });

  describe('deleteListingVideo', () => {
    it('deletes video and thumbnail from R2', async () => {
      mockExtractKeyFromUrl
        .mockReturnValueOnce('videos/listings/lst-1/video.mp4')
        .mockReturnValueOnce('videos/listings/lst-1/thumb.jpg');
      const { deleteListingVideo } = await import('../video-service');
      const result = await deleteListingVideo(
        'https://cdn.twicely.com/videos/listings/lst-1/video.mp4',
        'https://cdn.twicely.com/videos/listings/lst-1/thumb.jpg'
      );
      expect(result.success).toBe(true);
      expect(mockDeleteFromR2).toHaveBeenCalledTimes(2);
    });

    it('handles missing thumbnail URL gracefully', async () => {
      mockExtractKeyFromUrl.mockReturnValueOnce('videos/listings/lst-1/video.mp4');
      const { deleteListingVideo } = await import('../video-service');
      const result = await deleteListingVideo(
        'https://cdn.twicely.com/videos/listings/lst-1/video.mp4',
        null
      );
      expect(result.success).toBe(true);
      expect(mockDeleteFromR2).toHaveBeenCalledTimes(1);
    });

    it('returns error on R2 delete failure', async () => {
      mockExtractKeyFromUrl.mockReturnValueOnce('videos/listings/lst-1/video.mp4');
      mockDeleteFromR2.mockRejectedValueOnce(new Error('Delete failed'));
      const { deleteListingVideo } = await import('../video-service');
      const result = await deleteListingVideo(
        'https://cdn.twicely.com/videos/listings/lst-1/video.mp4',
        null
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });

    it('skips video delete when extractKeyFromUrl returns null', async () => {
      // URL on an unknown CDN — extractKeyFromUrl returns null
      mockExtractKeyFromUrl.mockReturnValueOnce(null);
      const { deleteListingVideo } = await import('../video-service');
      const result = await deleteListingVideo('https://other-cdn.com/v.mp4', null);
      expect(result.success).toBe(true);
      expect(mockDeleteFromR2).not.toHaveBeenCalled();
    });

    it('skips thumb delete when extractKeyFromUrl returns null for thumb', async () => {
      mockExtractKeyFromUrl
        .mockReturnValueOnce('videos/listings/lst-2/video.mp4') // video key
        .mockReturnValueOnce(null); // thumb key not found
      const { deleteListingVideo } = await import('../video-service');
      const result = await deleteListingVideo(
        'https://cdn.twicely.com/videos/listings/lst-2/video.mp4',
        'https://other-cdn.com/thumb.jpg'
      );
      expect(result.success).toBe(true);
      // Only the video delete was called
      expect(mockDeleteFromR2).toHaveBeenCalledTimes(1);
    });

    it('returns generic error message when non-Error is thrown', async () => {
      mockExtractKeyFromUrl.mockReturnValueOnce('videos/listings/lst-3/video.mp4');
      mockDeleteFromR2.mockRejectedValueOnce('string-error');
      const { deleteListingVideo } = await import('../video-service');
      const result = await deleteListingVideo(
        'https://cdn.twicely.com/videos/listings/lst-3/video.mp4',
        null
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });
});
