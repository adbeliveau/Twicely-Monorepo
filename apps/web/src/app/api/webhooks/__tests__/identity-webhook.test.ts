import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  const req = new NextRequest('http://localhost/api/webhooks/identity', {
    method: 'POST',
    body,
    headers,
  });
  return req;
}

// ─── POST /api/webhooks/identity ──────────────────────────────────────────────

describe('Identity webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 500 when STRIPE_IDENTITY_WEBHOOK_SECRET is not set', async () => {
    const savedEnv = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
    delete process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;

    const { POST } = await import('../identity/route');
    const req = makeRequest('{}', 't=1,v1=abc');
    const res = await POST(req);
    expect(res.status).toBe(500);

    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = savedEnv;
  });

  it('returns 400 when signature header is missing', async () => {
    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = 'whsec_test';

    const { POST } = await import('../identity/route');
    const req = makeRequest('{}', null);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid signature', async () => {
    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = 'whsec_test';
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('signature mismatch');
    });

    const { POST } = await import('../identity/route');
    const req = makeRequest('{}', 't=1,v1=bad');
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('calls handleVerificationWebhook for verified event', async () => {
    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = 'whsec_test';
    const event = {
      type: 'identity.verification_session.verified',
      data: { object: { id: 'vs_123' } },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(event);
    mockHandleVerificationWebhook.mockResolvedValue(undefined);

    const { POST } = await import('../identity/route');
    const req = makeRequest('{}', 't=1,v1=good');
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockHandleVerificationWebhook).toHaveBeenCalledWith(event);
  });

  it('calls handleVerificationWebhook for requires_input event', async () => {
    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = 'whsec_test';
    const event = {
      type: 'identity.verification_session.requires_input',
      data: { object: { id: 'vs_456', last_error: { code: 'document_expired' } } },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(event);
    mockHandleVerificationWebhook.mockResolvedValue(undefined);

    const { POST } = await import('../identity/route');
    const req = makeRequest('{}', 't=1,v1=good');
    await POST(req);
    expect(mockHandleVerificationWebhook).toHaveBeenCalledWith(event);
  });

  it('calls handleVerificationWebhook for canceled event', async () => {
    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = 'whsec_test';
    const event = {
      type: 'identity.verification_session.canceled',
      data: { object: { id: 'vs_789' } },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(event);
    mockHandleVerificationWebhook.mockResolvedValue(undefined);

    const { POST } = await import('../identity/route');
    const req = makeRequest('{}', 't=1,v1=good');
    await POST(req);
    expect(mockHandleVerificationWebhook).toHaveBeenCalledWith(event);
  });

  it('skips unhandled event types without calling handler', async () => {
    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = 'whsec_test';
    const event = { type: 'payment_intent.succeeded', data: { object: {} } };
    mockStripe.webhooks.constructEvent.mockReturnValue(event);

    const { POST } = await import('../identity/route');
    const req = makeRequest('{}', 't=1,v1=good');
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockHandleVerificationWebhook).not.toHaveBeenCalled();
  });
});
