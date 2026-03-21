import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUploadToR2 = vi.fn();

vi.mock('../r2-client', () => ({
  uploadToR2: mockUploadToR2,
  deleteFromR2: vi.fn(),
  extractKeyFromUrl: vi.fn(),
  R2_PUBLIC_URL: 'https://cdn.twicely.com',
}));

const mockValidateImageBytes = vi.fn();
const mockDetectImageType = vi.fn();
const mockGetExtension = vi.fn();

vi.mock('@/lib/upload/validate', () => ({
  validateImageBytes: (...args: unknown[]) => mockValidateImageBytes(...args),
  detectImageType: (...args: unknown[]) => mockDetectImageType(...args),
  getExtension: (...args: unknown[]) => mockGetExtension(...args),
}));

// ─── uploadMeetupPhoto — extended coverage ────────────────────────────────────

describe('uploadMeetupPhoto — R2 failure path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateImageBytes.mockReturnValue({ valid: true });
    mockDetectImageType.mockReturnValue('jpeg');
    mockGetExtension.mockReturnValue('jpg');
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns error when R2 upload throws', async () => {
    mockUploadToR2.mockRejectedValue(new Error('S3 connection refused'));
    const { uploadMeetupPhoto } = await import('../image-service');

    const result = await uploadMeetupPhoto('lt-001', Buffer.from('img'), 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe('S3 connection refused');
  });

  it('returns generic Upload failed when R2 throws non-Error', async () => {
    mockUploadToR2.mockRejectedValue('unknown error string');
    const { uploadMeetupPhoto } = await import('../image-service');

    const result = await uploadMeetupPhoto('lt-001', Buffer.from('img'), 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Upload failed');
  });

  it('returns error when detectImageType returns null', async () => {
    mockDetectImageType.mockReturnValue(null);
    const { uploadMeetupPhoto } = await import('../image-service');

    const result = await uploadMeetupPhoto('lt-001', Buffer.from('img'), 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unable to detect image type');
  });

  it('uses png content type when image is PNG', async () => {
    mockDetectImageType.mockReturnValue('png');
    mockGetExtension.mockReturnValue('png');
    const expectedUrl = 'https://cdn.twicely.com/meetup-photos/lt-002/1-9999.png';
    mockUploadToR2.mockResolvedValue(expectedUrl);

    const { uploadMeetupPhoto } = await import('../image-service');
    const result = await uploadMeetupPhoto('lt-002', Buffer.from('png data'), 1);

    expect(result.success).toBe(true);
    expect(mockUploadToR2).toHaveBeenCalledWith(
      expect.stringMatching(/^meetup-photos\/lt-002\/1-\d+\.png$/),
      expect.any(Buffer),
      'image/png'
    );
  });

  it('uses webp content type when image is WebP', async () => {
    mockDetectImageType.mockReturnValue('webp');
    mockGetExtension.mockReturnValue('webp');
    mockUploadToR2.mockResolvedValue('https://cdn.twicely.com/meetup-photos/lt-003/4-0000.webp');

    const { uploadMeetupPhoto } = await import('../image-service');
    await uploadMeetupPhoto('lt-003', Buffer.from('webp data'), 4);

    expect(mockUploadToR2).toHaveBeenCalledWith(
      expect.stringMatching(/^meetup-photos\/lt-003\/4-\d+\.webp$/),
      expect.any(Buffer),
      'image/webp'
    );
  });

  it('encodes position 0 through 4 in the key', async () => {
    mockUploadToR2.mockResolvedValue('https://cdn.twicely.com/meetup-photos/lt-004/3-1111.jpg');

    const { uploadMeetupPhoto } = await import('../image-service');
    await uploadMeetupPhoto('lt-004', Buffer.from('data'), 3);

    const calledKey = mockUploadToR2.mock.calls[0]?.[0] as string;
    expect(calledKey).toMatch(/^meetup-photos\/lt-004\/3-/);
  });

  it('does not call uploadToR2 when validation fails', async () => {
    mockValidateImageBytes.mockReturnValue({ valid: false, error: 'Too large' });
    const { uploadMeetupPhoto } = await import('../image-service');

    await uploadMeetupPhoto('lt-005', Buffer.from('big data'), 0);

    expect(mockUploadToR2).not.toHaveBeenCalled();
  });
});
