import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClient = vi.hoisted(() => ({
  indices: {
    create: vi.fn().mockResolvedValue({ body: {} }),
    updateAliases: vi.fn().mockResolvedValue({ body: {} }),
    getAlias: vi.fn().mockResolvedValue({ body: {} }),
    delete: vi.fn().mockResolvedValue({ body: {} }),
    stats: vi.fn().mockResolvedValue({ body: { indices: {} } }),
  },
  cat: {
    indices: vi.fn().mockResolvedValue({ body: [] }),
  },
}));

vi.mock('../opensearch-client', () => ({
  getOpenSearchClient: vi.fn(() => mockClient),
}));

vi.mock('../opensearch-mapping', () => ({
  LISTINGS_READ_ALIAS: 'twicely_listings',
  LISTINGS_WRITE_ALIAS: 'twicely_listings_write',
  LISTINGS_INDEX_PREFIX: 'twicely_listings_v',
  LISTINGS_INDEX_SETTINGS: { number_of_shards: 1 },
  LISTINGS_INDEX_MAPPINGS: { dynamic: 'strict', properties: {} },
}));

import {
  createVersionedIndex,
  swapReadAlias,
  swapWriteAlias,
  rollbackAlias,
  getActiveIndex,
  listPhysicalIndices,
  deleteOldIndices,
  ensureIndex,
} from '../opensearch-lifecycle';

describe('createVersionedIndex', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an index with the correct prefix and version', async () => {
    const name = await createVersionedIndex(3);
    expect(name).toMatch(/^twicely_listings_v3_\d{14}$/);
    expect(mockClient.indices.create).toHaveBeenCalledTimes(1);

    const call = mockClient.indices.create.mock.calls[0][0];
    expect(call.index).toBe(name);
    expect(call.body.settings).toEqual({ number_of_shards: 1 });
    expect(call.body.mappings).toEqual({ dynamic: 'strict', properties: {} });
  });
});

describe('swapReadAlias', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes old alias and adds new alias atomically', async () => {
    mockClient.indices.getAlias.mockResolvedValueOnce({
      body: { twicely_listings_v1_20260101: {} },
    });

    await swapReadAlias('twicely_listings_v2_20260201');

    const call = mockClient.indices.updateAliases.mock.calls[0][0];
    expect(call.body.actions).toEqual([
      { remove: { index: 'twicely_listings_v1_20260101', alias: 'twicely_listings' } },
      { add: { index: 'twicely_listings_v2_20260201', alias: 'twicely_listings' } },
    ]);
  });

  it('handles case when no existing alias', async () => {
    mockClient.indices.getAlias.mockRejectedValueOnce(new Error('not found'));

    await swapReadAlias('twicely_listings_v1_20260101');

    const call = mockClient.indices.updateAliases.mock.calls[0][0];
    expect(call.body.actions).toEqual([
      { add: { index: 'twicely_listings_v1_20260101', alias: 'twicely_listings' } },
    ]);
  });
});

describe('swapWriteAlias', () => {
  beforeEach(() => vi.clearAllMocks());

  it('swaps write alias to target index', async () => {
    mockClient.indices.getAlias.mockResolvedValueOnce({
      body: { twicely_listings_v1_20260101: {} },
    });

    await swapWriteAlias('twicely_listings_v2_20260201');

    const call = mockClient.indices.updateAliases.mock.calls[0][0];
    expect(call.body.actions).toEqual([
      { remove: { index: 'twicely_listings_v1_20260101', alias: 'twicely_listings_write' } },
      { add: { index: 'twicely_listings_v2_20260201', alias: 'twicely_listings_write' } },
    ]);
  });
});

describe('rollbackAlias', () => {
  beforeEach(() => vi.clearAllMocks());

  it('swaps read alias back to previous index', async () => {
    mockClient.indices.getAlias.mockResolvedValueOnce({
      body: { twicely_listings_v2_20260201: {} },
    });

    await rollbackAlias('twicely_listings_v1_20260101');

    const call = mockClient.indices.updateAliases.mock.calls[0][0];
    expect(call.body.actions).toContainEqual(
      { add: { index: 'twicely_listings_v1_20260101', alias: 'twicely_listings' } },
    );
  });
});

describe('getActiveIndex', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the index currently pointed to by the read alias', async () => {
    mockClient.indices.getAlias.mockResolvedValueOnce({
      body: { twicely_listings_v2_20260201: {} },
    });

    const active = await getActiveIndex();
    expect(active).toBe('twicely_listings_v2_20260201');
  });

  it('returns null when no alias exists', async () => {
    mockClient.indices.getAlias.mockRejectedValueOnce(new Error('not found'));

    const active = await getActiveIndex();
    expect(active).toBeNull();
  });
});

describe('listPhysicalIndices', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns index info with alias status', async () => {
    mockClient.cat.indices.mockResolvedValueOnce({
      body: [
        { index: 'twicely_listings_v1_20260101', 'docs.count': '100', 'store.size': '5mb', 'creation.date.string': '2026-01-01' },
        { index: 'twicely_listings_v2_20260201', 'docs.count': '200', 'store.size': '10mb', 'creation.date.string': '2026-02-01' },
      ],
    });
    // Read alias check
    mockClient.indices.getAlias
      .mockResolvedValueOnce({ body: { twicely_listings_v2_20260201: {} } })
      // Write alias check
      .mockResolvedValueOnce({ body: { twicely_listings_v2_20260201: {} } });

    const indices = await listPhysicalIndices();
    expect(indices).toHaveLength(2);
    expect(indices[0]).toEqual({
      name: 'twicely_listings_v1_20260101',
      docCount: 100,
      sizeBytes: 5 * 1024 * 1024,
      createdAt: '2026-01-01',
      isReadActive: false,
      isWriteActive: false,
    });
    expect(indices[1].isReadActive).toBe(true);
    expect(indices[1].isWriteActive).toBe(true);
  });
});

describe('deleteOldIndices', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes old indices beyond keepCount, never deletes aliased', async () => {
    mockClient.cat.indices.mockResolvedValueOnce({
      body: [
        { index: 'twicely_listings_v1_20260101', 'docs.count': '100', 'store.size': '5mb', 'creation.date.string': '2026-01-01' },
        { index: 'twicely_listings_v2_20260201', 'docs.count': '200', 'store.size': '10mb', 'creation.date.string': '2026-02-01' },
        { index: 'twicely_listings_v3_20260301', 'docs.count': '300', 'store.size': '15mb', 'creation.date.string': '2026-03-01' },
      ],
    });
    mockClient.indices.getAlias
      .mockResolvedValueOnce({ body: { twicely_listings_v3_20260301: {} } }) // read
      .mockResolvedValueOnce({ body: { twicely_listings_v3_20260301: {} } }); // write

    const deleted = await deleteOldIndices(1);
    // v3 is aliased (kept), v2 kept (keepCount=1), v1 deleted
    expect(deleted).toEqual(['twicely_listings_v1_20260101']);
    expect(mockClient.indices.delete).toHaveBeenCalledTimes(1);
  });
});

describe('ensureIndex', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no-ops when read alias already exists', async () => {
    mockClient.indices.getAlias.mockResolvedValueOnce({
      body: { twicely_listings_v1_20260101: {} },
    });

    await ensureIndex();
    expect(mockClient.indices.create).not.toHaveBeenCalled();
  });

  it('creates initial index and attaches both aliases when none exist', async () => {
    // getActiveIndex → getAliasTargets (read) → error (no alias)
    mockClient.indices.getAlias.mockRejectedValueOnce(new Error('not found'));
    // swapReadAlias → getAliasTargets (read) → error
    mockClient.indices.getAlias.mockRejectedValueOnce(new Error('not found'));
    // swapWriteAlias → getAliasTargets (write) → error
    mockClient.indices.getAlias.mockRejectedValueOnce(new Error('not found'));

    await ensureIndex();
    expect(mockClient.indices.create).toHaveBeenCalledTimes(1);
    expect(mockClient.indices.updateAliases).toHaveBeenCalledTimes(2); // read + write
  });
});
