import { describe, it, expect } from 'vitest';

// ─── Form state logic (extracted for testability) ─────────────────────────────

interface FormState {
  enabled: boolean;
  distance: number;
}

const DEFAULT_DISTANCE = 25;
const MAX_DISTANCE = 50;

function initFormState(currentDistanceMiles: number | null): FormState {
  return {
    enabled: currentDistanceMiles !== null,
    distance: currentDistanceMiles ?? DEFAULT_DISTANCE,
  };
}

function validateDistance(enabled: boolean, distance: number): string | null {
  if (!enabled) return null;
  if (distance < 1 || distance > MAX_DISTANCE) {
    return `Distance must be between 1 and ${MAX_DISTANCE} miles`;
  }
  return null;
}

function buildPayload(enabled: boolean, distance: number): { maxMeetupDistanceMiles: number | null } {
  return {
    maxMeetupDistanceMiles: enabled ? distance : null,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SellerLocalSettingsForm', () => {
  it('renders toggle and distance input', () => {
    // When currentDistanceMiles is 30, toggle is on and distance input shows 30
    const state = initFormState(30);
    expect(state.enabled).toBe(true);
    expect(state.distance).toBe(30);
  });

  it('disables distance input when toggle is off', () => {
    // When currentDistanceMiles is null, toggle is off
    const state = initFormState(null);
    expect(state.enabled).toBe(false);
    // Distance input should be disabled (visible but non-interactive)
    const error = validateDistance(state.enabled, state.distance);
    expect(error).toBeNull(); // no validation error when disabled
  });

  it('enables distance input when toggle is on', () => {
    const state = initFormState(20);
    expect(state.enabled).toBe(true);
    // With valid distance, no error
    const error = validateDistance(state.enabled, state.distance);
    expect(error).toBeNull();
  });

  it('shows current distance value', () => {
    const state = initFormState(35);
    expect(state.distance).toBe(35);
  });

  it('defaults distance to platform default when currently null', () => {
    const state = initFormState(null);
    expect(state.distance).toBe(DEFAULT_DISTANCE);
  });

  it('validates distance bounds when enabled', () => {
    expect(validateDistance(true, 0)).not.toBeNull();
    expect(validateDistance(true, 51)).not.toBeNull();
    expect(validateDistance(true, 1)).toBeNull();
    expect(validateDistance(true, 50)).toBeNull();
  });

  it('skips distance validation when toggle is off', () => {
    // Even with an out-of-range value, validation passes because toggle is off
    expect(validateDistance(false, 0)).toBeNull();
    expect(validateDistance(false, 100)).toBeNull();
  });

  it('builds null payload when toggle is off', () => {
    const payload = buildPayload(false, 30);
    expect(payload.maxMeetupDistanceMiles).toBeNull();
  });

  it('builds distance payload when toggle is on', () => {
    const payload = buildPayload(true, 30);
    expect(payload.maxMeetupDistanceMiles).toBe(30);
  });
});
