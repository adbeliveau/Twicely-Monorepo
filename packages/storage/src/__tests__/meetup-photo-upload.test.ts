import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUploadToR2 = vi.fn();

vi.mock('../r2-client', () => ({
  uploadToR2: mockUploadToR2,
  deleteFromR2: vi.fn(),
  extractKeyFromUrl: vi.fn(),
  R2_PUBLIC_URL: 'https://cdn.twicely.com',
}));

vi.mock('../validate', () => ({
  validateImageBytes: vi.fn().mockReturnValue({ valid: true }),
  detectImageType: vi.fn().mockReturnValue('jpeg'),
  getExtension: vi.fn().mockReturnValue('jpg'),
}));

// ─── uploadMeetupPhoto ────────────────────────────────────────────────────────

describe('uploadMeetupPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadToR2.mockResolvedValue('https://cdn.twicely.com/meetup-photos/lt-001/0-1234567890.jpg');
  });

  it('generates correct R2 key pattern: meetup-photos/{txId}/{position}-{ts}.{ext}', async () => {
    const { uploadMeetupPhoto } = await import('../image-service');
    const buffer = Buffer.from('fake image data');

    await uploadMeetupPhoto('lt-abc123', buffer, 2);

    expect(mockUploadToR2).toHaveBeenCalledWith(
      expect.stringMatching(/^meetup-photos\/lt-abc123\/2-\d+\.jpg$/),
      buffer,
      'image/jpeg'
    );
  });

  it('validates image bytes before uploading', async () => {
    const { validateImageBytes } = await import('../validate');
    const { uploadMeetupPhoto } = await import('../image-service');

    const buffer = Buffer.from('fake image data');
    await uploadMeetupPhoto('lt-001', buffer, 0);

    expect(validateImageBytes).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      buffer.length
    );
  });

  it('rejects invalid image types', async () => {
    const { validateImageBytes } = await import('../validate');
    vi.mocked(validateImageBytes).mockReturnValueOnce({ valid: false, error: 'File too large' });

    const { uploadMeetupPhoto } = await import('../image-service');
    const result = await uploadMeetupPhoto('lt-001', Buffer.from('x'), 0);

    expect(result.success).toBe(false);
    expect(result.error).toBe('File too large');
  });

  it('returns success with URL on valid upload', async () => {
    const { uploadMeetupPhoto } = await import('../image-service');
    const result = await uploadMeetupPhoto('lt-001', Buffer.from('fake image'), 0);

    expect(result.success).toBe(true);
    expect(result.url).toContain('meetup-photos');
  });
});
