import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getConnectorSettings,
  getConnectorStats,
} from '../admin-connector-settings';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  platformSetting: { id: 'id', key: 'key', value: 'value', type: 'type', description: 'description' },
  crosslisterAccount: { channel: 'channel', status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (_col: unknown, _val: unknown) => ({ type: 'eq' }),
  and: (..._args: unknown[]) => ({ type: 'and' }),
  count: () => ({ type: 'count' }),
  like: (_col: unknown, _val: unknown) => ({ type: 'like' }),
}));

vi.mock('@twicely/crosslister/types', () => ({}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChainFrom(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function makeSelectChainCount(countVal: number) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ c: countVal }]),
    }),
  };
}

// ─── getConnectorSettings ─────────────────────────────────────────────────────

describe('getConnectorSettings', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns array of ConnectorSetting objects for matching prefix', async () => {
    const rows = [
      { id: 'ps-1', key: 'crosslister.ebay.clientId', value: 'abc', type: 'string', description: 'eBay client ID' },
      { id: 'ps-2', key: 'crosslister.ebay.clientSecret', value: null, type: 'string', description: null },
    ];
    mockDbSelect.mockReturnValue(makeSelectChainFrom(rows));

    const result = await getConnectorSettings('ebay');

    expect(result).toHaveLength(2);
    expect(result[0]!.key).toBe('crosslister.ebay.clientId');
    expect(result[1]!.key).toBe('crosslister.ebay.clientSecret');
  });

  it('returns empty array when no settings match', async () => {
    mockDbSelect.mockReturnValue(makeSelectChainFrom([]));

    const result = await getConnectorSettings('newconnector');

    expect(result).toHaveLength(0);
  });

  it('returns ConnectorSetting with correct field shape', async () => {
    const rows = [
      { id: 'ps-3', key: 'crosslister.etsy.importEnabled', value: true, type: 'boolean', description: 'Enable import' },
    ];
    mockDbSelect.mockReturnValue(makeSelectChainFrom(rows));

    const result = await getConnectorSettings('etsy');

    expect(result[0]).toMatchObject({
      id: 'ps-3',
      key: 'crosslister.etsy.importEnabled',
      value: true,
      type: 'boolean',
      description: 'Enable import',
    });
  });

  it('handles settings with null description', async () => {
    const rows = [
      { id: 'ps-4', key: 'crosslister.poshmark.apiBase', value: 'https://api.poshmark.com', type: 'string', description: null },
    ];
    mockDbSelect.mockReturnValue(makeSelectChainFrom(rows));

    const result = await getConnectorSettings('poshmark');

    expect(result[0]!.description).toBeNull();
  });
});

// ─── getConnectorStats ────────────────────────────────────────────────────────

describe('getConnectorStats', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns connectedAccounts and activeAccounts counts', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChainCount(5))
      .mockReturnValueOnce(makeSelectChainCount(3));

    const result = await getConnectorStats('EBAY');

    expect(result.connectedAccounts).toBe(5);
    expect(result.activeAccounts).toBe(3);
  });

  it('returns zeros when no accounts exist for channel', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChainCount(0))
      .mockReturnValueOnce(makeSelectChainCount(0));

    const result = await getConnectorStats('GRAILED');

    expect(result.connectedAccounts).toBe(0);
    expect(result.activeAccounts).toBe(0);
  });

  it('uses two DB queries (total + active)', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChainCount(10))
      .mockReturnValueOnce(makeSelectChainCount(7));

    await getConnectorStats('POSHMARK');

    expect(mockDbSelect).toHaveBeenCalledTimes(2);
  });

  it('handles channel with mixed statuses correctly', async () => {
    // 8 total, 4 active (others may be PAUSED, REVOKED, ERROR)
    mockDbSelect
      .mockReturnValueOnce(makeSelectChainCount(8))
      .mockReturnValueOnce(makeSelectChainCount(4));

    const result = await getConnectorStats('MERCARI');

    expect(result.connectedAccounts).toBe(8);
    expect(result.activeAccounts).toBe(4);
    // Active should never exceed total
    expect(result.activeAccounts).toBeLessThanOrEqual(result.connectedAccounts);
  });

  it('returns zero activeAccounts when count row is missing', async () => {
    mockDbSelect
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) });

    const result = await getConnectorStats('DEPOP');

    expect(result.connectedAccounts).toBe(0);
    expect(result.activeAccounts).toBe(0);
  });
});
