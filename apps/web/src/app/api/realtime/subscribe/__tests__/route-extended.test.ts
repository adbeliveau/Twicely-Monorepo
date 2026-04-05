/**
 * Extended tests for POST /api/realtime/subscribe — edge cases not covered in route.test.ts.
 *
 * Covers:
 * - onBehalfOfSellerId delegation (seller staff subscribing to their seller's conversation)
 * - Conversation not found returns 404
 * - Unknown channel pattern returns 400
 * - Non-JSON body returns 400
 * - Extra fields in body are rejected (strict schema)
 * - Token format: contains exactly one dot separator
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const BUYER_ID = 'buyer-ext-001';
const SELLER_ID = 'seller-ext-002';
const STAFF_ID = 'staff-ext-003';
const CONV_ID = 'conv-ext-001';

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

function makeRawRequest(rawBody: string): Request {
  return new Request('http://localhost/api/realtime/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  });
}

function makeAbility(canRead = true) {
  return { can: vi.fn().mockReturnValue(canRead) };
}

describe('POST /api/realtime/subscribe — extended edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CENTRIFUGO_TOKEN_HMAC_SECRET = 'test-secret-ext-xyz';
  });

  it('returns 404 when conversation does not exist', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: makeAbility(),
    });
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const { POST } = await import('../route');
    const req = makeRequest({ channel: `private-conversation.${CONV_ID}` });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean; error: string };

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Not found.');
  });

  it('returns 400 for unknown channel pattern', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: makeAbility(),
    });

    const { POST } = await import('../route');
    const req = makeRequest({ channel: 'public-channel.some-id' });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean; error: string };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid channel.');
  });

  it('returns 400 for non-JSON body', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: makeAbility(),
    });

    const { POST } = await import('../route');
    const req = makeRawRequest('not-valid-json{{{');
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean; error: string };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid request body.');
  });

  it('returns 400 for extra fields in body (strict schema)', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: makeAbility(),
    });

    const { POST } = await import('../route');
    const req = makeRequest({
      channel: `private-conversation.${CONV_ID}`,
      extraField: 'should-be-rejected',
    });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 403 for Conversation CASL gate denial', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: makeAbility(false),
    });

    const { POST } = await import('../route');
    const req = makeRequest({ channel: `private-conversation.${CONV_ID}` });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean; error: string };

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Forbidden');
  });

  it('allows seller staff to subscribe via onBehalfOfSellerId (conversation owned by delegated seller)', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: STAFF_ID, onBehalfOfSellerId: SELLER_ID },
      ability: makeAbility(),
    });
    // conversation where sellerId matches the onBehalfOfSellerId
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

  it('token format contains exactly one dot separator', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: makeAbility(),
    });
    mockSelect.mockReturnValueOnce(makeChain([{ buyerId: BUYER_ID, sellerId: SELLER_ID }]) as never);

    const { POST } = await import('../route');
    const req = makeRequest({ channel: `private-conversation.${CONV_ID}` });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean; token: string };

    expect(body.success).toBe(true);
    const parts = body.token.split('.');
    // SEC-030: Standard JWT — header.payload.signature (3 parts)
    expect(parts).toHaveLength(3);
    expect(parts[0]!.length).toBeGreaterThan(0);
    expect(parts[1]!.length).toBeGreaterThan(0);
    expect(parts[2]!.length).toBeGreaterThan(0);
  });

  it('token payload contains the correct sub claim', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
      ability: makeAbility(),
    });
    mockSelect.mockReturnValueOnce(makeChain([{ buyerId: BUYER_ID, sellerId: SELLER_ID }]) as never);

    const { POST } = await import('../route');
    const req = makeRequest({ channel: `private-conversation.${CONV_ID}` });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean; token: string };

    expect(body.success).toBe(true);
    // SEC-030: Standard JWT — payload is the second part (index 1)
    const [, encodedPayload] = body.token.split('.');
    const decodedPayload = JSON.parse(Buffer.from(encodedPayload!, 'base64url').toString('utf-8')) as {
      sub: string;
      channel: string;
      exp: number;
    };

    expect(decodedPayload.sub).toBe(BUYER_ID);
    expect(decodedPayload.channel).toBe(`private-conversation.${CONV_ID}`);
    expect(typeof decodedPayload.exp).toBe('number');
    // exp should be ~1 hour in the future
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(decodedPayload.exp).toBeGreaterThan(nowSeconds);
    expect(decodedPayload.exp).toBeLessThanOrEqual(nowSeconds + 3601);
  });

  it('buyer is a participant and receives token', async () => {
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
    expect(body.token).toBeTruthy();
  });

  it('seller is a participant and receives token', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: SELLER_ID, onBehalfOfSellerId: null },
      ability: makeAbility(),
    });
    mockSelect.mockReturnValueOnce(makeChain([{ buyerId: BUYER_ID, sellerId: SELLER_ID }]) as never);

    const { POST } = await import('../route');
    const req = makeRequest({ channel: `private-conversation.${CONV_ID}` });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean; token: string };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
