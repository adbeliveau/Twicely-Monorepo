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

// Mock the validation module
vi.mock('../validate', () => ({
  validateImageBytes: vi.fn().mockReturnValue({ valid: true }),
  detectImageType: vi.fn().mockReturnValue('jpeg'),
  getExtension: vi.fn().mockReturnValue('jpg'),
}));

describe('Image Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadToR2.mockResolvedValue('https://cdn.twicely.com/test/image.jpg');
    mockDeleteFromR2.mockResolvedValue(undefined);
    mockExtractKeyFromUrl.mockReturnValue('test/image.jpg');
  });

  describe('uploadListingImage', () => {
    it('validates image type and size', async () => {
      const { validateImageBytes } = await import('../validate');
      const { uploadListingImage } = await import('../image-service');

      const buffer = Buffer.from('fake image data');
      await uploadListingImage('listing-123', buffer, 0);

      expect(validateImageBytes).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        buffer.length
      );
    });

    it('returns error for invalid image', async () => {
      const { validateImageBytes } = await import('../validate');
      vi.mocked(validateImageBytes).mockReturnValueOnce({
        valid: false,
        error: 'File too large',
      });

      const { uploadListingImage } = await import('../image-service');
      const result = await uploadListingImage('listing-123', Buffer.from('x'), 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('File too large');
    });

    it('generates correct key pattern for listing images', async () => {
      const { uploadListingImage } = await import('../image-service');
      const buffer = Buffer.from('fake image data');

      await uploadListingImage('listing-abc', buffer, 3);

      expect(mockUploadToR2).toHaveBeenCalledWith(
        expect.stringMatching(/^listings\/listing-abc\/3-\d+\.jpg$/),
        buffer,
        'image/jpeg'
      );
    });

    it('returns URL on successful upload', async () => {
      const { uploadListingImage } = await import('../image-service');
      const result = await uploadListingImage('listing-123', Buffer.from('x'), 0);

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://cdn.twicely.com/test/image.jpg');
    });
  });

  describe('uploadAvatar', () => {
    it('generates correct key pattern for avatars', async () => {
      const { uploadAvatar } = await import('../image-service');
      const buffer = Buffer.from('avatar data');

      await uploadAvatar('user-xyz', buffer);

      expect(mockUploadToR2).toHaveBeenCalledWith(
        expect.stringMatching(/^avatars\/user-xyz\/\d+\.jpg$/),
        buffer,
        'image/jpeg'
      );
    });

    it('returns error for undetectable image type', async () => {
      const { detectImageType } = await import('../validate');
      vi.mocked(detectImageType).mockReturnValueOnce(null);

      const { uploadAvatar } = await import('../image-service');
      const result = await uploadAvatar('user-xyz', Buffer.from('x'));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unable to detect image type');
    });
  });

  describe('uploadStoreBanner', () => {
    it('generates correct key pattern for banners', async () => {
      const { uploadStoreBanner } = await import('../image-service');
      const buffer = Buffer.from('banner data');

      await uploadStoreBanner('seller-123', buffer);

      expect(mockUploadToR2).toHaveBeenCalledWith(
        expect.stringMatching(/^banners\/seller-123\/\d+\.jpg$/),
        buffer,
        'image/jpeg'
      );
    });
  });

  describe('deleteImage', () => {
    it('extracts key from URL and deletes', async () => {
      const { deleteImage } = await import('../image-service');

      const result = await deleteImage('https://cdn.twicely.com/test/image.jpg');

      expect(mockExtractKeyFromUrl).toHaveBeenCalledWith('https://cdn.twicely.com/test/image.jpg');
      expect(mockDeleteFromR2).toHaveBeenCalledWith('test/image.jpg');
      expect(result.success).toBe(true);
    });

    it('succeeds silently for non-R2 URLs', async () => {
      mockExtractKeyFromUrl.mockReturnValueOnce(null);
      const { deleteImage } = await import('../image-service');

      const result = await deleteImage('https://other-cdn.com/image.jpg');

      expect(mockDeleteFromR2).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('dev mode (missing R2 credentials)', () => {
    it('uploadListingImage returns mock URL when R2 not configured', async () => {
      mockUploadToR2.mockResolvedValueOnce('https://cdn.twicely.com/mock/listings/test.jpg');

      const { uploadListingImage } = await import('../image-service');
      const result = await uploadListingImage('lst-1', Buffer.from('x'), 0);

      expect(result.success).toBe(true);
      expect(result.url).toContain('cdn.twicely.com');
    });
  });
});
