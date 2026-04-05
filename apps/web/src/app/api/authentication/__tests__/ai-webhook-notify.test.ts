/**
 * Tests for notifyAuthResult calls in POST /api/authentication/ai-webhook — G10.2
 * Verifies the correct result type is forwarded to the notifier for each outcome.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDb = { select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert };

const mockVerifySignature = vi.fn();
const mockParseWebhook = vi.fn();
const mockAiProvider = {
  name: 'entrupy',
  submitForAuthentication: vi.fn(),
  getResult: vi.fn(),
  verifyWebhookSignature: (...args: unknown[]) => mockVerifySignature(...args),
  parseWebhookResult: (...args: unknown[]) => mockParseWebhook(...args),
};
const mockGetAiAuthProvider = vi.fn().mockResolvedValue(mockAiProvider);
const mockNotifyAuthResult = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@/lib/authentication/ai-provider-factory', () => ({
  getAiAuthProvider: (...args: unknown[]) => mockGetAiAuthProvider(...args),
}));
vi.mock('@/lib/authentication/auth-notifier', () => ({
  notifyAuthResult: (...args: unknown[]) => mockNotifyAuthResult(...args),
}));
vi.mock('@/lib/authentication/cost-split', () => ({
  calculateAuthCostSplit: vi.fn().mockReturnValue({ buyerShareCents: 500, sellerShareCents: 1499 }),
}));
vi.mock('@twicely/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ─── Chainable mock helpers ──────────────────────────────────────────────────

function chainSelect(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    then: vi.fn().mockImplementation((resolve: (val: unknown[]) => unknown) =>
      Promise.resolve(result).then(resolve),
    ),
  };
}

function chainUpdate() {
  return { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
}

function chainInsert() {
  return { values: vi.fn().mockResolvedValue([]) };
}

function makeRequest(body: string, signature = 'valid-sig'): NextRequest {
  return new NextRequest('http://localhost/api/authentication/ai-webhook', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'x-entrupy-signature': signature,
    },
  });
}

// ─── Shared fixture ──────────────────────────────────────────────────────────

const AI_PENDING_REQ = {
  id: 'auth-req-notify-1',
  listingId: 'clst2xxxxxxxxxxxxxxxxxxx',
  sellerId: 'seller-notify-1',
  buyerId: 'buyer-notify-1',
  initiator: 'BUYER',
  tier: 'AI',
  status: 'AI_PENDING',
  totalFeeCents: 1999,
};

const AI_PENDING_REQ_NO_BUYER = {
  ...AI_PENDING_REQ,
  buyerId: null,
  initiator: 'SELLER',
};

const LISTING_ROW = { title: 'Vintage Handbag' };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/authentication/ai-webhook — notifyAuthResult calls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockVerifySignature.mockReturnValue(true);
    mockNotifyAuthResult.mockResolvedValue(undefined);
  });

  it('calls notifyAuthResult with INCONCLUSIVE after inconclusive result', async () => {
    const payload = JSON.stringify({ id: 'ref-inc', status: 'inconclusive', confidence: 0.35 });
    mockParseWebhook.mockReturnValue({
      providerRef: 'ref-inc',
      status: 'INCONCLUSIVE',
      confidence: 0.35,
      resultJson: {},
      resultNotes: '',
    });

    mockDbSelect
      .mockReturnValueOnce(chainSelect([AI_PENDING_REQ]))
      .mockReturnValueOnce(chainSelect([LISTING_ROW]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { POST } = await import('../ai-webhook/route');
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(mockNotifyAuthResult).toHaveBeenCalledWith(
      AI_PENDING_REQ.sellerId,
      AI_PENDING_REQ.buyerId,
      AI_PENDING_REQ.listingId,
      LISTING_ROW.title,
      'INCONCLUSIVE',
      0.35,
    );
  });

  it('calls notifyAuthResult with AUTHENTICATED after authenticated result', async () => {
    const payload = JSON.stringify({ id: 'ref-auth', status: 'authentic', confidence: 0.99 });
    mockParseWebhook.mockReturnValue({
      providerRef: 'ref-auth',
      status: 'AUTHENTICATED',
      confidence: 0.99,
      resultJson: {},
      resultNotes: '',
    });

    mockDbSelect
      .mockReturnValueOnce(chainSelect([AI_PENDING_REQ]))
      .mockReturnValueOnce(chainSelect([LISTING_ROW]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: (val: unknown[]) => unknown) =>
          Promise.resolve([{ verifyUrl: 'https://twicely.co/verify/TW-ABC' }]).then(resolve),
        ),
      });
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { POST } = await import('../ai-webhook/route');
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(mockNotifyAuthResult).toHaveBeenCalledWith(
      AI_PENDING_REQ.sellerId,
      AI_PENDING_REQ.buyerId,
      AI_PENDING_REQ.listingId,
      LISTING_ROW.title,
      'AUTHENTICATED',
      0.99,
    );
  });

  it('calls notifyAuthResult with COUNTERFEIT after counterfeit result', async () => {
    const payload = JSON.stringify({ id: 'ref-fake', status: 'fake', confidence: 0.97 });
    mockParseWebhook.mockReturnValue({
      providerRef: 'ref-fake',
      status: 'COUNTERFEIT',
      confidence: 0.97,
      resultJson: {},
      resultNotes: '',
    });

    mockDbSelect
      .mockReturnValueOnce(chainSelect([AI_PENDING_REQ]))
      .mockReturnValueOnce(chainSelect([LISTING_ROW]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { POST } = await import('../ai-webhook/route');
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(mockNotifyAuthResult).toHaveBeenCalledWith(
      AI_PENDING_REQ.sellerId,
      AI_PENDING_REQ.buyerId,
      AI_PENDING_REQ.listingId,
      LISTING_ROW.title,
      'COUNTERFEIT',
      0.97,
    );
  });

  it('passes null buyerId to notifyAuthResult when no buyer on request', async () => {
    const payload = JSON.stringify({ id: 'ref-no-buyer', status: 'authentic', confidence: 0.99 });
    mockParseWebhook.mockReturnValue({
      providerRef: 'ref-no-buyer',
      status: 'AUTHENTICATED',
      confidence: 0.99,
      resultJson: {},
      resultNotes: '',
    });

    mockDbSelect
      .mockReturnValueOnce(chainSelect([AI_PENDING_REQ_NO_BUYER]))
      .mockReturnValueOnce(chainSelect([LISTING_ROW]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: (val: unknown[]) => unknown) =>
          Promise.resolve([{ verifyUrl: null }]).then(resolve),
        ),
      });
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { POST } = await import('../ai-webhook/route');
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(mockNotifyAuthResult).toHaveBeenCalledWith(
      AI_PENDING_REQ_NO_BUYER.sellerId,
      null,
      AI_PENDING_REQ_NO_BUYER.listingId,
      LISTING_ROW.title,
      'AUTHENTICATED',
      0.99,
    );
  });

  it('uses fallback itemTitle when listing row is not found', async () => {
    const payload = JSON.stringify({ id: 'ref-notitle', status: 'fake', confidence: 0.9 });
    mockParseWebhook.mockReturnValue({
      providerRef: 'ref-notitle',
      status: 'COUNTERFEIT',
      confidence: 0.9,
      resultJson: {},
      resultNotes: '',
    });

    // listing query returns empty → itemTitle falls back to 'your listing'
    mockDbSelect
      .mockReturnValueOnce(chainSelect([AI_PENDING_REQ]))
      .mockReturnValueOnce(chainSelect([]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { POST } = await import('../ai-webhook/route');
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(mockNotifyAuthResult).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      expect.any(String),
      'your listing',
      'COUNTERFEIT',
      0.9,
    );
  });

  it('does NOT call notifyAuthResult for unknown providerRef (idempotent early return)', async () => {
    const payload = JSON.stringify({ id: 'ref-unknown', status: 'authentic' });
    mockParseWebhook.mockReturnValue({
      providerRef: 'ref-unknown',
      status: 'AUTHENTICATED',
      confidence: 0.99,
      resultJson: {},
      resultNotes: '',
    });
    mockDbSelect.mockReturnValueOnce(chainSelect([]));

    const { POST } = await import('../ai-webhook/route');
    await POST(makeRequest(payload));

    expect(mockNotifyAuthResult).not.toHaveBeenCalled();
  });

  it('does NOT call notifyAuthResult for already-completed request (idempotent)', async () => {
    const payload = JSON.stringify({ id: 'ref-done', status: 'authentic' });
    mockParseWebhook.mockReturnValue({
      providerRef: 'ref-done',
      status: 'AUTHENTICATED',
      confidence: 0.99,
      resultJson: {},
      resultNotes: '',
    });
    mockDbSelect.mockReturnValueOnce(
      chainSelect([{ ...AI_PENDING_REQ, status: 'AI_AUTHENTICATED' }]),
    );

    const { POST } = await import('../ai-webhook/route');
    await POST(makeRequest(payload));

    expect(mockNotifyAuthResult).not.toHaveBeenCalled();
  });
});
