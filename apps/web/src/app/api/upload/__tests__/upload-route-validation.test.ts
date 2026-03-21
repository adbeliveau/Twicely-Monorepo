import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockAuthorize, mockAbility, mockValidateImageBytes,
        mockDetectImageType, mockIsR2Configured,
        mockHandleVideoUpload, mockHandleVideoThumbnailUpload } = vi.hoisted(() => {
  const mockAbility = { can: vi.fn().mockReturnValue(true) };
  const mockAuthorize = vi.fn();
  const mockValidateImageBytes = vi.fn();
  const mockDetectImageType = vi.fn();
  const mockIsR2Configured = vi.fn();
  const mockHandleVideoUpload = vi.fn();
  const mockHandleVideoThumbnailUpload = vi.fn();
  return {
    mockAuthorize, mockAbility, mockValidateImageBytes, mockDetectImageType, mockIsR2Configured,
    mockHandleVideoUpload, mockHandleVideoThumbnailUpload,
  };
});

vi.mock('@twicely/casl/authorize', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));

vi.mock('@twicely/casl', () => ({
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: { id: 'id', buyerId: 'buyer_id', status: 'status',
                      confirmedAt: 'confirmed_at', meetupPhotoUrls: 'meetup_photo_urls' },
}));

vi.mock('drizzle-orm', () => ({ eq: vi.fn((col, val) => ({ col, val })) }));

vi.mock('@twicely/storage/image-service', () => ({
  uploadListingImage: vi.fn(),
  uploadAvatar: vi.fn(),
  uploadStoreBanner: vi.fn(),
  uploadReceiptImage: vi.fn(),
  uploadMeetupPhoto: vi.fn().mockResolvedValue({ success: true, url: 'https://cdn.twicely.com/x.jpg' }),
}));

vi.mock('../video-handler', () => ({
  handleVideoUpload: (...args: unknown[]) => mockHandleVideoUpload(...args),
  handleVideoThumbnailUpload: (...args: unknown[]) => mockHandleVideoThumbnailUpload(...args),
}));

vi.mock('@/lib/upload/validate', () => ({
  validateImageBytes: (...args: unknown[]) => mockValidateImageBytes(...args),
  detectImageType: (...args: unknown[]) => mockDetectImageType(...args),
  getExtension: vi.fn().mockReturnValue('jpg'),
}));

vi.mock('@twicely/storage/r2-client', () => ({
  isR2Configured: (...args: unknown[]) => mockIsR2Configured(...args),
  extractKeyFromUrl: vi.fn(),
  R2_PUBLIC_URL: 'https://cdn.twicely.com',
}));

vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('fs/promises', () => ({ writeFile: vi.fn(), mkdir: vi.fn() }));
vi.mock('fs', () => ({ existsSync: vi.fn().mockReturnValue(true) }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BUYER_ID = 'buyer-val-001';

function makeSession(userId: string) {
  return { userId, isSeller: false, delegationId: null, onBehalfOfSellerId: null };
}

function makeFileRequest(type: string): NextRequest {
  const formData = new FormData();
  formData.append('type', type);
  const file = new File(['fake-image'], 'photo.jpg', { type: 'image/jpeg' });
  formData.append('file', file);
  return new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData });
}

// ─── Upload route — file validation and type routing ─────────────────────────

describe('POST /api/upload — image validation and type routing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAbility.can.mockReturnValue(true);
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID),
      ability: mockAbility,
    });
    mockValidateImageBytes.mockReturnValue({ valid: true });
    mockDetectImageType.mockReturnValue('jpeg');
    mockIsR2Configured.mockReturnValue(true);
    mockHandleVideoUpload.mockResolvedValue(
      new Response(JSON.stringify({ success: true, video: { id: 'v-1', url: 'https://cdn.twicely.com/v.mp4', durationSeconds: 30 } }), { status: 200 })
    );
    mockHandleVideoThumbnailUpload.mockResolvedValue(
      new Response(JSON.stringify({ success: true, image: { id: 'img-1', url: 'https://cdn.twicely.com/t.jpg' } }), { status: 200 })
    );
  });

  it('returns 400 when image validation fails for any upload type', async () => {
    mockValidateImageBytes.mockReturnValue({ valid: false, error: 'File too large' });
    const { POST } = await import('../route');
    const req = makeFileRequest('listing');
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('File too large');
  });

  it('returns 400 when image type cannot be detected', async () => {
    mockDetectImageType.mockReturnValue(null);
    const { POST } = await import('../route');
    const req = makeFileRequest('listing');
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid image type');
  });

  it('returns 400 for unknown upload type', async () => {
    const { POST } = await import('../route');
    const req = makeFileRequest('unknown-type');
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid upload type');
  });

  it('returns 400 when no file is provided', async () => {
    const formData = new FormData();
    formData.append('type', 'listing');
    const req = new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData });
    const { POST } = await import('../route');
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('No file provided');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    // Use a dedicated userId to avoid contaminating other tests in this file.
    const rateLimitUserId = 'buyer-ratelimit-unique-001';
    mockAuthorize.mockResolvedValue({
      session: { userId: rateLimitUserId, isSeller: false, delegationId: null, onBehalfOfSellerId: null },
      ability: mockAbility,
    });
    // Short-circuit image validation so each request is cheap
    mockValidateImageBytes.mockReturnValue({ valid: false, error: 'stop here' });
    const { POST } = await import('../route');
    // Route limits to 20/min per userId — the 21st request returns 429
    let last429 = false;
    for (let i = 0; i < 21; i++) {
      const req = makeFileRequest('listing');
      const res = await POST(req);
      if (res.status === 429) {
        last429 = true;
        const body = await res.json() as { error: string };
        expect(body.error).toContain('Rate limit');
        break;
      }
    }
    expect(last429).toBe(true);
  });

  it('returns 403 when CASL denies listing upload', async () => {
    mockAbility.can.mockReturnValue(false);
    const { POST } = await import('../route');
    const req = makeFileRequest('listing');
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when CASL denies avatar upload', async () => {
    mockAbility.can.mockReturnValue(false);
    const { POST } = await import('../route');
    const req = makeFileRequest('avatar');
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when CASL denies receipt upload', async () => {
    mockAbility.can.mockReturnValue(false);
    const { POST } = await import('../route');
    const req = makeFileRequest('receipt');
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when CASL denies video upload', async () => {
    mockAbility.can.mockReturnValue(false);
    const { POST } = await import('../route');
    const req = makeFileRequest('video');
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when CASL denies video-thumbnail upload', async () => {
    mockAbility.can.mockReturnValue(false);
    const { POST } = await import('../route');
    const req = makeFileRequest('video-thumbnail');
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('dispatches video type to handleVideoUpload and returns its response', async () => {
    const { POST } = await import('../route');
    const req = makeFileRequest('video');
    const res = await POST(req);
    // handleVideoUpload mock returns 200
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('dispatches video-thumbnail type to handleVideoThumbnailUpload and returns its response', async () => {
    const { POST } = await import('../route');
    const req = makeFileRequest('video-thumbnail');
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});

