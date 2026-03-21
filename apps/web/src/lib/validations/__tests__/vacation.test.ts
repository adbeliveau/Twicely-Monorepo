import { describe, it, expect } from 'vitest';
import {
  activateVacationSchema,
  deactivateVacationSchema,
  adminForceDeactivateVacationSchema,
} from '../vacation';

// ─── activateVacationSchema ───────────────────────────────────────────────────

const FUTURE_DATE = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
const VALID_CUID2 = 'oxnrqr2mip27990tjv282psp';

describe('activateVacationSchema', () => {
  const minimal = { modeType: 'PAUSE_SALES', endAt: FUTURE_DATE };

  it('accepts minimal valid PAUSE_SALES input', () => {
    const result = activateVacationSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('accepts valid ALLOW_SALES input', () => {
    const result = activateVacationSchema.safeParse({ modeType: 'ALLOW_SALES', endAt: FUTURE_DATE });
    expect(result.success).toBe(true);
  });

  it('accepts valid CUSTOM input', () => {
    const result = activateVacationSchema.safeParse({ modeType: 'CUSTOM', endAt: FUTURE_DATE });
    expect(result.success).toBe(true);
  });

  it('accepts optional vacationMessage within 500 chars', () => {
    const result = activateVacationSchema.safeParse({
      ...minimal,
      vacationMessage: 'Out of office until further notice.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional autoReplyMessage within 500 chars', () => {
    const result = activateVacationSchema.safeParse({
      ...minimal,
      autoReplyMessage: 'Thanks, I will reply when I return!',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional startAt as a valid datetime string', () => {
    const startAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
    const result = activateVacationSchema.safeParse({ ...minimal, startAt });
    expect(result.success).toBe(true);
  });

  it('rejects invalid modeType enum value', () => {
    const result = activateVacationSchema.safeParse({ modeType: 'UNKNOWN', endAt: FUTURE_DATE });
    expect(result.success).toBe(false);
  });

  it('rejects missing endAt', () => {
    const result = activateVacationSchema.safeParse({ modeType: 'PAUSE_SALES' });
    expect(result.success).toBe(false);
  });

  it('rejects endAt that is not a valid datetime string', () => {
    const result = activateVacationSchema.safeParse({ modeType: 'PAUSE_SALES', endAt: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('rejects vacationMessage exceeding 500 characters', () => {
    const result = activateVacationSchema.safeParse({
      ...minimal,
      vacationMessage: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('rejects autoReplyMessage exceeding 500 characters', () => {
    const result = activateVacationSchema.safeParse({
      ...minimal,
      autoReplyMessage: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown extra fields (strict mode)', () => {
    const result = activateVacationSchema.safeParse({ ...minimal, unknownField: 'value' });
    expect(result.success).toBe(false);
  });

  it('accepts vacationMessage exactly at 500 characters', () => {
    const result = activateVacationSchema.safeParse({
      ...minimal,
      vacationMessage: 'x'.repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it('accepts autoReplyMessage exactly at 500 characters', () => {
    const result = activateVacationSchema.safeParse({
      ...minimal,
      autoReplyMessage: 'x'.repeat(500),
    });
    expect(result.success).toBe(true);
  });
});

// ─── deactivateVacationSchema ─────────────────────────────────────────────────

describe('deactivateVacationSchema', () => {
  it('accepts empty object', () => {
    const result = deactivateVacationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = deactivateVacationSchema.safeParse({ reason: 'done' });
    expect(result.success).toBe(false);
  });
});

// ─── adminForceDeactivateVacationSchema ───────────────────────────────────────

describe('adminForceDeactivateVacationSchema', () => {
  const valid = { sellerId: VALID_CUID2, reason: 'Policy violation' };

  it('accepts valid sellerId and reason', () => {
    const result = adminForceDeactivateVacationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects non-CUID2 sellerId', () => {
    const result = adminForceDeactivateVacationSchema.safeParse({ ...valid, sellerId: 'not-a-cuid2' });
    expect(result.success).toBe(false);
  });

  it('rejects empty sellerId', () => {
    const result = adminForceDeactivateVacationSchema.safeParse({ ...valid, sellerId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty reason (min 1 char)', () => {
    const result = adminForceDeactivateVacationSchema.safeParse({ ...valid, reason: '' });
    expect(result.success).toBe(false);
  });

  it('rejects reason exceeding 500 characters', () => {
    const result = adminForceDeactivateVacationSchema.safeParse({ ...valid, reason: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('accepts reason exactly at 500 characters', () => {
    const result = adminForceDeactivateVacationSchema.safeParse({ ...valid, reason: 'x'.repeat(500) });
    expect(result.success).toBe(true);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = adminForceDeactivateVacationSchema.safeParse({ ...valid, extra: 'field' });
    expect(result.success).toBe(false);
  });

  it('rejects missing sellerId', () => {
    const result = adminForceDeactivateVacationSchema.safeParse({ reason: 'Policy violation' });
    expect(result.success).toBe(false);
  });

  it('rejects missing reason', () => {
    const result = adminForceDeactivateVacationSchema.safeParse({ sellerId: VALID_CUID2 });
    expect(result.success).toBe(false);
  });
});
