import { describe, it, expect } from 'vitest';
import {
  sendDayOfConfirmationSchema,
  respondToDayOfConfirmationSchema,
} from '../local';

describe('sendDayOfConfirmationSchema', () => {
  it('accepts valid input', () => {
    const result = sendDayOfConfirmationSchema.safeParse({
      localTransactionId: 'lt-abc123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty localTransactionId', () => {
    const result = sendDayOfConfirmationSchema.safeParse({
      localTransactionId: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys (strict mode)', () => {
    const result = sendDayOfConfirmationSchema.safeParse({
      localTransactionId: 'lt-abc123',
      extraField: 'bad',
    });
    expect(result.success).toBe(false);
  });
});

describe('respondToDayOfConfirmationSchema', () => {
  it('accepts valid input', () => {
    const result = respondToDayOfConfirmationSchema.safeParse({
      localTransactionId: 'lt-abc123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty localTransactionId', () => {
    const result = respondToDayOfConfirmationSchema.safeParse({
      localTransactionId: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys (strict mode)', () => {
    const result = respondToDayOfConfirmationSchema.safeParse({
      localTransactionId: 'lt-abc123',
      anotherField: 'bad',
    });
    expect(result.success).toBe(false);
  });
});
