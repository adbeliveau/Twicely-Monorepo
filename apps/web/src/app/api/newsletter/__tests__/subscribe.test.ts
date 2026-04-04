/**
 * Tests for POST /api/newsletter/subscribe
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockGetPlatformSetting,
  mockResendSend,
  mockValkeyIncr,
  mockValkeyExpire,
} = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockGetPlatformSetting: vi.fn(),
  mockResendSend: vi.fn(),
  mockValkeyIncr: vi.fn(),
  mockValkeyExpire: vi.fn(),
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

vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: vi.fn(() => ({
    incr: mockValkeyIncr,
    expire: mockValkeyExpire,
  })),
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

vi.mock('@twicely/email/templates/newsletter-confirmation', () => ({
  default: vi.fn(() => null),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

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

describe('POST /api/newsletter/subscribe', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockValkeyIncr.mockResolvedValue(1);
    mockValkeyExpire.mockResolvedValue(1);
    mockGetPlatformSetting.mockImplementation((key: unknown, fallback: unknown) => {
      if (key === 'newsletter.enabled') return Promise.resolve(true);
      if (key === 'newsletter.doubleOptIn') return Promise.resolve(true);
      return Promise.resolve(fallback);
    });
    mockResendSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });
  });

  it('returns 503 when Valkey rate limiting is unavailable', async () => {
    mockValkeyIncr.mockRejectedValue(new Error('Valkey down'));

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'user@example.com' }));
    const body = await res.json() as { success: boolean; error: string };

    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toContain('temporarily unavailable');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockValkeyIncr.mockResolvedValue(4);

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'user@example.com' }));

    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid email format', async () => {
    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'not-an-email' }));
    const body = await res.json() as { success: boolean; error: string };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid email address');
  });

  it('returns 503 when newsletter.enabled is false', async () => {
    mockGetPlatformSetting.mockImplementation((key: unknown) => {
      if (key === 'newsletter.enabled') return Promise.resolve(false);
      if (key === 'newsletter.doubleOptIn') return Promise.resolve(true);
      return Promise.resolve(true);
    });

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'user@example.com' }));
    const body = await res.json() as { success: boolean; error: string };

    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toContain('currently unavailable');
  });

  it('returns alreadySubscribed for an active confirmed subscriber', async () => {
    mockDbSelect.mockImplementation(() =>
      makeSelectChain([{ id: 'sub-1', unsubscribedAt: null, confirmedAt: new Date('2024-01-01') }]),
    );

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'active@example.com' }));
    const body = await res.json() as { success: boolean; alreadySubscribed?: boolean };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.alreadySubscribed).toBe(true);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it('creates an unconfirmed subscriber and sends a confirmation email when double opt-in is enabled', async () => {
    mockDbSelect
      .mockImplementationOnce(() => makeSelectChain([]))
      .mockImplementationOnce(() => makeSelectChain([{ unsubscribeToken: 'tok-abc' }]));
    mockDbInsert.mockImplementation(() => makeInsertChain([{ id: 'sub-1' }]));

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'user@example.com' }));
    const body = await res.json() as { success: boolean; confirmationRequired?: boolean };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.confirmationRequired).toBe(true);
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Confirm your Twicely updates subscription',
    }));
  });

  it('re-sends confirmation for an existing unconfirmed subscriber', async () => {
    mockDbSelect
      .mockImplementationOnce(() =>
        makeSelectChain([{ id: 'sub-1', unsubscribedAt: null, confirmedAt: null }]),
      )
      .mockImplementationOnce(() => makeSelectChain([{ unsubscribeToken: 'tok-abc' }]));
    mockDbUpdate.mockImplementation(() => makeUpdateChain());

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'user@example.com' }));
    const body = await res.json() as { success: boolean; confirmationRequired?: boolean };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.confirmationRequired).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('re-subscribes an unsubscribed address into the confirmation flow', async () => {
    mockDbSelect
      .mockImplementationOnce(() =>
        makeSelectChain([{ id: 'sub-1', unsubscribedAt: new Date('2024-01-01'), confirmedAt: new Date('2024-01-01') }]),
      )
      .mockImplementationOnce(() => makeSelectChain([{ unsubscribeToken: 'tok-abc' }]));
    mockDbUpdate.mockImplementation(() => makeUpdateChain());

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'returned@example.com' }));
    const body = await res.json() as { success: boolean; confirmationRequired?: boolean };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.confirmationRequired).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('sends the welcome email immediately when double opt-in is disabled', async () => {
    mockGetPlatformSetting.mockImplementation((key: unknown, fallback: unknown) => {
      if (key === 'newsletter.enabled') return Promise.resolve(true);
      if (key === 'newsletter.doubleOptIn') return Promise.resolve(false);
      return Promise.resolve(fallback);
    });
    mockDbSelect
      .mockImplementationOnce(() => makeSelectChain([]))
      .mockImplementationOnce(() => makeSelectChain([{ unsubscribeToken: 'tok-abc' }]));
    mockDbInsert.mockImplementation(() => makeInsertChain([{ id: 'sub-1' }]));
    mockDbUpdate.mockImplementation(() => makeUpdateChain());

    const { POST } = await import('../subscribe/route');
    const res = await POST(makeRequest({ email: 'user@example.com' }));
    const body = await res.json() as { success: boolean; confirmationRequired?: boolean };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.confirmationRequired).toBeUndefined();
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Welcome to Twicely updates',
    }));
    expect(mockDbUpdate).toHaveBeenCalled();
  });
});
