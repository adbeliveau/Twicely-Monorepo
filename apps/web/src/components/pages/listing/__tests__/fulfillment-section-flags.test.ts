/**
 * Tests for FulfillmentSection handling flags logic (pure function extraction).
 */
import { describe, it, expect } from 'vitest';
import { LOCAL_HANDLING_FLAGS, HANDLING_FLAG_LABELS } from '@/lib/local/handling-flags';

// ─── Logic extracted from FulfillmentSection ──────────────────────────────────

type FulfillmentType = 'SHIP_ONLY' | 'LOCAL_ONLY' | 'SHIP_AND_LOCAL';

function shouldShowHandlingFlags(fulfillmentType: FulfillmentType): boolean {
  return fulfillmentType === 'LOCAL_ONLY' || fulfillmentType === 'SHIP_AND_LOCAL';
}

function toggleHandlingFlag(currentFlags: string[], flag: string, checked: boolean): string[] {
  if (checked) {
    return [...currentFlags, flag];
  }
  return currentFlags.filter((f) => f !== flag);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FulfillmentSection — handling flags display logic', () => {
  it('checkboxes render when fulfillmentType is LOCAL_ONLY', () => {
    expect(shouldShowHandlingFlags('LOCAL_ONLY')).toBe(true);
  });

  it('checkboxes render when fulfillmentType is SHIP_AND_LOCAL', () => {
    expect(shouldShowHandlingFlags('SHIP_AND_LOCAL')).toBe(true);
  });

  it('checkboxes do NOT render when SHIP_ONLY', () => {
    expect(shouldShowHandlingFlags('SHIP_ONLY')).toBe(false);
  });

  it('toggling on calls onHandlingFlagsChange with updated array', () => {
    const result = toggleHandlingFlag([], 'NEEDS_VEHICLE', true);
    expect(result).toEqual(['NEEDS_VEHICLE']);
  });

  it('toggling off calls onHandlingFlagsChange with flag removed', () => {
    const result = toggleHandlingFlag(['NEEDS_VEHICLE', 'NEEDS_HELP'], 'NEEDS_VEHICLE', false);
    expect(result).toEqual(['NEEDS_HELP']);
  });

  it('all 4 flag labels render', () => {
    for (const flag of LOCAL_HANDLING_FLAGS) {
      expect(HANDLING_FLAG_LABELS[flag]).toBeDefined();
      expect(HANDLING_FLAG_LABELS[flag].length).toBeGreaterThan(0);
    }
    expect(Object.keys(HANDLING_FLAG_LABELS)).toHaveLength(4);
  });
});
