import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(5),
}));

import {
  getCircuitState,
  recordSuccess,
  recordFailure,
  canDispatch,
  getAllCircuitStatuses,
  resetCircuit,
  resetAllCircuits,
} from '../circuit-breaker';
import type { ExternalChannel } from '../../types';

const EBAY: ExternalChannel = 'EBAY';
const POSHMARK: ExternalChannel = 'POSHMARK';

describe('circuit-breaker', () => {
  beforeEach(() => {
    resetAllCircuits();
  });

  it('new channel starts CLOSED', () => {
    expect(getCircuitState(EBAY)).toBe('CLOSED');
  });

  it('canDispatch returns true when CLOSED', () => {
    expect(canDispatch(EBAY)).toBe(true);
  });

  it('canDispatch returns false when OPEN', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(EBAY, 5);
    }
    expect(canDispatch(EBAY)).toBe(false);
  });

  it('canDispatch returns true when HALF_OPEN (probe allowed)', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(EBAY, 5);
    }
    expect(getCircuitState(EBAY)).toBe('OPEN');

    // Advance time past recovery window
    const originalNow = Date.now;
    Date.now = () => originalNow() + 300_001;
    expect(canDispatch(EBAY, 300_000)).toBe(true);
    expect(getCircuitState(EBAY, 300_000)).toBe('HALF_OPEN');
    Date.now = originalNow;
  });

  it('5 consecutive failures transitions to OPEN', () => {
    for (let i = 0; i < 4; i++) {
      recordFailure(EBAY, 5);
      expect(getCircuitState(EBAY)).toBe('CLOSED');
    }
    recordFailure(EBAY, 5);
    expect(getCircuitState(EBAY)).toBe('OPEN');
  });

  it('recordSuccess in CLOSED resets failure count', () => {
    recordFailure(EBAY, 5);
    recordFailure(EBAY, 5);
    recordSuccess(EBAY);
    // After success, failures reset — 5 more needed to open
    for (let i = 0; i < 4; i++) {
      recordFailure(EBAY, 5);
    }
    expect(getCircuitState(EBAY)).toBe('CLOSED');
  });

  it('OPEN transitions to HALF_OPEN after recoveryWindowMs', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(EBAY, 5);
    }
    expect(getCircuitState(EBAY)).toBe('OPEN');

    const originalNow = Date.now;
    Date.now = () => originalNow() + 300_001;
    expect(getCircuitState(EBAY, 300_000)).toBe('HALF_OPEN');
    Date.now = originalNow;
  });

  it('HALF_OPEN + failure transitions back to OPEN immediately', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(EBAY, 5);
    }
    const originalNow = Date.now;
    Date.now = () => originalNow() + 300_001;
    getCircuitState(EBAY, 300_000); // transition to HALF_OPEN
    expect(getCircuitState(EBAY)).toBe('HALF_OPEN');

    recordFailure(EBAY, 5);
    expect(getCircuitState(EBAY)).toBe('OPEN');
    Date.now = originalNow;
  });

  it('HALF_OPEN + 2 successes transitions to CLOSED (recovery)', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(EBAY, 5);
    }
    const originalNow = Date.now;
    Date.now = () => originalNow() + 300_001;
    getCircuitState(EBAY, 300_000); // transition to HALF_OPEN

    recordSuccess(EBAY, 2);
    expect(getCircuitState(EBAY)).toBe('HALF_OPEN'); // 1 success, need 2
    recordSuccess(EBAY, 2);
    expect(getCircuitState(EBAY)).toBe('CLOSED');
    Date.now = originalNow;
  });

  it('getAllCircuitStatuses returns all tracked channels', () => {
    recordFailure(EBAY, 5);
    recordSuccess(POSHMARK);
    const statuses = getAllCircuitStatuses();
    expect(statuses['EBAY']).toBe('CLOSED');
    expect(statuses['POSHMARK']).toBe('CLOSED');
  });

  it('resetCircuit clears state for one channel', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(EBAY, 5);
    }
    expect(getCircuitState(EBAY)).toBe('OPEN');
    resetCircuit(EBAY);
    expect(getCircuitState(EBAY)).toBe('CLOSED');
  });
});
