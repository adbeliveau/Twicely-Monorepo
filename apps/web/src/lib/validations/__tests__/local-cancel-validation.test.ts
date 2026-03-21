import { describe, it, expect } from 'vitest';
import { cancelLocalTransactionSchema } from '../local';

describe('cancelLocalTransactionSchema', () => {
  it('accepts valid input with localTransactionId', () => {
    const result = cancelLocalTransactionSchema.safeParse({ localTransactionId: 'lt-abc123' });
    expect(result.success).toBe(true);
  });

  it('accepts valid input with localTransactionId and reason', () => {
    const result = cancelLocalTransactionSchema.safeParse({
      localTransactionId: 'lt-abc123',
      reason: 'Schedule conflict',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty localTransactionId', () => {
    const result = cancelLocalTransactionSchema.safeParse({ localTransactionId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects reason longer than 500 chars', () => {
    const result = cancelLocalTransactionSchema.safeParse({
      localTransactionId: 'lt-abc123',
      reason: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys (strict mode)', () => {
    const result = cancelLocalTransactionSchema.safeParse({
      localTransactionId: 'lt-abc123',
      unknownField: 'value',
    });
    expect(result.success).toBe(false);
  });
});
