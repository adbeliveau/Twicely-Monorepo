import { describe, it, expect } from 'vitest';
import {
  WhatnotListingSchema,
  WhatnotTokenResponseSchema,
  WhatnotWebhookEnvelopeSchema,
  WhatnotOrderCompletedDataSchema,
} from '../whatnot-schemas';

describe('WhatnotListingSchema', () => {
  it('validates valid listing data', () => {
    const validListing = {
      id: 'listing-abc',
      title: 'Rare Trading Card',
      description: 'Mint condition',
      price: { amount: '25.00', currencyCode: 'USD' },
      status: 'PUBLISHED',
      media: [{ url: 'https://cdn.whatnot.com/img.jpg', type: 'IMAGE' }],
      product: null,
      createdAt: '2024-06-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
    };

    const result = WhatnotListingSchema.safeParse(validListing);
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const invalidListing = {
      title: 'Listing without id',
      price: { amount: '10.00', currencyCode: 'USD' },
      status: 'PUBLISHED',
    };

    const result = WhatnotListingSchema.safeParse(invalidListing);
    expect(result.success).toBe(false);
  });
});

describe('WhatnotTokenResponseSchema', () => {
  it('validates token response', () => {
    const validToken = {
      access_token: 'wn_access_tk_abc123',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'refresh-abc123',
      scope: 'read:inventory write:inventory read:orders',
    };

    const result = WhatnotTokenResponseSchema.safeParse(validToken);
    expect(result.success).toBe(true);
  });
});

describe('WhatnotWebhookEnvelopeSchema', () => {
  const validEnvelope = {
    eventId: 'evt-001',
    eventType: 'order.completed',
    createdAt: '2025-01-15T12:00:00Z',
    data: { orderId: 'wn-order-123' },
  };

  it('accepts a valid webhook envelope', () => {
    const result = WhatnotWebhookEnvelopeSchema.safeParse(validEnvelope);
    expect(result.success).toBe(true);
  });

  it('rejects envelope with missing eventId', () => {
    const { eventId: _omit, ...withoutEventId } = validEnvelope;
    const result = WhatnotWebhookEnvelopeSchema.safeParse(withoutEventId);
    expect(result.success).toBe(false);
  });

  it('rejects envelope with empty eventId', () => {
    const result = WhatnotWebhookEnvelopeSchema.safeParse({ ...validEnvelope, eventId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects envelope with extra unknown keys (strict mode)', () => {
    const result = WhatnotWebhookEnvelopeSchema.safeParse({
      ...validEnvelope,
      unknownField: 'should-be-rejected',
    });
    expect(result.success).toBe(false);
  });
});

describe('WhatnotOrderCompletedDataSchema', () => {
  const validData = {
    orderId: 'wn-order-123',
    listingId: 'wn-listing-456',
    price: { amount: '49.99', currencyCode: 'USD' },
    buyer: { id: 'buyer-001', username: 'test_buyer' },
    completedAt: '2025-01-15T11:55:00Z',
  };

  it('accepts valid order.completed data', () => {
    const result = WhatnotOrderCompletedDataSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects data with missing price.amount', () => {
    const bad = { ...validData, price: { currencyCode: 'USD' } };
    const result = WhatnotOrderCompletedDataSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects data with non-3-char currencyCode', () => {
    const bad = { ...validData, price: { amount: '49.99', currencyCode: 'USDD' } };
    const result = WhatnotOrderCompletedDataSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects data with missing orderId', () => {
    const { orderId: _omit, ...withoutOrderId } = validData;
    const result = WhatnotOrderCompletedDataSchema.safeParse(withoutOrderId);
    expect(result.success).toBe(false);
  });

  it('rejects data with extra unknown keys in buyer (strict mode)', () => {
    const bad = {
      ...validData,
      buyer: { id: 'buyer-001', username: 'test_buyer', extraField: 'oops' },
    };
    const result = WhatnotOrderCompletedDataSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects data with extra unknown keys at top level (strict mode)', () => {
    const bad = { ...validData, internalNote: 'should not be here' };
    const result = WhatnotOrderCompletedDataSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects data with empty listingId (min(1))', () => {
    const bad = { ...validData, listingId: '' };
    const result = WhatnotOrderCompletedDataSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects data with empty buyer.username (min(1))', () => {
    const bad = { ...validData, buyer: { id: 'buyer-001', username: '' } };
    const result = WhatnotOrderCompletedDataSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects data with missing buyer.id', () => {
    const bad = { ...validData, buyer: { username: 'test_buyer' } };
    const result = WhatnotOrderCompletedDataSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('WhatnotWebhookEnvelopeSchema — additional field validation', () => {
  const validEnvelope = {
    eventId: 'evt-001',
    eventType: 'order.completed',
    createdAt: '2025-01-15T12:00:00Z',
    data: { orderId: 'wn-order-123' },
  };

  it('rejects envelope with missing eventType', () => {
    const { eventType: _omit, ...withoutEventType } = validEnvelope;
    const result = WhatnotWebhookEnvelopeSchema.safeParse(withoutEventType);
    expect(result.success).toBe(false);
  });

  it('rejects envelope with empty eventType (min(1))', () => {
    const result = WhatnotWebhookEnvelopeSchema.safeParse({ ...validEnvelope, eventType: '' });
    expect(result.success).toBe(false);
  });

  it('rejects envelope with empty createdAt (min(1))', () => {
    const result = WhatnotWebhookEnvelopeSchema.safeParse({ ...validEnvelope, createdAt: '' });
    expect(result.success).toBe(false);
  });
});
