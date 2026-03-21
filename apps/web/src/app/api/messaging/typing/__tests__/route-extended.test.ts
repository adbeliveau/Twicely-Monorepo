/**
 * Extended tests for POST /api/messaging/typing — edge cases not covered in route.test.ts.
 *
 * Covers:
 * - onBehalfOfSellerId delegation (seller staff can publish typing for their seller's conversation)
 * - Conversation not found returns 404
 * - Seller as participant receives 200 + publish
 * - Extra fields in body are rejected (strict schema)
 * - Non-JSON body returns 400
 * - ARCHIVED conversation: still a participant, silently succeeds without publishing
 * - conversationId exceeding max length returns 400
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const BUYER_ID = 'buyer-typext-001';
const SELLER_ID = 'seller-typext-002';
const STAFF_ID = 'staff-typext-003';
const CONV_ID = 'conv-typext-001';

vi.mock('@twicely/casl/authorize', () => ({
  authorize: vi.fn(),
}));
vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));
vi.mock('@twicely/realtime/centrifugo-publisher', () => ({
  publishToChannel: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@twicely/realtime/messaging-channels', () => ({
  conversationChannel: (id: string) => `private-conversation.${id}`,
  MESSAGING_EVENTS: { TYPING: 'typing', NEW_MESSAGE: 'message', READ_RECEIPT: 'read' },
}));

import { authorize } from '@twicely/casl/authorize';
import { db } from '@twicely/db';
import { publishToChannel } from '@twicely/realtime/centrifugo-publisher';
import type { Mock } from 'vitest';

const mockAuthorize = authorize as Mock;
const mockSelect = db.select as Mock;
const mockPublish = publishToChannel as Mock;

function makeChain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'limit']) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  (c.limit as Mock).mockResolvedValue(rows);
  return c;
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/messaging/typing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(rawBody: string): Request {
  return new Request('http://localhost/api/messaging/typing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  });
}

describe('POST /api/messaging/typing — extended edge cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when conversation does not exist', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const { POST } = await import('../route');
    const req = makeRequest({ conversationId: CONV_ID });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean; error: string };

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Not found.');
  });

  it('returns 400 for non-JSON body', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
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
    ability: { can: vi.fn().mockReturnValue(true) },
    });

    const { POST } = await import('../route');
    const req = makeRequest({ conversationId: CONV_ID, extraField: 'not-allowed' });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 400 for conversationId exceeding max length (>100 chars)', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
    });

    const { POST } = await import('../route');
    const longId = 'a'.repeat(101);
    const req = makeRequest({ conversationId: longId });
    const res = await POST(req as never);

    expect(res.status).toBe(400);
  });

  it('seller as participant returns 200 and publishes typing for OPEN conversation', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: SELLER_ID, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelect.mockReturnValueOnce(
      makeChain([{ buyerId: BUYER_ID, sellerId: SELLER_ID, status: 'OPEN' }]) as never,
    );

    const { POST } = await import('../route');
    const req = makeRequest({ conversationId: CONV_ID });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPublish).toHaveBeenCalledOnce();
    const callArgs = mockPublish.mock.calls[0] as [string, { type: string; userId: string }];
    expect(callArgs[1].userId).toBe(SELLER_ID);
  });

  it('staff with onBehalfOfSellerId can publish typing for the delegated seller conversation', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: STAFF_ID, onBehalfOfSellerId: SELLER_ID },
    ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelect.mockReturnValueOnce(
      makeChain([{ buyerId: BUYER_ID, sellerId: SELLER_ID, status: 'OPEN' }]) as never,
    );

    const { POST } = await import('../route');
    const req = makeRequest({ conversationId: CONV_ID });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPublish).toHaveBeenCalledOnce();
  });

  it('ARCHIVED conversation returns 200 without publishing (not OPEN, not READ_ONLY)', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelect.mockReturnValueOnce(
      makeChain([{ buyerId: BUYER_ID, sellerId: SELLER_ID, status: 'ARCHIVED' }]) as never,
    );

    const { POST } = await import('../route');
    const req = makeRequest({ conversationId: CONV_ID });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean };

    // ARCHIVED is not OPEN so publishToChannel is NOT called
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('non-participant with onBehalfOfSellerId for a different seller is still rejected', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: STAFF_ID, onBehalfOfSellerId: 'other-seller-999' },
    ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelect.mockReturnValueOnce(
      makeChain([{ buyerId: BUYER_ID, sellerId: SELLER_ID, status: 'OPEN' }]) as never,
    );

    const { POST } = await import('../route');
    const req = makeRequest({ conversationId: CONV_ID });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it('published typing event channel matches conversationChannel helper output', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelect.mockReturnValueOnce(
      makeChain([{ buyerId: BUYER_ID, sellerId: SELLER_ID, status: 'OPEN' }]) as never,
    );

    const { POST } = await import('../route');
    const req = makeRequest({ conversationId: CONV_ID });
    await POST(req as never);

    const [channelArg, dataArg] = mockPublish.mock.calls[0] as [string, { type: string; userId: string }];
    expect(channelArg).toBe(`private-conversation.${CONV_ID}`);
    expect(dataArg.type).toBe('typing');
  });
});
