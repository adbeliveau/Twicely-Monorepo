/**
 * Tests for GET /api/newsletter/unsubscribe (G10.12)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockDbSelect, mockDbUpdate } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
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
    unsubscribedAt: 'unsubscribed_at',
    unsubscribeToken: 'unsubscribe_token',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => ({ eq: true })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
    : 'http://localhost/api/newsletter/unsubscribe';
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/newsletter/unsubscribe', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('redirects to /?unsubscribed=success for a valid token', async () => {
    mockDbSelect.mockImplementation(() =>
      makeSelectChain([{ id: 'sub-1', unsubscribedAt: null }]),
    );
    mockDbUpdate.mockImplementation(() => makeUpdateChain());

    const { GET } = await import('../unsubscribe/route');
    const res = await GET(makeRequest('valid-token-abc'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('unsubscribed=success');
  });

  it('redirects to /?unsubscribed=error for an unknown token', async () => {
    mockDbSelect.mockImplementation(() => makeSelectChain([]));

    const { GET } = await import('../unsubscribe/route');
    const res = await GET(makeRequest('unknown-token'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('unsubscribed=error');
  });

  it('redirects to /?unsubscribed=error when token param is missing', async () => {
    const { GET } = await import('../unsubscribe/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('unsubscribed=error');
  });

  it('redirects to /?unsubscribed=already when already unsubscribed (idempotent)', async () => {
    mockDbSelect.mockImplementation(() =>
      makeSelectChain([{ id: 'sub-1', unsubscribedAt: new Date('2024-06-01') }]),
    );

    const { GET } = await import('../unsubscribe/route');
    const res = await GET(makeRequest('already-done-token'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('unsubscribed=already');
  });
});
