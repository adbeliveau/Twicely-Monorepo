/**
 * Unit tests for POST /api/crosslister/whatnot/webhook
 * Source: H2.3 install prompt §5 (Unit Tests — API Route)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockVerifyWhatnotSignature = vi.fn();
vi.mock('@twicely/crosslister/connectors/whatnot-webhook-verify', () => ({
  verifyWhatnotSignature: mockVerifyWhatnotSignature,
  WHATNOT_SIGNATURE_HEADER: 'X-Whatnot-Signature',
}));

const mockHandleWhatnotSaleWebhook = vi.fn();
vi.mock('@twicely/crosslister/handlers/sale-webhook-handler', () => ({
  handleWhatnotSaleWebhook: mockHandleWhatnotSaleWebhook,
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

function makeValidEnvelope(): Record<string, unknown> {
  return {
    eventId: 'evt-test-001',
    eventType: 'order.completed',
    createdAt: '2025-01-15T12:00:00Z',
    data: {
      orderId: 'wn-order-123',
      listingId: 'wn-listing-456',
      price: { amount: '49.99', currencyCode: 'USD' },
      buyer: { id: 'buyer-001', username: 'test_buyer' },
      completedAt: '2025-01-15T11:55:00Z',
    },
  };
}

function makeRequest(options: {
  body: string;
  signatureHeader?: string | null;
}): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.signatureHeader !== null && options.signatureHeader !== undefined) {
    headers.set('X-Whatnot-Signature', options.signatureHeader);
  }
  return new Request('http://localhost/api/crosslister/whatnot/webhook', {
    method: 'POST',
    headers,
    body: options.body,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/crosslister/whatnot/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockVerifyWhatnotSignature.mockResolvedValue({ valid: true });
    mockHandleWhatnotSaleWebhook.mockResolvedValue(undefined);
  });

  it('returns 200 { received: true } for valid signature + valid body', async () => {
    const body = JSON.stringify(makeValidEnvelope());
    const sig = buildSignature(body, 'test-secret');

    const { POST } = await import('../route');
    const res = await POST(makeRequest({ body, signatureHeader: sig }) as never);
    const json = await res.json() as { received: boolean };

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
  });

  it('returns 400 when X-Whatnot-Signature header is missing', async () => {
    const body = JSON.stringify(makeValidEnvelope());

    const { POST } = await import('../route');
    const res = await POST(makeRequest({ body, signatureHeader: null }) as never);

    expect(res.status).toBe(400);
  });

  it('returns 400 when signature is invalid', async () => {
    mockVerifyWhatnotSignature.mockResolvedValue({ valid: false, error: 'Invalid signature' });

    const body = JSON.stringify(makeValidEnvelope());

    const { POST } = await import('../route');
    const res = await POST(makeRequest({ body, signatureHeader: 'wrong-sig' }) as never);

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('Invalid signature');
  });

  it('returns 400 when body is not valid JSON', async () => {
    const { POST } = await import('../route');
    const res = await POST(makeRequest({ body: 'not-json{{{', signatureHeader: 'some-sig' }) as never);

    expect(res.status).toBe(400);
  });

  it('returns 400 when envelope fails Zod validation (missing eventId)', async () => {
    const badEnvelope = { eventType: 'order.completed', createdAt: '2025-01-15T12:00:00Z', data: {} };
    const body = JSON.stringify(badEnvelope);

    const { POST } = await import('../route');
    const res = await POST(makeRequest({ body, signatureHeader: 'some-sig' }) as never);

    expect(res.status).toBe(400);
  });

  it('returns 200 for unhandled event type (e.g., listing.updated)', async () => {
    const body = JSON.stringify({
      eventId: 'evt-002',
      eventType: 'listing.updated',
      createdAt: '2025-01-15T12:00:00Z',
      data: {},
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest({ body, signatureHeader: 'some-sig' }) as never);
    const json = await res.json() as { received: boolean };

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockHandleWhatnotSaleWebhook).not.toHaveBeenCalled();
  });

  it('returns 200 even when handler throws (prevents retry storms)', async () => {
    mockHandleWhatnotSaleWebhook.mockRejectedValue(new Error('DB connection failed'));

    const body = JSON.stringify(makeValidEnvelope());

    const { POST } = await import('../route');
    const res = await POST(makeRequest({ body, signatureHeader: 'some-sig' }) as never);
    const json = await res.json() as { received: boolean };

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
  });

  it('calls handleWhatnotSaleWebhook for order.completed event type', async () => {
    const envelope = makeValidEnvelope();
    const body = JSON.stringify(envelope);

    const { POST } = await import('../route');
    await POST(makeRequest({ body, signatureHeader: 'some-sig' }) as never);

    expect(mockHandleWhatnotSaleWebhook).toHaveBeenCalledOnce();
    expect(mockHandleWhatnotSaleWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-test-001', eventType: 'order.completed' }),
    );
  });

  it('does NOT call handleWhatnotSaleWebhook when signature verification fails', async () => {
    // Verifies the auth gate prevents handler invocation — not just the status code.
    mockVerifyWhatnotSignature.mockResolvedValue({ valid: false, error: 'Invalid signature' });

    const body = JSON.stringify(makeValidEnvelope());

    const { POST } = await import('../route');
    await POST(makeRequest({ body, signatureHeader: 'bad-sig' }) as never);

    expect(mockHandleWhatnotSaleWebhook).not.toHaveBeenCalled();
  });
});
