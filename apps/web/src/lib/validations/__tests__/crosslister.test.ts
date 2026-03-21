/**
 * Tests for crosslister Zod validation schemas — connect, disconnect, import, publish.
 * All schemas use .strict() — unknown keys are always rejected.
 * Source: src/lib/validations/crosslister.ts, Lister Canonical Section 9.2
 */

import { describe, test, expect } from 'vitest';
import {
  connectAccountSchema,
  disconnectAccountSchema,
  startImportSchema,
  publishListingsSchema,
} from '../crosslister';

// ─── connectAccountSchema ─────────────────────────────────────────────────────

describe('connectAccountSchema', () => {
  test('accepts valid OAUTH input', () => {
    const result = connectAccountSchema.safeParse({
      channel: 'EBAY',
      authMethod: 'OAUTH',
      code: 'auth-code-123',
      redirectUri: 'https://twicely.co/callback',
    });
    expect(result.success).toBe(true);
  });

  test('accepts valid SESSION input', () => {
    const result = connectAccountSchema.safeParse({
      channel: 'POSHMARK',
      authMethod: 'SESSION',
      username: 'myuser',
      password: 'mypass',
    });
    expect(result.success).toBe(true);
  });

  test('accepts valid API_KEY input', () => {
    const result = connectAccountSchema.safeParse({
      channel: 'MERCARI',
      authMethod: 'API_KEY',
      apiKey: 'key-abc',
      apiSecret: 'secret-xyz',
    });
    expect(result.success).toBe(true);
  });

  test('rejects missing channel', () => {
    const result = connectAccountSchema.safeParse({ authMethod: 'OAUTH' });
    expect(result.success).toBe(false);
  });

  test('rejects invalid channel value', () => {
    const result = connectAccountSchema.safeParse({
      channel: 'INVALID_PLATFORM',
      authMethod: 'OAUTH',
    });
    expect(result.success).toBe(false);
  });

  test('rejects missing authMethod', () => {
    const result = connectAccountSchema.safeParse({ channel: 'EBAY' });
    expect(result.success).toBe(false);
  });

  test('rejects unknown keys (strict mode)', () => {
    const result = connectAccountSchema.safeParse({
      channel: 'EBAY',
      authMethod: 'OAUTH',
      extraField: 'should-fail',
    });
    expect(result.success).toBe(false);
  });

  test('accepts all 8 valid channel values', () => {
    const channels = [
      'EBAY', 'POSHMARK', 'MERCARI', 'DEPOP',
      'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL',
    ];
    for (const channel of channels) {
      const result = connectAccountSchema.safeParse({ channel, authMethod: 'OAUTH' });
      expect(result.success).toBe(true);
    }
  });

  test('rejects invalid authMethod value', () => {
    const result = connectAccountSchema.safeParse({ channel: 'EBAY', authMethod: 'BASIC' });
    expect(result.success).toBe(false);
  });
});

// ─── disconnectAccountSchema ──────────────────────────────────────────────────

describe('disconnectAccountSchema', () => {
  test('accepts valid accountId', () => {
    const result = disconnectAccountSchema.safeParse({ accountId: 'acc-test-001' });
    expect(result.success).toBe(true);
  });

  test('rejects empty accountId', () => {
    const result = disconnectAccountSchema.safeParse({ accountId: '' });
    expect(result.success).toBe(false);
  });

  test('rejects missing accountId', () => {
    const result = disconnectAccountSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test('rejects unknown keys (strict mode)', () => {
    const result = disconnectAccountSchema.safeParse({
      accountId: 'acc-test-001',
      extra: 'bad',
    });
    expect(result.success).toBe(false);
  });
});

// ─── startImportSchema ────────────────────────────────────────────────────────

describe('startImportSchema', () => {
  test('accepts valid accountId', () => {
    const result = startImportSchema.safeParse({ accountId: 'acc-test-001' });
    expect(result.success).toBe(true);
  });

  test('rejects empty accountId', () => {
    const result = startImportSchema.safeParse({ accountId: '' });
    expect(result.success).toBe(false);
  });

  test('rejects missing accountId', () => {
    const result = startImportSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test('rejects unknown keys (strict mode)', () => {
    const result = startImportSchema.safeParse({ accountId: 'acc-test-001', foo: 'bar' });
    expect(result.success).toBe(false);
  });
});

// ─── publishListingsSchema ────────────────────────────────────────────────────

describe('publishListingsSchema', () => {
  test('accepts valid listingIds and channels', () => {
    const result = publishListingsSchema.safeParse({
      listingIds: ['listing-001', 'listing-002'],
      channels: ['EBAY', 'POSHMARK'],
    });
    expect(result.success).toBe(true);
  });

  test('rejects empty listingIds array', () => {
    const result = publishListingsSchema.safeParse({
      listingIds: [],
      channels: ['EBAY'],
    });
    expect(result.success).toBe(false);
  });

  test('rejects empty channels array', () => {
    const result = publishListingsSchema.safeParse({
      listingIds: ['listing-001'],
      channels: [],
    });
    expect(result.success).toBe(false);
  });

  test('rejects invalid channel in array', () => {
    const result = publishListingsSchema.safeParse({
      listingIds: ['listing-001'],
      channels: ['EBAY', 'AMAZON'],
    });
    expect(result.success).toBe(false);
  });

  test('rejects listingIds exceeding max of 500', () => {
    const ids = Array.from({ length: 501 }, (_, i) => `listing-${i}`);
    const result = publishListingsSchema.safeParse({ listingIds: ids, channels: ['EBAY'] });
    expect(result.success).toBe(false);
  });

  test('accepts listingIds at boundary of 500', () => {
    const ids = Array.from({ length: 500 }, (_, i) => `listing-${i}`);
    const result = publishListingsSchema.safeParse({ listingIds: ids, channels: ['EBAY'] });
    expect(result.success).toBe(true);
  });

  test('rejects unknown keys (strict mode)', () => {
    const result = publishListingsSchema.safeParse({
      listingIds: ['listing-001'],
      channels: ['EBAY'],
      dryRun: true,
    });
    expect(result.success).toBe(false);
  });
});
