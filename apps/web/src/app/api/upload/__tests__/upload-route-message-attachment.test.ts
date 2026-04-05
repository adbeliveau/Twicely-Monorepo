/**
 * Tests for /api/upload — message-attachment type routing and CASL gate.
 *
 * Covers:
 * - CASL denial for message-attachment type returns 403
 * - Authorized message-attachment upload is dispatched to handleMessageAttachmentUpload
 * - Auth check (401 when unauthenticated)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockAuthorize,
  mockAbility,
  mockHandleMessageAttachment,
  mockValidateImageBytes,
  mockDetectImageType,
  mockIsR2Configured,
  mockHandleVideoUpload,
  mockHandleVideoThumbnailUpload,
} = vi.hoisted(() => {
  const mockAbility = { can: vi.fn().mockReturnValue(true) };
  const mockAuthorize = vi.fn();
  const mockHandleMessageAttachment = vi.fn();
  const mockValidateImageBytes = vi.fn();
  const mockDetectImageType = vi.fn();
  const mockIsR2Configured = vi.fn();
  const mockHandleVideoUpload = vi.fn();
  const mockHandleVideoThumbnailUpload = vi.fn();
  return {
    mockAuthorize, mockAbility, mockHandleMessageAttachment, mockValidateImageBytes,
    mockDetectImageType, mockIsR2Configured, mockHandleVideoUpload, mockHandleVideoThumbnailUpload,
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
  localTransaction: {
    id: 'id', buyerId: 'buyer_id', status: 'status',
    confirmedAt: 'confirmed_at', meetupPhotoUrls: 'meetup_photo_urls',
  },
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

vi.mock('../message-attachment-handler', () => ({
  handleMessageAttachmentUpload: (...args: unknown[]) => mockHandleMessageAttachment(...args),
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

const USER_ID = 'user-msg-attach-001';

function makeSession(userId: string) {
  return { userId, isSeller: false, delegationId: null, onBehalfOfSellerId: null };
}

function makeMessageAttachmentRequest(): NextRequest {
  const formData = new FormData();
  formData.append('type', 'message-attachment');
  const file = new File(['fake-image'], 'photo.jpg', { type: 'image/jpeg' });
  formData.append('file', file);
  return new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/upload — message-attachment type', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAbility.can.mockReturnValue(true);
    mockAuthorize.mockResolvedValue({
      session: makeSession(USER_ID),
      ability: mockAbility,
    });
    mockValidateImageBytes.mockReturnValue({ valid: true });
    mockDetectImageType.mockReturnValue('jpeg');
    mockIsR2Configured.mockReturnValue(false);
  });

  it('returns 403 when CASL denies message-attachment upload', async () => {
    mockAbility.can.mockReturnValue(false);

    const { POST } = await import('../route');
    const req = makeMessageAttachmentRequest();
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Forbidden');
  });

  it('dispatches message-attachment to handleMessageAttachmentUpload', async () => {
    mockHandleMessageAttachment.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, url: 'https://cdn.twicely.com/messages/user/abc.jpg' }), {
        status: 200,
      }),
    );

    const { POST } = await import('../route');
    const req = makeMessageAttachmentRequest();
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; url: string };
    expect(body.success).toBe(true);
    expect(mockHandleMessageAttachment).toHaveBeenCalledOnce();
  });

  it('passes correct userId to handleMessageAttachmentUpload', async () => {
    mockHandleMessageAttachment.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, url: 'https://cdn.twicely.com/messages/user/abc.jpg' }), {
        status: 200,
      }),
    );

    const { POST } = await import('../route');
    const req = makeMessageAttachmentRequest();
    await POST(req);

    const callArgs = mockHandleMessageAttachment.mock.calls[0] as [File, string];
    expect(callArgs[1]).toBe(USER_ID);
  });

  it('returns 401 when not authenticated for message-attachment', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: mockAbility });

    const { POST } = await import('../route');
    const req = makeMessageAttachmentRequest();
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });
});
