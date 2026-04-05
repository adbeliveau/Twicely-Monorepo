import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockAuthorize, mockAbility, mockDbSelect, mockUploadMeetupPhoto,
        mockValidateImageBytes, mockDetectImageType, mockIsR2Configured } = vi.hoisted(() => {
  const mockAbility = { can: vi.fn().mockReturnValue(true) };
  const mockAuthorize = vi.fn();
  const mockDbSelect = vi.fn();
  const mockUploadMeetupPhoto = vi.fn();
  const mockValidateImageBytes = vi.fn();
  const mockDetectImageType = vi.fn();
  const mockIsR2Configured = vi.fn();
  return {
    mockAuthorize, mockAbility, mockDbSelect, mockUploadMeetupPhoto,
    mockValidateImageBytes, mockDetectImageType, mockIsR2Configured,
  };
});

vi.mock('@twicely/casl/authorize', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));

vi.mock('@twicely/casl', () => ({
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: {
    id: 'id',
    buyerId: 'buyer_id',
    status: 'status',
    confirmedAt: 'confirmed_at',
    meetupPhotoUrls: 'meetup_photo_urls',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

vi.mock('@twicely/storage/image-service', () => ({
  uploadListingImage: vi.fn(),
  uploadAvatar: vi.fn(),
  uploadStoreBanner: vi.fn(),
  uploadReceiptImage: vi.fn(),
  uploadMeetupPhoto: (...args: unknown[]) => mockUploadMeetupPhoto(...args),
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

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

vi.mock('../video-handler', () => ({
  handleVideoUpload: vi.fn(),
  handleVideoThumbnailUpload: vi.fn(),
}));
vi.mock('../message-attachment-handler', () => ({
  handleMessageAttachmentUpload: vi.fn(),
}));
vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: vi.fn().mockReturnValue({
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  }),
}));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(10),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BUYER_ID = 'buyer-upload-001';
const TX_ID = 'lt-upload-001';
const PHOTO_URL = 'https://cdn.twicely.com/meetup-photos/lt-upload-001/0-1234.jpg';

function makeSession(userId: string) {
  return { userId, isSeller: false, delegationId: null, onBehalfOfSellerId: null };
}

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    buyerId: BUYER_ID,
    sellerId: 'seller-upload-001',
    status: 'BOTH_CHECKED_IN',
    confirmedAt: null,
    meetupPhotoUrls: [] as string[],
    ...overrides,
  };
}

function makeSelectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeMeetupPhotoRequest(txId: string | null): NextRequest {
  const formData = new FormData();
  formData.append('type', 'meetup-photo');
  if (txId !== null) {
    formData.append('localTransactionId', txId);
  }
  const file = new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' });
  formData.append('file', file);
  return new NextRequest('http://localhost/api/upload', {
    method: 'POST',
    body: formData,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/upload — meetup-photo type', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAbility.can.mockReturnValue(true);
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID),
      ability: mockAbility,
    });
    // Default: image validation passes
    mockValidateImageBytes.mockReturnValue({ valid: true });
    mockDetectImageType.mockReturnValue('jpeg');
    // Default: R2 is configured
    mockIsR2Configured.mockReturnValue(true);
    mockUploadMeetupPhoto.mockResolvedValue({ success: true, url: PHOTO_URL });
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: mockAbility });
    const { POST } = await import('../route');
    const req = makeMeetupPhotoRequest(TX_ID);
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when CASL denies meetup-photo ability', async () => {
    mockAbility.can.mockReturnValue(false);
    const { POST } = await import('../route');
    const req = makeMeetupPhotoRequest(TX_ID);
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 400 when localTransactionId is missing', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);
    const { POST } = await import('../route');
    const req = makeMeetupPhotoRequest(null);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.error).toBe('localTransactionId required');
  });

  it('returns 404 when transaction not found', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);
    const { POST } = await import('../route');
    const req = makeMeetupPhotoRequest(TX_ID);
    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.error).toBe('Not found');
  });

  it('returns 404 when buyer does not own the transaction', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ buyerId: 'other-user' })]) as never);
    const { POST } = await import('../route');
    const req = makeMeetupPhotoRequest(TX_ID);
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 400 when transaction status is SCHEDULED', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'SCHEDULED' })]) as never);
    const { POST } = await import('../route');
    const req = makeMeetupPhotoRequest(TX_ID);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.error).toContain('before confirming receipt');
  });

  it('returns 400 when transaction is already confirmed', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([
      makeTx({ status: 'BOTH_CHECKED_IN', confirmedAt: new Date() }),
    ]) as never);
    const { POST } = await import('../route');
    const req = makeMeetupPhotoRequest(TX_ID);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.error).toContain('already confirmed');
  });

  it('returns 400 when transaction already has 5 photos', async () => {
    const fivePhotos = Array.from({ length: 5 }, (_, i) =>
      `https://cdn.twicely.com/meetup-photos/lt/p${i}.jpg`
    );
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ meetupPhotoUrls: fivePhotos })]) as never);
    const { POST } = await import('../route');
    const req = makeMeetupPhotoRequest(TX_ID);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.error).toContain('Maximum 5');
  });

  it('returns success with image URL on valid upload', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const { POST } = await import('../route');
    const req = makeMeetupPhotoRequest(TX_ID);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; image: { url: string; position: number } };
    expect(body.success).toBe(true);
    expect(body.image.url).toBe(PHOTO_URL);
    expect(body.image.position).toBe(0);
  });

  it('returns 400 when uploadMeetupPhoto fails', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockUploadMeetupPhoto.mockResolvedValue({ success: false, error: 'R2 timeout' });
    const { POST } = await import('../route');
    const req = makeMeetupPhotoRequest(TX_ID);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.error).toBe('R2 timeout');
  });
});
