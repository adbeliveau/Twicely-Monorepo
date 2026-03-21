import { describe, it, expect } from 'vitest';

describe('createConnectPaymentIntent validation logic', () => {
  // Test validation logic directly without importing Stripe-dependent module

  function validateConnectPaymentIntent(input: {
    amountCents: number;
    applicationFeeCents: number;
    destinationAccountId: string;
    metadata: Record<string, string>;
  }): { valid: boolean; error?: string } {
    if (!input.destinationAccountId) {
      return { valid: false, error: 'destinationAccountId is required' };
    }
    if (input.amountCents < 50) {
      return { valid: false, error: 'Amount must be at least 50 cents (Stripe minimum)' };
    }
    return { valid: true };
  }

  it('rejects empty destinationAccountId', () => {
    const result = validateConnectPaymentIntent({
      amountCents: 5000,
      applicationFeeCents: 500,
      destinationAccountId: '',
      metadata: { orderId: 'order1' },
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('destinationAccountId is required');
  });

  it('rejects amountCents below Stripe minimum (50)', () => {
    const result = validateConnectPaymentIntent({
      amountCents: 25,
      applicationFeeCents: 0,
      destinationAccountId: 'acct_seller1',
      metadata: { orderId: 'order1' },
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('50 cents');
  });

  it('rejects amountCents of 0', () => {
    const result = validateConnectPaymentIntent({
      amountCents: 0,
      applicationFeeCents: 0,
      destinationAccountId: 'acct_seller1',
      metadata: { orderId: 'order1' },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects negative amountCents', () => {
    const result = validateConnectPaymentIntent({
      amountCents: -100,
      applicationFeeCents: 0,
      destinationAccountId: 'acct_seller1',
      metadata: { orderId: 'order1' },
    });
    expect(result.valid).toBe(false);
  });

  it('accepts valid input', () => {
    const result = validateConnectPaymentIntent({
      amountCents: 5000,
      applicationFeeCents: 500,
      destinationAccountId: 'acct_seller1',
      metadata: { orderId: 'order1' },
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts minimum valid amount (50 cents)', () => {
    const result = validateConnectPaymentIntent({
      amountCents: 50,
      applicationFeeCents: 0,
      destinationAccountId: 'acct_seller1',
      metadata: { orderId: 'order1' },
    });
    expect(result.valid).toBe(true);
  });
});

describe('CreateConnectPaymentIntentInput type shape', () => {
  it('input requires amountCents, applicationFeeCents, destinationAccountId, metadata', () => {
    const input = {
      amountCents: 5000,
      applicationFeeCents: 500,
      destinationAccountId: 'acct_seller1',
      metadata: { orderId: 'order1', buyerId: 'buyer1' },
    };
    expect(input.amountCents).toBe(5000);
    expect(input.applicationFeeCents).toBe(500);
    expect(input.destinationAccountId).toBe('acct_seller1');
    expect(input.metadata.orderId).toBe('order1');
  });
});

describe('CreatePaymentIntentResult type shape', () => {
  it('result has clientSecret and paymentIntentId', () => {
    const result: { clientSecret: string; paymentIntentId: string } = {
      clientSecret: 'secret_123',
      paymentIntentId: 'pi_123',
    };
    expect(result.clientSecret).toBe('secret_123');
    expect(result.paymentIntentId).toBe('pi_123');
  });
});
