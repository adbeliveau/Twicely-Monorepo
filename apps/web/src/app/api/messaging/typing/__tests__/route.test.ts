/**
 * Tests for POST /api/messaging/typing
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const BUYER_ID = 'buyer-typing-001';
const SELLER_ID = 'seller-typing-002';
const CONV_ID = 'conv-typing-001';

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

describe('POST /api/messaging/typing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockAuthorize.mockResolvedValueOnce({ session: null });

    const { POST } = await import('../route');
    const req = makeRequest({ conversationId: CONV_ID });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('returns 400 for missing conversationId', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
    });

    const { POST } = await import('../route');
    const req = makeRequest({});
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 400 for invalid conversationId (empty string)', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
    });

    const { POST } = await import('../route');
    const req = makeRequest({ conversationId: '' });
    const res = await POST(req as never);

    expect(res.status).toBe(400);
  });

  it('returns 403 for non-participant', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: 'outsider-999', onBehalfOfSellerId: null },
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

  it('returns 200 without publishing for READ_ONLY conversation', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelect.mockReturnValueOnce(
      makeChain([{ buyerId: BUYER_ID, sellerId: SELLER_ID, status: 'READ_ONLY' }]) as never,
    );

    const { POST } = await import('../route');
    const req = makeRequest({ conversationId: CONV_ID });
    const res = await POST(req as never);
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('returns 200 and publishes typing event for OPEN conversation', async () => {
    mockAuthorize.mockResolvedValueOnce({
      session: { userId: BUYER_ID, onBehalfOfSellerId: null },
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
    expect(callArgs[0]).toBe(`private-conversation.${CONV_ID}`);
    expect(callArgs[1].type).toBe('typing');
    expect(callArgs[1].userId).toBe(BUYER_ID);
  });
});
