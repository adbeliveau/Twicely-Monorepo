import { describe, it, expect } from 'vitest';
import {
  confirmReceiptOnlineSchema,
  confirmReceiptManualSchema,
  confirmOfflineDualSchema,
  confirmOfflineDualCodeSchema,
  initiatePriceAdjustmentSchema,
  respondToAdjustmentSchema,
} from '../local';

// ─── confirmReceiptOnlineSchema ──────────────────────────────────────────────

describe('confirmReceiptOnlineSchema', () => {
  it('accepts valid input', () => {
    const result = confirmReceiptOnlineSchema.safeParse({
      localTransactionId: 'lt-abc',
      sellerToken: 'sellertoken.sig',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing sellerToken', () => {
    const result = confirmReceiptOnlineSchema.safeParse({
      localTransactionId: 'lt-abc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = confirmReceiptOnlineSchema.safeParse({
      localTransactionId: 'lt-abc',
      sellerToken: 'token',
      extra: 'bad',
    });
    expect(result.success).toBe(false);
  });
});

// ─── confirmReceiptManualSchema ───────────────────────────────────────────────

describe('confirmReceiptManualSchema', () => {
  it('accepts valid 6-digit code', () => {
    const result = confirmReceiptManualSchema.safeParse({
      localTransactionId: 'lt-abc',
      sellerOfflineCode: '123456',
    });
    expect(result.success).toBe(true);
  });

  it('rejects 5-digit code', () => {
    const result = confirmReceiptManualSchema.safeParse({
      localTransactionId: 'lt-abc',
      sellerOfflineCode: '12345',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric code', () => {
    const result = confirmReceiptManualSchema.safeParse({
      localTransactionId: 'lt-abc',
      sellerOfflineCode: 'abcdef',
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = confirmReceiptManualSchema.safeParse({
      localTransactionId: 'lt-abc',
      sellerOfflineCode: '123456',
      extra: 'bad',
    });
    expect(result.success).toBe(false);
  });
});

// ─── confirmOfflineDualSchema ─────────────────────────────────────────────────

describe('confirmOfflineDualSchema', () => {
  it('accepts valid dual-token input', () => {
    const result = confirmOfflineDualSchema.safeParse({
      localTransactionId: 'lt-abc',
      sellerToken: 'seller.token',
      buyerToken: 'buyer.token',
      offlineTimestamp: '2026-03-10T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing buyerToken', () => {
    const result = confirmOfflineDualSchema.safeParse({
      localTransactionId: 'lt-abc',
      sellerToken: 'seller.token',
      offlineTimestamp: '2026-03-10T12:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid ISO timestamp', () => {
    const result = confirmOfflineDualSchema.safeParse({
      localTransactionId: 'lt-abc',
      sellerToken: 'seller.token',
      buyerToken: 'buyer.token',
      offlineTimestamp: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = confirmOfflineDualSchema.safeParse({
      localTransactionId: 'lt-abc',
      sellerToken: 'seller.token',
      buyerToken: 'buyer.token',
      offlineTimestamp: '2026-03-10T12:00:00.000Z',
      extra: 'bad',
    });
    expect(result.success).toBe(false);
  });
});

// ─── confirmOfflineDualCodeSchema ─────────────────────────────────────────────

describe('confirmOfflineDualCodeSchema', () => {
  it('accepts valid dual-code input', () => {
    const result = confirmOfflineDualCodeSchema.safeParse({
      localTransactionId: 'lt-abc',
      sellerOfflineCode: '123456',
      buyerOfflineCode: '654321',
      offlineTimestamp: '2026-03-10T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid buyer code format', () => {
    const result = confirmOfflineDualCodeSchema.safeParse({
      localTransactionId: 'lt-abc',
      sellerOfflineCode: '123456',
      buyerOfflineCode: '65432x', // not all digits
      offlineTimestamp: '2026-03-10T12:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = confirmOfflineDualCodeSchema.safeParse({
      localTransactionId: 'lt-abc',
      sellerOfflineCode: '123456',
      buyerOfflineCode: '654321',
      offlineTimestamp: '2026-03-10T12:00:00.000Z',
      extra: 'bad',
    });
    expect(result.success).toBe(false);
  });
});

// ─── initiatePriceAdjustmentSchema ───────────────────────────────────────────

describe('initiatePriceAdjustmentSchema', () => {
  it('accepts valid input', () => {
    const result = initiatePriceAdjustmentSchema.safeParse({
      localTransactionId: 'lt-abc123',
      adjustedPriceCents: 7000,
      adjustmentReason: 'Scuff on the heel',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing localTransactionId', () => {
    const result = initiatePriceAdjustmentSchema.safeParse({
      adjustedPriceCents: 7000,
      adjustmentReason: 'reason',
    });
    expect(result.success).toBe(false);
  });

  it('rejects adjustedPriceCents of 0', () => {
    const result = initiatePriceAdjustmentSchema.safeParse({
      localTransactionId: 'lt-1',
      adjustedPriceCents: 0,
      adjustmentReason: 'reason',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty adjustmentReason', () => {
    const result = initiatePriceAdjustmentSchema.safeParse({
      localTransactionId: 'lt-1',
      adjustedPriceCents: 7000,
      adjustmentReason: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects adjustmentReason longer than 500 chars', () => {
    const result = initiatePriceAdjustmentSchema.safeParse({
      localTransactionId: 'lt-1',
      adjustedPriceCents: 7000,
      adjustmentReason: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = initiatePriceAdjustmentSchema.safeParse({
      localTransactionId: 'lt-1',
      adjustedPriceCents: 7000,
      adjustmentReason: 'reason',
      extraField: 'should-fail',
    });
    expect(result.success).toBe(false);
  });
});

// ─── respondToAdjustmentSchema ────────────────────────────────────────────────

describe('respondToAdjustmentSchema', () => {
  it('accepts valid accept:true', () => {
    const result = respondToAdjustmentSchema.safeParse({
      localTransactionId: 'lt-abc123',
      accept: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid accept:false', () => {
    const result = respondToAdjustmentSchema.safeParse({
      localTransactionId: 'lt-abc123',
      accept: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing accept field', () => {
    const result = respondToAdjustmentSchema.safeParse({
      localTransactionId: 'lt-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = respondToAdjustmentSchema.safeParse({
      localTransactionId: 'lt-1',
      accept: true,
      extra: 'bad',
    });
    expect(result.success).toBe(false);
  });
});
