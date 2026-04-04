/**
 * Tests for GET /api/newsletter/confirm
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockDbSelect,
  mockDbUpdate,
  mockResendSend,
} = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockResendSend: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  newsletterSubscriber: {
    id: 'id',
    email: 'email',
    confirmedAt: 'confirmed_at',
    unsubscribedAt: 'unsubscribed_at',
    unsubscribeToken: 'unsubscribe_token',
    welcomeSentAt: 'welcome_sent_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => ({ eq: true })),
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

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost/api/newsletter/confirm?token=${encodeURIComponent(token)}`
    : 'http://localhost/api/newsletter/confirm';
  return new NextRequest(url);
}

function makeSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

describe('GET /api/newsletter/confirm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockResendSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });
  });

  it('redirects to success for a valid unconfirmed token', async () => {
    mockDbSelect.mockImplementation(() =>
      makeSelectChain([{
        id: 'sub-1',
        email: 'user@example.com',
        confirmedAt: null,
        unsubscribedAt: null,
        welcomeSentAt: null,
      }]),
    );
    mockDbUpdate.mockImplementation(() => makeUpdateChain());

    const { GET } = await import('../confirm/route');
    const res = await GET(makeRequest('valid-token'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('subscribed=success');
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockResendSend).toHaveBeenCalled();
  });

  it('redirects to already for an already confirmed subscription', async () => {
    mockDbSelect.mockImplementation(() =>
      makeSelectChain([{
        id: 'sub-1',
        email: 'user@example.com',
        confirmedAt: new Date('2024-01-01'),
        unsubscribedAt: null,
        welcomeSentAt: new Date('2024-01-01'),
      }]),
    );

    const { GET } = await import('../confirm/route');
    const res = await GET(makeRequest('confirmed-token'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('subscribed=already');
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it('redirects to error for an unknown token', async () => {
    mockDbSelect.mockImplementation(() => makeSelectChain([]));

    const { GET } = await import('../confirm/route');
    const res = await GET(makeRequest('unknown-token'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('subscribed=error');
  });

  it('redirects to error when token param is missing', async () => {
    const { GET } = await import('../confirm/route');
    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('subscribed=error');
  });
});
