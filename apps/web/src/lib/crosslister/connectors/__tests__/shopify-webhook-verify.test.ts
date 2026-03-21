/**
 * Unit tests for Shopify webhook HMAC-SHA256 signature verification.
 * Source: H3.4 install prompt §5 (Unit Tests — Webhook Signature Verification)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  platformSetting: { key: 'key', value: 'value' },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ col: _col, val: _val })),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { db } from '@twicely/db';
import { verifyShopifyWebhookSignature } from '../shopify-webhook-verify';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a valid HMAC-SHA256 Base64 signature for the given body and secret. */
function buildSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
}

/** Set up DB mock to return a given client secret value. */
function mockClientSecret(secret: string) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(secret ? [{ value: secret }] : []),
      }),
    }),
  } as never);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('verifyShopifyWebhookSignature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { valid: true } for a correctly signed payload (Base64 encoding)', async () => {
    const secret = 'shopify-test-secret-abc123';
    const body = JSON.stringify({ id: 12345, title: 'Test Product', status: 'active' });
    const signature = buildSignature(body, secret);

    mockClientSecret(secret);

    const result = await verifyShopifyWebhookSignature(body, signature);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns { valid: false } for an incorrectly signed payload', async () => {
    const secret = 'shopify-test-secret-abc123';
    const body = JSON.stringify({ id: 12345, title: 'Test Product' });
    // Build a valid-length but wrong signature using different secret
    const wrongSignature = buildSignature(body, 'completely-wrong-secret!');

    mockClientSecret(secret);

    const result = await verifyShopifyWebhookSignature(body, wrongSignature);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  it('returns { valid: false } when signature header is empty string', async () => {
    mockClientSecret('shopify-test-secret-abc123');

    const result = await verifyShopifyWebhookSignature('{"id":12345}', '');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  it('returns { valid: false } when webhook secret is not configured (no DB row)', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never);

    const result = await verifyShopifyWebhookSignature('{"id":12345}', 'any-signature');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Webhook secret not configured');
  });

  it('returns { valid: false } when secret is empty string', async () => {
    mockClientSecret('');

    const result = await verifyShopifyWebhookSignature('{"id":12345}', 'any-signature');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Webhook secret not configured');
  });

  it('returns { valid: false } when signature lengths differ (timing-safe path)', async () => {
    const secret = 'shopify-test-secret-abc123';
    const body = JSON.stringify({ id: 12345 });

    mockClientSecret(secret);

    // A very short signature — will not match Base64-encoded HMAC length
    const shortSignature = 'abc123';

    const result = await verifyShopifyWebhookSignature(body, shortSignature);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  it('returns { valid: false } when DB throws an error', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('DB connection failed')),
        }),
      }),
    } as never);

    const result = await verifyShopifyWebhookSignature('body', 'signature');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Failed to load webhook secret');
  });

  it('correctly uses Base64 encoding (NOT hex)', async () => {
    const secret = 'shopify-test-secret-abc123';
    const body = JSON.stringify({ id: 12345 });

    // Hex-encoded signature should NOT be valid for Shopify
    const hexSignature = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    mockClientSecret(secret);

    const result = await verifyShopifyWebhookSignature(body, hexSignature);
    // Hex and Base64 produce different lengths so it should fail
    expect(result.valid).toBe(false);
  });
});
