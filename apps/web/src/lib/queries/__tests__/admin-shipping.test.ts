/**
 * Admin Shipping Query Tests (I14)
 * Covers getShippingAdminSettings.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));
vi.mock('@twicely/db/schema', () => ({
  platformSetting: {
    key: 'key',
    value: 'value',
    description: 'description',
  },
}));
vi.mock('drizzle-orm', () => ({
  like: (_a: unknown, _b: unknown) => ({ type: 'like' }),
}));

// ─── Chain helper ─────────────────────────────────────────────────────────────

function makeChain(result: unknown[]) {
  const c: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const key of ['from', 'where', 'orderBy', 'limit', 'offset']) {
    c[key] = vi.fn().mockReturnValue(c);
  }
  return c;
}

// ─── getShippingAdminSettings ─────────────────────────────────────────────────

describe('getShippingAdminSettings', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns shipping settings from DB', async () => {
    const rows = [
      { key: 'shipping.defaultCarrier', value: 'USPS', description: 'Default shipping carrier' },
      { key: 'shipping.freeThresholdCents', value: 5000, description: 'Free shipping threshold' },
    ];
    mockDbSelect.mockReturnValue(makeChain(rows));

    const { getShippingAdminSettings } = await import('../admin-shipping');
    const result = await getShippingAdminSettings();

    expect(result).toHaveLength(2);
    expect(result[0]?.key).toBe('shipping.defaultCarrier');
    expect(result[0]?.value).toBe('USPS');
  });

  it('returns empty array when no shipping settings', async () => {
    mockDbSelect.mockReturnValue(makeChain([]));

    const { getShippingAdminSettings } = await import('../admin-shipping');
    const result = await getShippingAdminSettings();

    expect(result).toHaveLength(0);
  });

  it('returns description field from each row', async () => {
    const rows = [
      { key: 'shipping.labelGenerationEnabled', value: true, description: 'Enable label generation' },
    ];
    mockDbSelect.mockReturnValue(makeChain(rows));

    const { getShippingAdminSettings } = await import('../admin-shipping');
    const result = await getShippingAdminSettings();

    expect(result[0]?.description).toBe('Enable label generation');
  });

  it('handles null description gracefully', async () => {
    const rows = [
      { key: 'shipping.maxHandlingDays', value: 7, description: null },
    ];
    mockDbSelect.mockReturnValue(makeChain(rows));

    const { getShippingAdminSettings } = await import('../admin-shipping');
    const result = await getShippingAdminSettings();

    expect(result[0]?.description).toBeNull();
  });

  it('returns all keys from shipping.% prefix', async () => {
    const rows = [
      { key: 'shipping.a', value: 1, description: null },
      { key: 'shipping.b', value: 2, description: null },
      { key: 'shipping.c', value: 3, description: null },
    ];
    mockDbSelect.mockReturnValue(makeChain(rows));

    const { getShippingAdminSettings } = await import('../admin-shipping');
    const result = await getShippingAdminSettings();

    expect(result).toHaveLength(3);
  });
});
