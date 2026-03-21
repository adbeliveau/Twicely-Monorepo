/**
 * Tests for POST /api/realtime/subscribe
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const BUYER_ID = 'buyer-rt-001';
const SELLER_ID = 'seller-rt-002';
const CONV_ID = 'conv-rt-001';

vi.mock('@twicely/casl/authorize', () => ({
  authorize: vi.fn(),
}));
vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

import { authorize } from '@twicely/casl/authorize';
import { db } from '@twicely/db';
import type { Mock } from 'vitest';

const mockAuthorize = authorize as Mock;
const mockSelect = db.select as Mock;

function makeChain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'limit']) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  (c.limit as Mock).mockResolvedValue(rows);
  return c;
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/realtime/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeAbility(canRead = true) {
  return { can: vi.fn().mockReturnValue(canRead) };
}

describe('POST /api/realtime/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CENTRIFUGO_TOKEN_HMAC_SECRET = 'test-secret-key-xyz';
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthorize.mockResolvedValueOnce({ session: null, ability: makeAbility() });

    const { POST } = await import('../route');
    const req = makeRequest({ channel: 'private-conversation.conv-1' });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('returns 400 for missing channel', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: makeAbility(),
    });

    const { POST } = await import('../route');
    const req = makeRequest({});
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 503 when CENTRIFUGO_TOKEN_HMAC_SECRET is not set', async () => {
    delete process.env.CENTRIFUGO_TOKEN_HMAC_SECRET;
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: makeAbility(),
    });

    const { POST } = await import('../route');
    const req = makeRequest({ channel: `private-conversation.${CONV_ID}` });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean; error: string };

    expect(res.status).toBe(503);
    expect(body.error).toContain('not configured');
  });

  it('returns 403 for non-participant conversation channel', async () => {
    process.env.CENTRIFUGO_TOKEN_HMAC_SECRET = 'test-secret';
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: 'outsider-999', onBehalfOfSellerId: null },
      ability: makeAbility(),
    });
    mockSelect.mockReturnValueOnce(makeChain([{ buyerId: BUYER_ID, sellerId: SELLER_ID }]) as never);

    const { POST } = await import('../route');
    const req = makeRequest({ channel: `private-conversation.${CONV_ID}` });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it('returns 200 with token for participant conversation channel', async () => {
    process.env.CENTRIFUGO_TOKEN_HMAC_SECRET = 'test-secret';
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: makeAbility(),
    });
    mockSelect.mockReturnValueOnce(makeChain([{ buyerId: BUYER_ID, sellerId: SELLER_ID }]) as never);

    const { POST } = await import('../route');
    const req = makeRequest({ channel: `private-conversation.${CONV_ID}` });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean; token: string };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
  });

  it('returns 403 for a different user channel', async () => {
    process.env.CENTRIFUGO_TOKEN_HMAC_SECRET = 'test-secret';
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: makeAbility(),
    });

    const { POST } = await import('../route');
    const req = makeRequest({ channel: `private-user.${SELLER_ID}` });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it('returns 200 with token for own user channel', async () => {
    process.env.CENTRIFUGO_TOKEN_HMAC_SECRET = 'test-secret';
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: makeAbility(),
    });

    const { POST } = await import('../route');
    const req = makeRequest({ channel: `private-user.${BUYER_ID}` });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean; token: string };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe('string');
  });
});
