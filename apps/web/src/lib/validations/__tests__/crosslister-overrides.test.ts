/**
 * Tests for crosslister Zod validation schemas — overrides, cancel, automation.
 * All schemas use .strict() — unknown keys are always rejected.
 * Source: src/lib/validations/crosslister.ts, Lister Canonical Sections 9.2, 13
 */

import { describe, test, expect } from 'vitest';
import {
  updateProjectionOverridesSchema,
  cancelJobSchema,
  updateAutomationSettingsSchema,
} from '../crosslister';

// ─── updateProjectionOverridesSchema ─────────────────────────────────────────

describe('updateProjectionOverridesSchema', () => {
  test('accepts projectionId alone (all overrides optional)', () => {
    const result = updateProjectionOverridesSchema.safeParse({ projectionId: 'proj-001' });
    expect(result.success).toBe(true);
  });

  test('accepts all overrides set', () => {
    const result = updateProjectionOverridesSchema.safeParse({
      projectionId: 'proj-001',
      titleOverride: 'New title',
      descriptionOverride: 'New description',
      priceCentsOverride: 2500,
    });
    expect(result.success).toBe(true);
  });

  test('accepts null overrides (clearing a previous value)', () => {
    const result = updateProjectionOverridesSchema.safeParse({
      projectionId: 'proj-001',
      titleOverride: null,
      priceCentsOverride: null,
    });
    expect(result.success).toBe(true);
  });

  test('accepts title override at exactly 80 chars (boundary)', () => {
    const result = updateProjectionOverridesSchema.safeParse({
      projectionId: 'proj-001',
      titleOverride: 'A'.repeat(80),
    });
    expect(result.success).toBe(true);
  });

  test('rejects title override exceeding 80 chars', () => {
    const result = updateProjectionOverridesSchema.safeParse({
      projectionId: 'proj-001',
      titleOverride: 'A'.repeat(81),
    });
    expect(result.success).toBe(false);
  });

  test('rejects priceCentsOverride of 0 (must be min 1 — integer cents)', () => {
    const result = updateProjectionOverridesSchema.safeParse({
      projectionId: 'proj-001',
      priceCentsOverride: 0,
    });
    expect(result.success).toBe(false);
  });

  test('rejects negative priceCentsOverride', () => {
    const result = updateProjectionOverridesSchema.safeParse({
      projectionId: 'proj-001',
      priceCentsOverride: -100,
    });
    expect(result.success).toBe(false);
  });

  test('rejects non-integer priceCentsOverride (float)', () => {
    const result = updateProjectionOverridesSchema.safeParse({
      projectionId: 'proj-001',
      priceCentsOverride: 25.50,
    });
    expect(result.success).toBe(false);
  });

  test('rejects empty projectionId', () => {
    const result = updateProjectionOverridesSchema.safeParse({ projectionId: '' });
    expect(result.success).toBe(false);
  });

  test('rejects missing projectionId', () => {
    const result = updateProjectionOverridesSchema.safeParse({ titleOverride: 'hello' });
    expect(result.success).toBe(false);
  });

  test('rejects unknown keys (strict mode)', () => {
    const result = updateProjectionOverridesSchema.safeParse({
      projectionId: 'proj-001',
      channelId: 'ebay',
    });
    expect(result.success).toBe(false);
  });
});

// ─── cancelJobSchema ──────────────────────────────────────────────────────────

describe('cancelJobSchema', () => {
  test('accepts valid jobId', () => {
    const result = cancelJobSchema.safeParse({ jobId: 'job-test-001' });
    expect(result.success).toBe(true);
  });

  test('rejects empty jobId', () => {
    const result = cancelJobSchema.safeParse({ jobId: '' });
    expect(result.success).toBe(false);
  });

  test('rejects missing jobId', () => {
    const result = cancelJobSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test('rejects unknown keys (strict mode)', () => {
    const result = cancelJobSchema.safeParse({ jobId: 'job-001', reason: 'mistake' });
    expect(result.success).toBe(false);
  });
});

// ─── updateAutomationSettingsSchema ──────────────────────────────────────────

describe('updateAutomationSettingsSchema', () => {
  test('accepts empty object (all fields optional)', () => {
    const result = updateAutomationSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test('accepts all valid fields together', () => {
    const result = updateAutomationSettingsSchema.safeParse({
      autoRelistEnabled: true,
      autoRelistDays: 30,
      autoRelistChannels: ['EBAY'],
      offerToLikersEnabled: false,
      offerDiscountPercent: 10,
      offerMinDaysListed: 7,
      priceDropEnabled: true,
      priceDropPercent: 5,
      priceDropIntervalDays: 14,
      priceDropFloorPercent: 50,
      poshShareEnabled: true,
      poshShareTimesPerDay: 3,
    });
    expect(result.success).toBe(true);
  });

  test('rejects autoRelistDays below minimum of 7', () => {
    const result = updateAutomationSettingsSchema.safeParse({ autoRelistDays: 6 });
    expect(result.success).toBe(false);
  });

  test('rejects autoRelistDays above maximum of 90', () => {
    const result = updateAutomationSettingsSchema.safeParse({ autoRelistDays: 91 });
    expect(result.success).toBe(false);
  });

  test('accepts autoRelistDays at boundaries (7 and 90)', () => {
    expect(updateAutomationSettingsSchema.safeParse({ autoRelistDays: 7 }).success).toBe(true);
    expect(updateAutomationSettingsSchema.safeParse({ autoRelistDays: 90 }).success).toBe(true);
  });

  test('rejects offerDiscountPercent of 0 (min is 1)', () => {
    const result = updateAutomationSettingsSchema.safeParse({ offerDiscountPercent: 0 });
    expect(result.success).toBe(false);
  });

  test('rejects offerDiscountPercent above 50', () => {
    const result = updateAutomationSettingsSchema.safeParse({ offerDiscountPercent: 51 });
    expect(result.success).toBe(false);
  });

  test('rejects priceDropFloorPercent below minimum of 10', () => {
    const result = updateAutomationSettingsSchema.safeParse({ priceDropFloorPercent: 9 });
    expect(result.success).toBe(false);
  });

  test('rejects priceDropFloorPercent above maximum of 90', () => {
    const result = updateAutomationSettingsSchema.safeParse({ priceDropFloorPercent: 91 });
    expect(result.success).toBe(false);
  });

  test('rejects poshShareTimesPerDay of 0 (min is 1)', () => {
    const result = updateAutomationSettingsSchema.safeParse({ poshShareTimesPerDay: 0 });
    expect(result.success).toBe(false);
  });

  test('rejects poshShareTimesPerDay above 10', () => {
    const result = updateAutomationSettingsSchema.safeParse({ poshShareTimesPerDay: 11 });
    expect(result.success).toBe(false);
  });

  test('rejects non-integer for autoRelistDays', () => {
    const result = updateAutomationSettingsSchema.safeParse({ autoRelistDays: 14.5 });
    expect(result.success).toBe(false);
  });

  test('rejects unknown keys (strict mode)', () => {
    const result = updateAutomationSettingsSchema.safeParse({
      autoRelistEnabled: true,
      unknownField: 'val',
    });
    expect(result.success).toBe(false);
  });
});
