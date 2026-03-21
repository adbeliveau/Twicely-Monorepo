/**
 * Unit tests for Whatnot webhook HMAC-SHA256 signature verification.
 * Source: H2.3 install prompt §5 (Unit Tests — Webhook Signature Verification)
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
import { verifyWhatnotSignature } from '../whatnot-webhook-verify';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a valid HMAC-SHA256 hex signature for the given body and secret. */
function buildSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

/** Set up DB mock to return a given webhook secret value. */
function mockWebhookSecret(secret: string) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(secret ? [{ value: secret }] : []),
      }),
    }),
  } as never);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('verifyWhatnotSignature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { valid: true } for a correctly signed payload', async () => {
    const secret = 'wn-test-secret-abc123';
    const body = JSON.stringify({ eventId: 'evt-1', eventType: 'order.completed' });
    const signature = buildSignature(body, secret);

    mockWebhookSecret(secret);

    const result = await verifyWhatnotSignature(body, signature);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns { valid: false } for an incorrectly signed payload', async () => {
    const secret = 'wn-test-secret-abc123';
    const body = JSON.stringify({ eventId: 'evt-1', eventType: 'order.completed' });
    // Build a valid-length but wrong signature (use different secret)
    const wrongSignature = buildSignature(body, 'completely-wrong-secret!');

    mockWebhookSecret(secret);

    const result = await verifyWhatnotSignature(body, wrongSignature);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  it('returns { valid: false } when webhook secret is empty', async () => {
    mockWebhookSecret('');

    const result = await verifyWhatnotSignature('{"eventId":"evt-1"}', 'any-signature');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Webhook secret not configured');
  });

  it('returns { valid: false } when webhook secret is not configured (no DB row)', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never);

    const result = await verifyWhatnotSignature('{"eventId":"evt-1"}', 'any-signature');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Webhook secret not configured');
  });

  it('returns { valid: false } when signature header is empty string', async () => {
    mockWebhookSecret('wn-test-secret-abc123');

    const result = await verifyWhatnotSignature('{"eventId":"evt-1"}', '');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  it('returns { valid: false } when signature lengths differ (timing-safe path)', async () => {
    const secret = 'wn-test-secret-abc123';
    const body = JSON.stringify({ eventId: 'evt-1' });

    mockWebhookSecret(secret);

    // A signature shorter than the expected 64-char hex HMAC
    const shortSignature = 'abc123';

    const result = await verifyWhatnotSignature(body, shortSignature);
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

    const result = await verifyWhatnotSignature('body', 'signature');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Failed to load webhook secret');
  });

  it('returns { valid: false } when DB row has value: null (secret not set)', async () => {
    // The code checks `row.value !== null` — a row present but with null value
    // is treated the same as no secret configured.
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ value: null }]),
        }),
      }),
    } as never);

    const result = await verifyWhatnotSignature('{"eventId":"evt-1"}', 'any-signature');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Webhook secret not configured');
  });
});
