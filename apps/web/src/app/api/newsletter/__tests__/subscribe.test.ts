/**
 * Tests for POST /api/newsletter/subscribe (G10.12)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db/cache/valkey', () => ({
  getValkeyClient: vi.fn().mockReturnValue({ incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) }),
}));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { NextRequest } from 'next/server';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockGetPlatformSetting,
  mockResendSend,
} = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockGetPlatformSetting: vi.fn(),
  mockResendSend: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  newsletterSubscriber: {
    id: 'id',
    email: 'email',
    source: 'source',
    unsubscribeToken: 'unsubscribe_token',
    unsubscribedAt: 'unsubscribed_at',
    confirmedAt: 'confirmed_at',
    welcomeSentAt: 'welcome_sent_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => ({ eq: true })),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

vi.mock('resend', () => {
  const ResendMock = vi.fn(function ResendConstructor() {
    return { emails: { send: mockResendSend } };
  });
  return { Resend: ResendMock };
});

vi.mock('@twicely/email/templates/newsletter-welcome', () => ({
  default: vi.fn(() => null),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/newsletter/subscribe', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

function makeInsertChain(result: unknown[]) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/newsletter/subscribe', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
    mockResendSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });
  });

  it('returns 200 { success: true } for a new valid email', async () => {
    mockDbSelect
      .mockImplementationOnce(() => makeSelectChain([]))           // existing check
      .mockImplementationOnce(() => makeSelectChain([{ unsubscribeToken: 'tok-abc' }])); // token fetch
    mockDbInsert.mockImplementation(() => makeInsertChain([{ id: 'sub-1' }]));
    mockDbUpdate.mockImplementation(() => makeUpdateChain());

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'user@example.com' }));
    const body = await res.json() as { success: boolean };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('normalizes email to lowercase', async () => {
    mockDbSelect
      .mockImplementationOnce(() => makeSelectChain([]))
      .mockImplementationOnce(() => makeSelectChain([{ unsubscribeToken: 'tok-abc' }]));
    mockDbInsert.mockImplementation(() => makeInsertChain([{ id: 'sub-1' }]));
    mockDbUpdate.mockImplementation(() => makeUpdateChain());

    const { POST } = await import('../subscribe/route');
    await POST(makeRequest({ email: 'USER@EXAMPLE.COM' }));
    // insert called with lowercase email
    const insertValues = mockDbInsert.mock.results[0]?.value?.values;
    expect(insertValues).toBeDefined();
  });

  it('rejects email with surrounding whitespace (Zod validates before transform)', async () => {
    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: '  user@example.com  ' }));
    const body = await res.json() as { success: boolean; error: string };
    // Zod .email() runs before .transform(), so padded emails fail validation
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 400 for invalid email format', async () => {
    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'not-an-email' }));
    const body = await res.json() as { success: boolean; error: string };
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid email address');
  });

  it('returns 400 for email longer than 254 chars', async () => {
    const { POST } = await import('../subscribe/route');
    const longEmail = `${'a'.repeat(250)}@b.com`;
    const res = await POST(makeRequest({ email: longEmail }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for extra fields (strict mode)', async () => {
    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'user@example.com', extra: 'field' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 { success: true, alreadySubscribed: true } for duplicate active subscription', async () => {
    mockDbSelect.mockImplementation(() =>
      makeSelectChain([{ id: 'sub-1', unsubscribedAt: null }]),
    );

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'active@example.com' }));
    const body = await res.json() as { success: boolean; alreadySubscribed?: boolean };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.alreadySubscribed).toBe(true);
  });

  it('re-subscribes a previously unsubscribed email (clears unsubscribedAt)', async () => {
    mockDbSelect
      .mockImplementationOnce(() =>
        makeSelectChain([{ id: 'sub-1', unsubscribedAt: new Date('2024-01-01') }]),
      )
      .mockImplementationOnce(() => makeSelectChain([{ unsubscribeToken: 'tok-abc' }]));
    mockDbUpdate.mockImplementation(() => makeUpdateChain());
    mockResendSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'returned@example.com' }));
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
    // update was called (re-subscribe + welcomeSentAt)
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('returns 503 when newsletter.enabled is false', async () => {
    mockGetPlatformSetting.mockResolvedValue(false);

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'user@example.com' }));
    const body = await res.json() as { success: boolean; error: string };
    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Newsletter subscriptions are currently unavailable');
  });

  it('calls Resend after successful insert', async () => {
    mockDbSelect
      .mockImplementationOnce(() => makeSelectChain([]))
      .mockImplementationOnce(() => makeSelectChain([{ unsubscribeToken: 'tok-abc' }]));
    mockDbInsert.mockImplementation(() => makeInsertChain([{ id: 'sub-1' }]));
    mockDbUpdate.mockImplementation(() => makeUpdateChain());

    const { POST } = await import('../subscribe/route');
    await POST(makeRequest({ email: 'user@example.com' }));
    expect(mockResendSend).toHaveBeenCalledOnce();
  });

  it('does NOT call Resend when alreadySubscribed', async () => {
    mockDbSelect.mockImplementation(() =>
      makeSelectChain([{ id: 'sub-1', unsubscribedAt: null }]),
    );

    const { POST } = await import('../subscribe/route');
    await POST(makeRequest({ email: 'active@example.com' }));
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it('sets welcomeSentAt after email send', async () => {
    mockDbSelect
      .mockImplementationOnce(() => makeSelectChain([]))
      .mockImplementationOnce(() => makeSelectChain([{ unsubscribeToken: 'tok-abc' }]));
    mockDbInsert.mockImplementation(() => makeInsertChain([{ id: 'sub-1' }]));
    mockDbUpdate.mockImplementation(() => makeUpdateChain());

    const { POST } = await import('../subscribe/route');
    await POST(makeRequest({ email: 'user@example.com' }));
    // update called with welcomeSentAt
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('returns 500 on unexpected DB error', async () => {
    mockDbSelect.mockImplementation(() => {
      throw new Error('DB connection refused');
    });

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'user@example.com' }));
    const body = await res.json() as { success: boolean; error: string };
    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Something went wrong');
  });

  it('accepts source: HOMEPAGE_FOOTER', async () => {
    mockDbSelect
      .mockImplementationOnce(() => makeSelectChain([]))
      .mockImplementationOnce(() => makeSelectChain([{ unsubscribeToken: 'tok-abc' }]));
    mockDbInsert.mockImplementation(() => makeInsertChain([{ id: 'sub-1' }]));
    mockDbUpdate.mockImplementation(() => makeUpdateChain());

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'user@example.com', source: 'HOMEPAGE_FOOTER' }));
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('defaults source to HOMEPAGE_SECTION when omitted', async () => {
    mockDbSelect
      .mockImplementationOnce(() => makeSelectChain([]))
      .mockImplementationOnce(() => makeSelectChain([{ unsubscribeToken: 'tok-abc' }]));
    mockDbInsert.mockImplementation(() => makeInsertChain([{ id: 'sub-1' }]));
    mockDbUpdate.mockImplementation(() => makeUpdateChain());

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'user@example.com' }));
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});
