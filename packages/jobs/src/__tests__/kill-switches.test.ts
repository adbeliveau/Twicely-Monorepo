import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Tests ───────────────────────────────────────────────────────────────

describe('kill-switches', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../kill-switches');
    mod.resetAllKillSwitches();
  });

  it('returns false for an untoggled kill switch', async () => {
    const { isKillSwitchActive } = await import('../kill-switches');
    expect(await isKillSwitchActive('killCheckout')).toBe(false);
  });

  it('toggles a kill switch on', async () => {
    const { isKillSwitchActive, toggleKillSwitch } = await import('../kill-switches');

    await toggleKillSwitch('killCheckout', true, 'staff_1');
    expect(await isKillSwitchActive('killCheckout')).toBe(true);
  });

  it('toggles a kill switch off after being on', async () => {
    const { isKillSwitchActive, toggleKillSwitch } = await import('../kill-switches');

    await toggleKillSwitch('killPayouts', true, 'staff_1');
    expect(await isKillSwitchActive('killPayouts')).toBe(true);

    await toggleKillSwitch('killPayouts', false, 'staff_1');
    expect(await isKillSwitchActive('killPayouts')).toBe(false);
  });

  it('getAllKillSwitches returns all switches with correct states', async () => {
    const { getAllKillSwitches, toggleKillSwitch, KILL_SWITCHES } = await import('../kill-switches');

    await toggleKillSwitch('killImports', true, 'staff_2');
    await toggleKillSwitch('readOnlyMode', true, 'staff_2');

    const all = await getAllKillSwitches();

    // All switch names should be present
    for (const name of KILL_SWITCHES) {
      expect(name in all).toBe(true);
    }

    expect(all.killImports).toBe(true);
    expect(all.readOnlyMode).toBe(true);
    expect(all.killCheckout).toBe(false);
    expect(all.killPayouts).toBe(false);
  });

  it('logs when a kill switch is toggled', async () => {
    const { toggleKillSwitch } = await import('../kill-switches');
    const { logger } = await import('@twicely/logger');

    await toggleKillSwitch('killRegistration', true, 'staff_3');

    expect(logger.warn).toHaveBeenCalledWith(
      '[killSwitch] Toggled',
      expect.objectContaining({ name: 'killRegistration', active: true, staffId: 'staff_3' }),
    );
  });
});
