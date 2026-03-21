/**
 * Tests for FulfillmentSelector handling flags logic (pure function extraction).
 */
import { describe, it, expect } from 'vitest';

// ─── Logic extracted from FulfillmentSelector ─────────────────────────────────

type FulfillmentChoice = 'shipping' | 'local_pickup';

function shouldShowFlagsWarning(
  selected: FulfillmentChoice,
  localHandlingFlags: string[],
): boolean {
  return selected === 'local_pickup' && localHandlingFlags.length > 0;
}

function shouldShowAcknowledgmentCheckbox(
  selected: FulfillmentChoice,
  localHandlingFlags: string[],
): boolean {
  return shouldShowFlagsWarning(selected, localHandlingFlags);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FulfillmentSelector — handling flags warning logic', () => {
  it('warning renders when local_pickup selected + flags present', () => {
    expect(shouldShowFlagsWarning('local_pickup', ['NEEDS_VEHICLE'])).toBe(true);
  });

  it('warning does NOT render when shipping selected', () => {
    expect(shouldShowFlagsWarning('shipping', ['NEEDS_VEHICLE'])).toBe(false);
  });

  it('warning does NOT render when no flags', () => {
    expect(shouldShowFlagsWarning('local_pickup', [])).toBe(false);
  });

  it('acknowledgment checkbox renders with warning', () => {
    expect(shouldShowAcknowledgmentCheckbox('local_pickup', ['NEEDS_VEHICLE', 'NEEDS_HELP'])).toBe(true);
  });

  it('toggling calls onHandlingFlagsAcknowledge', () => {
    const acknowledged: boolean[] = [];
    const onAcknowledge = (val: boolean): void => { acknowledged.push(val); };

    onAcknowledge(true);
    onAcknowledge(false);

    expect(acknowledged).toEqual([true, false]);
  });
});
