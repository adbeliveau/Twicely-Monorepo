/**
 * Admin Tax Rules Query Tests (I14)
 * Covers getTaxRuleSettings.
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

// ─── getTaxRuleSettings ───────────────────────────────────────────────────────

describe('getTaxRuleSettings', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns tax settings from DB', async () => {
    const rows = [
      { key: 'tax.platformTaxEnabled', value: false, description: 'Enable platform-level tax collection' },
      { key: 'tax.defaultTaxRate', value: 0, description: 'Default tax rate in basis points' },
    ];
    mockDbSelect.mockReturnValue(makeChain(rows));

    const { getTaxRuleSettings } = await import('../admin-tax-rules');
    const result = await getTaxRuleSettings();

    expect(result).toHaveLength(2);
    expect(result[0]?.key).toBe('tax.platformTaxEnabled');
    expect(result[0]?.value).toBe(false);
  });

  it('returns empty array when no tax settings configured', async () => {
    mockDbSelect.mockReturnValue(makeChain([]));

    const { getTaxRuleSettings } = await import('../admin-tax-rules');
    const result = await getTaxRuleSettings();

    expect(result).toHaveLength(0);
  });

  it('returns description field from each row', async () => {
    const rows = [
      { key: 'tax.defaultTaxRate', value: 0, description: 'Default tax rate in basis points' },
    ];
    mockDbSelect.mockReturnValue(makeChain(rows));

    const { getTaxRuleSettings } = await import('../admin-tax-rules');
    const result = await getTaxRuleSettings();

    expect(result[0]?.description).toBe('Default tax rate in basis points');
  });

  it('handles null description gracefully', async () => {
    const rows = [
      { key: 'tax.someRule', value: true, description: null },
    ];
    mockDbSelect.mockReturnValue(makeChain(rows));

    const { getTaxRuleSettings } = await import('../admin-tax-rules');
    const result = await getTaxRuleSettings();

    expect(result[0]?.description).toBeNull();
  });

  it('returns all keys from tax.% prefix', async () => {
    const rows = [
      { key: 'tax.a', value: 1, description: null },
      { key: 'tax.b', value: 2, description: null },
    ];
    mockDbSelect.mockReturnValue(makeChain(rows));

    const { getTaxRuleSettings } = await import('../admin-tax-rules');
    const result = await getTaxRuleSettings();

    expect(result).toHaveLength(2);
  });
});
