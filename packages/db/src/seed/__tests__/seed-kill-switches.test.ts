/**
 * Seed Kill Switches Tests (G10.4)
 * Validates seed data structure: 12 kill switches (enabled) + 8 launch gates (disabled).
 * Verifies idempotency via onConflictDoNothing behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockOnConflictDoNothing = vi.fn().mockResolvedValue([]);

vi.mock('../schema', () => ({
  featureFlag: { id: 'id', key: 'key' },
}));

vi.mock('../seed-system', () => ({
  SEED_IDS: { staffAdminId: 'staff-admin-seed-1' },
}));

// ─── Static data validation (import seed arrays directly) ────────────────────

// We test the data arrays by re-importing the module and capturing insert calls
// via a mock db that records values passed.

const insertedValues: Array<Record<string, unknown>> = [];

const mockDb = {
  insert: vi.fn().mockReturnValue({
    values: (val: Record<string, unknown>) => {
      insertedValues.push(val);
      return { onConflictDoNothing: mockOnConflictDoNothing };
    },
  }),
};

// ─── Seed data structure tests ────────────────────────────────────────────────

describe('seedKillSwitches — data structure', () => {
  beforeEach(() => {
    insertedValues.length = 0;
    vi.clearAllMocks();
    mockOnConflictDoNothing.mockResolvedValue([]);
  });

  it('seeds exactly 20 flags total (12 kill switches + 8 launch gates)', async () => {
    const { seedKillSwitches } = await import('../seed-kill-switches');
    await seedKillSwitches(mockDb as never);

    expect(insertedValues).toHaveLength(20);
  });

  it('seeds exactly 12 kill switch flags with kill. prefix', async () => {
    const { seedKillSwitches } = await import('../seed-kill-switches');
    await seedKillSwitches(mockDb as never);

    const killSwitches = insertedValues.filter((v) =>
      typeof v.key === 'string' && v.key.startsWith('kill.'),
    );
    expect(killSwitches).toHaveLength(12);
  });

  it('seeds exactly 8 launch gate flags with gate. prefix', async () => {
    const { seedKillSwitches } = await import('../seed-kill-switches');
    await seedKillSwitches(mockDb as never);

    const gates = insertedValues.filter((v) =>
      typeof v.key === 'string' && v.key.startsWith('gate.'),
    );
    expect(gates).toHaveLength(8);
  });

  it('all kill switches start enabled = true', async () => {
    const { seedKillSwitches } = await import('../seed-kill-switches');
    await seedKillSwitches(mockDb as never);

    const killSwitches = insertedValues.filter((v) =>
      typeof v.key === 'string' && v.key.startsWith('kill.'),
    );
    expect(killSwitches.every((v) => v.enabled === true)).toBe(true);
  });

  it('all launch gates start enabled = false', async () => {
    const { seedKillSwitches } = await import('../seed-kill-switches');
    await seedKillSwitches(mockDb as never);

    const gates = insertedValues.filter((v) =>
      typeof v.key === 'string' && v.key.startsWith('gate.'),
    );
    expect(gates.every((v) => v.enabled === false)).toBe(true);
  });

  it('all flags have type BOOLEAN', async () => {
    const { seedKillSwitches } = await import('../seed-kill-switches');
    await seedKillSwitches(mockDb as never);

    expect(insertedValues.every((v) => v.type === 'BOOLEAN')).toBe(true);
  });

  it('all flags have non-empty name and description', async () => {
    const { seedKillSwitches } = await import('../seed-kill-switches');
    await seedKillSwitches(mockDb as never);

    expect(insertedValues.every((v) => typeof v.name === 'string' && v.name.length > 0)).toBe(true);
    expect(insertedValues.every((v) => typeof v.description === 'string' && v.description.length > 0)).toBe(true);
  });

  it('contains all 12 expected kill switch keys', async () => {
    const { seedKillSwitches } = await import('../seed-kill-switches');
    await seedKillSwitches(mockDb as never);

    const keys = insertedValues.map((v) => v.key);
    const expectedKillKeys = [
      'kill.checkout',
      'kill.crosslister',
      'kill.messaging',
      'kill.offers',
      'kill.payouts',
      'kill.search',
      'kill.local',
      'kill.reviews',
      'kill.registrations',
      'kill.listings.create',
      'kill.stripe.webhooks',
      'kill.notifications.email',
    ];
    for (const key of expectedKillKeys) {
      expect(keys).toContain(key);
    }
  });

  it('contains all 8 expected launch gate keys', async () => {
    const { seedKillSwitches } = await import('../seed-kill-switches');
    await seedKillSwitches(mockDb as never);

    const keys = insertedValues.map((v) => v.key);
    const expectedGateKeys = [
      'gate.marketplace',
      'gate.crosslister',
      'gate.local',
      'gate.helpdesk',
      'gate.affiliates',
      'gate.authentication',
      'gate.financial.center',
      'gate.store.subscriptions',
    ];
    for (const key of expectedGateKeys) {
      expect(keys).toContain(key);
    }
  });

  it('uses onConflictDoNothing for idempotency (no duplicate inserts)', async () => {
    const { seedKillSwitches } = await import('../seed-kill-switches');
    await seedKillSwitches(mockDb as never);

    // Each insert call must chain to onConflictDoNothing
    expect(mockOnConflictDoNothing).toHaveBeenCalledTimes(20);
  });

  it('uses the seeded staff admin ID as createdByStaffId', async () => {
    const { seedKillSwitches } = await import('../seed-kill-switches');
    await seedKillSwitches(mockDb as never);

    expect(insertedValues.every((v) => v.createdByStaffId === 'staff-admin-seed-1')).toBe(true);
  });
});
