import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, def: unknown) => def),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Tests ───────────────────────────────────────────────────────────────

describe('circuit-breaker', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset in-memory state between tests
    const mod = await import('../circuit-breaker');
    mod.resetAllCircuits();
  });

  it('starts in CLOSED state', async () => {
    const { getCircuitState } = await import('../circuit-breaker');
    const state = await getCircuitState('stripe');
    expect(state).toBe('CLOSED');
  });

  it('transitions to OPEN after reaching failure threshold', async () => {
    const { recordCircuitFailure, getCircuitState } = await import('../circuit-breaker');

    // Default threshold is 3
    await recordCircuitFailure('stripe');
    await recordCircuitFailure('stripe');
    expect(await getCircuitState('stripe')).toBe('CLOSED');

    await recordCircuitFailure('stripe');
    expect(await getCircuitState('stripe')).toBe('OPEN');
  });

  it('transitions from OPEN to HALF_OPEN after timeout elapses', async () => {
    const { recordCircuitFailure, getCircuitState, resetAllCircuits } = await import('../circuit-breaker');

    // Trip the circuit
    for (let i = 0; i < 3; i++) {
      await recordCircuitFailure('typesense');
    }
    expect(await getCircuitState('typesense')).toBe('OPEN');

    // Simulate time passing beyond the 30-second default
    // We need to manipulate the internal openedAt — use Date.now mock
    const realNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(realNow() + 31_000);

    expect(await getCircuitState('typesense')).toBe('HALF_OPEN');

    vi.spyOn(Date, 'now').mockRestore();
  });

  it('transitions from HALF_OPEN to CLOSED on success', async () => {
    const { recordCircuitFailure, recordCircuitSuccess, getCircuitState } = await import('../circuit-breaker');

    // Trip circuit
    for (let i = 0; i < 3; i++) {
      await recordCircuitFailure('resend');
    }

    // Advance past timeout
    const realNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(realNow() + 31_000);
    expect(await getCircuitState('resend')).toBe('HALF_OPEN');
    vi.spyOn(Date, 'now').mockRestore();

    // Success in HALF_OPEN closes circuit
    await recordCircuitSuccess('resend');
    expect(await getCircuitState('resend')).toBe('CLOSED');
  });

  it('transitions from HALF_OPEN to OPEN on failure', async () => {
    const { recordCircuitFailure, getCircuitState } = await import('../circuit-breaker');

    // Trip circuit
    for (let i = 0; i < 3; i++) {
      await recordCircuitFailure('shippo');
    }

    // Advance past timeout
    const realNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(realNow() + 31_000);
    expect(await getCircuitState('shippo')).toBe('HALF_OPEN');

    // Failure in HALF_OPEN re-opens
    vi.spyOn(Date, 'now').mockReturnValue(realNow() + 32_000);
    await recordCircuitFailure('shippo');
    expect(await getCircuitState('shippo')).toBe('OPEN');

    vi.spyOn(Date, 'now').mockRestore();
  });

  it('isCircuitOpen returns true only when OPEN', async () => {
    const { recordCircuitFailure, isCircuitOpen } = await import('../circuit-breaker');

    expect(await isCircuitOpen('r2')).toBe(false);

    for (let i = 0; i < 3; i++) {
      await recordCircuitFailure('r2');
    }

    expect(await isCircuitOpen('r2')).toBe(true);
  });

  it('getAllCircuitStates returns all protected services', async () => {
    const { getAllCircuitStates, PROTECTED_SERVICES } = await import('../circuit-breaker');

    const states = await getAllCircuitStates();
    for (const service of PROTECTED_SERVICES) {
      expect(states[service]).toBe('CLOSED');
    }
  });

  it('updateCircuitBreakersFromHealth maps check results to services', async () => {
    const { updateCircuitBreakersFromHealth, getCircuitState } = await import('../circuit-breaker');

    // 3 UNHEALTHY checks for stripe should trip the breaker
    await updateCircuitBreakersFromHealth([
      { checkName: 'stripe-payments', module: 'stripe', status: 'UNHEALTHY' },
      { checkName: 'stripe-webhooks', module: 'stripe', status: 'UNHEALTHY' },
      { checkName: 'stripe-connect', module: 'stripe', status: 'UNHEALTHY' },
    ]);

    expect(await getCircuitState('stripe')).toBe('OPEN');
  });
});
