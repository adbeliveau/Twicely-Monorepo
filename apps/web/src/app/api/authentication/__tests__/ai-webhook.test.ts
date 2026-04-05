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

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@/lib/authentication/ai-provider-factory', () => ({
  getAiAuthProvider: (...args: unknown[]) => mockGetAiAuthProvider(...args),
}));
vi.mock('@twicely/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/lib/authentication/auth-notifier', () => ({
  notifyAuthResult: vi.fn(),
}));

// ─── Chainable mock helpers ─────────────────────────────────────────────────

function chainSelect(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    then: vi.fn().mockResolvedValue(result),
  };
}

function chainUpdate() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
}

function chainInsert() {
  return { values: vi.fn().mockResolvedValue([]) };
}

function makeRequest(body: string, signature: string | null = 'valid-sig'): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signature !== null) headers['x-entrupy-signature'] = signature;
  return new NextRequest('http://localhost/api/authentication/ai-webhook', {
    method: 'POST',
    body,
    headers,
  });
}

const AI_PENDING_REQ = {
  id: 'auth-req-1',
  listingId: 'clst1xxxxxxxxxxxxxxxxxxx',
  sellerId: 'user-seller-1',
  buyerId: null,
  initiator: 'SELLER',
  tier: 'AI',
  status: 'AI_PENDING',
  totalFeeCents: 1999,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/authentication/ai-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifySignature.mockReturnValue(true);
  });

  it('returns 401 when signature header is missing', async () => {
    const { POST } = await import('../ai-webhook/route');
    const req = makeRequest('{"id":"ref-1","status":"authentic"}', null);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid signature', async () => {
    mockVerifySignature.mockReturnValue(false);
    const { POST } = await import('../ai-webhook/route');
    const req = makeRequest('{"id":"ref-1","status":"authentic"}');
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 for AUTHENTICATED result and updates request', async () => {
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
      .mockReturnValueOnce(chainSelect([{ title: 'Test Item' }]))
      .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), then: vi.fn().mockResolvedValue([{ verifyUrl: 'https://twicely.co/verify/TW-AUTH-AABBB' }]) });
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { POST } = await import('../ai-webhook/route');
    const req = makeRequest(payload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('returns 200 for COUNTERFEIT and sets listing REMOVED', async () => {
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
      .mockReturnValueOnce(chainSelect([{ title: 'Test Item' }]));
    const updateSpy = chainUpdate();
    mockDbUpdate.mockReturnValue(updateSpy);
    mockDbInsert.mockReturnValue(chainInsert());

    const { POST } = await import('../ai-webhook/route');
    const req = makeRequest(payload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(updateSpy.set).toHaveBeenCalledWith(
      expect.objectContaining({ enforcementState: 'REMOVED' })
    );
  });

  it('returns 200 for INCONCLUSIVE with 0/0 fees and listing not removed', async () => {
    const payload = JSON.stringify({ id: 'ref-inc', status: 'inconclusive', confidence: 0.3 });
    mockParseWebhook.mockReturnValue({
      providerRef: 'ref-inc',
      status: 'INCONCLUSIVE',
      confidence: 0.3,
      resultJson: {},
      resultNotes: '',
    });
    mockDbSelect
      .mockReturnValueOnce(chainSelect([AI_PENDING_REQ]))
      .mockReturnValueOnce(chainSelect([{ title: 'Test Item' }]));
    const updateSpy = chainUpdate();
    mockDbUpdate.mockReturnValue(updateSpy);
    mockDbInsert.mockReturnValue(chainInsert());

    const { POST } = await import('../ai-webhook/route');
    const req = makeRequest(payload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(updateSpy.set).toHaveBeenCalledWith(
      expect.objectContaining({ buyerFeeCents: 0, sellerFeeCents: 0 })
    );
  });

  it('returns 200 for unknown providerRef (idempotent)', async () => {
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
    const req = makeRequest(payload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('returns 200 for already-completed request (idempotent)', async () => {
    const payload = JSON.stringify({ id: 'ref-done', status: 'authentic' });
    mockParseWebhook.mockReturnValue({
      providerRef: 'ref-done',
      status: 'AUTHENTICATED',
      confidence: 0.99,
      resultJson: {},
      resultNotes: '',
    });
    mockDbSelect.mockReturnValueOnce(chainSelect([{ ...AI_PENDING_REQ, status: 'AI_AUTHENTICATED' }]));

    const { POST } = await import('../ai-webhook/route');
    const req = makeRequest(payload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('updates listing authenticationStatus on AUTHENTICATED', async () => {
    const payload = JSON.stringify({ id: 'ref-lst', status: 'authentic', confidence: 0.99 });
    mockParseWebhook.mockReturnValue({
      providerRef: 'ref-lst',
      status: 'AUTHENTICATED',
      confidence: 0.99,
      resultJson: {},
      resultNotes: '',
    });
    mockDbSelect
      .mockReturnValueOnce(chainSelect([AI_PENDING_REQ]))
      .mockReturnValueOnce(chainSelect([{ title: 'Test Item' }]))
      .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), then: vi.fn().mockResolvedValue([{ verifyUrl: 'https://twicely.co/verify/TW-AUTH-AABBB' }]) });
    const updateSpy = chainUpdate();
    mockDbUpdate.mockReturnValue(updateSpy);
    mockDbInsert.mockReturnValue(chainInsert());

    const { POST } = await import('../ai-webhook/route');
    const req = makeRequest(payload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    // Both auth request and listing updates called
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it('inserts HIGH audit event for COUNTERFEIT', async () => {
    const payload = JSON.stringify({ id: 'ref-cf', status: 'fake' });
    mockParseWebhook.mockReturnValue({
      providerRef: 'ref-cf',
      status: 'COUNTERFEIT',
      confidence: 0.95,
      resultJson: {},
      resultNotes: '',
    });
    mockDbSelect
      .mockReturnValueOnce(chainSelect([AI_PENDING_REQ]))
      .mockReturnValueOnce(chainSelect([{ title: 'Test Item' }]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const insertSpy = { values: vi.fn().mockResolvedValue([]) };
    mockDbInsert.mockReturnValue(insertSpy);

    const { POST } = await import('../ai-webhook/route');
    const req = makeRequest(payload);
    await POST(req);
    expect(insertSpy.values).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'COUNTERFEIT_DETECTED', severity: 'HIGH' })
    );
  });
});
