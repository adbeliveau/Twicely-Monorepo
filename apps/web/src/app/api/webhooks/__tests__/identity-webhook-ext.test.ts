import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Extended identity webhook route tests.
 * Covers: handler error path (must return 200 to prevent Stripe retry storms),
 * and handler called with full event object.
 */

const mockHandleVerificationWebhook = vi.fn();
vi.mock('@twicely/stripe/identity-service', () => ({
  handleVerificationWebhook: mockHandleVerificationWebhook,
}));

const mockStripe = {
  webhooks: {
    constructEvent: vi.fn(),
  },
};
vi.mock('@twicely/stripe/server', () => ({
  stripe: mockStripe,
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { NextRequest } from 'next/server';

function makeRequest(body: string, sig: string | null): NextRequest {
  const headers = new Headers();
  if (sig) headers.set('stripe-signature', sig);
  return new NextRequest('http://localhost/api/webhooks/identity', {
    method: 'POST',
    body,
    headers,
  });
}

// ─── Error path — handler throws but route returns 200 ────────────────────────

describe('Identity webhook route — handler error path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = 'whsec_test_ext';
  });

  it('returns 200 even when handleVerificationWebhook throws (prevents retry storm)', async () => {
    const event = {
      type: 'identity.verification_session.verified',
      data: { object: { id: 'vs_err_1' } },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(event);
    mockHandleVerificationWebhook.mockRejectedValue(new Error('DB connection failed'));

    const { POST } = await import('../identity/route');
    const req = makeRequest('{}', 't=1,v1=sig');
    const res = await POST(req);

    // CRITICAL: Must return 200 even on handler error to prevent Stripe retrying
    expect(res.status).toBe(200);
  });

  it('logs error when handler throws', async () => {
    const event = {
      type: 'identity.verification_session.requires_input',
      data: { object: { id: 'vs_err_2', last_error: { code: 'selfie_face_mismatch' } } },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(event);
    mockHandleVerificationWebhook.mockRejectedValue(new Error('Timeout'));

    const { logger } = await import('@/lib/logger');
    const { POST } = await import('../identity/route');
    const req = makeRequest('{}', 't=1,v1=sig2');
    await POST(req);

    expect(logger.error).toHaveBeenCalled();
  });
});

// ─── Event handling — passes full event object ────────────────────────────────

describe('Identity webhook route — event forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = 'whsec_test_ext2';
  });

  it('passes the full event object (not just id) to handleVerificationWebhook', async () => {
    const event = {
      type: 'identity.verification_session.verified',
      id: 'evt_full_test',
      data: { object: { id: 'vs_full', last_verification_report: 'vr_full' } },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(event);
    mockHandleVerificationWebhook.mockResolvedValue(undefined);

    const { POST } = await import('../identity/route');
    const req = makeRequest('full_body', 't=99,v1=abc');
    await POST(req);

    expect(mockHandleVerificationWebhook).toHaveBeenCalledWith(event);
  });

  it('returns received:true in body on successful handler call', async () => {
    const event = {
      type: 'identity.verification_session.canceled',
      data: { object: { id: 'vs_ok' } },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(event);
    mockHandleVerificationWebhook.mockResolvedValue(undefined);

    const { POST } = await import('../identity/route');
    const req = makeRequest('{}', 't=1,v1=ok');
    const res = await POST(req);
    const body = await res.json() as Record<string, unknown>;
    expect(body.received).toBe(true);
    expect(body.skipped).toBeUndefined();
  });

  it('returns received:true and skipped:true for unhandled event type', async () => {
    const event = { type: 'charge.succeeded', data: { object: {} } };
    mockStripe.webhooks.constructEvent.mockReturnValue(event);

    const { POST } = await import('../identity/route');
    const req = makeRequest('{}', 't=1,v1=skip');
    const res = await POST(req);
    const body = await res.json() as Record<string, unknown>;
    expect(body.received).toBe(true);
    expect(body.skipped).toBe(true);
    expect(mockHandleVerificationWebhook).not.toHaveBeenCalled();
  });
});

// ─── data-export rate limit — PROCESSING status ───────────────────────────────
// Note: the base data-export.test.ts covers PENDING but not PROCESSING.
// The implementation treats PENDING and PROCESSING the same → "already in progress".
// This is tested in a separate describe to avoid setup bleed from webhook mocks.
