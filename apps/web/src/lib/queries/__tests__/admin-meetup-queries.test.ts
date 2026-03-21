import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect },
}));

vi.mock('drizzle-orm', () => ({
  count: vi.fn(() => ({ type: 'count' })),
  sum: vi.fn((col) => ({ type: 'sum', col })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
  eq: vi.fn((col, val) => ({ type: 'eq', col, val })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  ilike: vi.fn((col, val) => ({ type: 'ilike', col, val })),
  or: vi.fn((...args) => ({ type: 'or', args })),
}));

vi.mock('@twicely/db/schema', () => ({
  safeMeetupLocation: {
    id: 'id',
    name: 'name',
    address: 'address',
    city: 'city',
    state: 'state',
    zip: 'zip',
    country: 'country',
    latitude: 'latitude',
    longitude: 'longitude',
    type: 'type',
    verifiedSafe: 'verified_safe',
    meetupCount: 'meetup_count',
    rating: 'rating',
    isActive: 'is_active',
    operatingHoursJson: 'operating_hours_json',
    addedByStaffId: 'added_by_staff_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chainable: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  ['from', 'where', 'orderBy', 'limit', 'offset'].forEach((key) => {
    chainable[key] = vi.fn().mockReturnValue(chainable);
  });
  return chainable;
}

// ─── getAllMeetupLocationsAdmin ────────────────────────────────────────────────

describe('getAllMeetupLocationsAdmin', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns all locations including inactive ones', async () => {
    const rows = [
      {
        id: 'loc-1', name: 'Police Station', address: '123 Main', city: 'Austin',
        state: 'TX', zip: '78701', country: 'US', latitude: 30.2, longitude: -97.7,
        type: 'POLICE_STATION', verifiedSafe: true, meetupCount: 5, rating: null,
        isActive: true, operatingHoursJson: null, addedByStaffId: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'loc-2', name: 'Old Library', address: '456 Oak', city: 'Dallas',
        state: 'TX', zip: '75001', country: 'US', latitude: 32.7, longitude: -96.8,
        type: 'COMMUNITY', verifiedSafe: false, meetupCount: 0, rating: null,
        isActive: false, operatingHoursJson: null, addedByStaffId: 'staff-1',
        createdAt: new Date(), updatedAt: new Date(),
      },
    ];
    mockDbSelect.mockReturnValue(makeSelectChain(rows));

    const { getAllMeetupLocationsAdmin } = await import('../admin-meetup-locations');
    const result = await getAllMeetupLocationsAdmin();

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('loc-1');
    expect(result[1]!.isActive).toBe(false);
  });

  it('returns empty array when no locations exist', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { getAllMeetupLocationsAdmin } = await import('../admin-meetup-locations');
    const result = await getAllMeetupLocationsAdmin();

    expect(result).toEqual([]);
  });

  it('includes all expected AdminMeetupLocationRow fields', async () => {
    const row = {
      id: 'loc-3', name: 'Mall', address: '789 Elm', city: 'Houston',
      state: 'TX', zip: '77001', country: 'US', latitude: 29.7, longitude: -95.3,
      type: 'RETAIL', verifiedSafe: false, meetupCount: 12, rating: 4.5,
      isActive: true, operatingHoursJson: { mon: '9-5' }, addedByStaffId: 'staff-2',
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-02-01'),
    };
    mockDbSelect.mockReturnValue(makeSelectChain([row]));

    const { getAllMeetupLocationsAdmin } = await import('../admin-meetup-locations');
    const result = await getAllMeetupLocationsAdmin();

    expect(result[0]).toMatchObject({
      id: 'loc-3',
      name: 'Mall',
      address: '789 Elm',
      type: 'RETAIL',
      addedByStaffId: 'staff-2',
      operatingHoursJson: { mon: '9-5' },
    });
  });

  it('passes type filter to query when provided', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { getAllMeetupLocationsAdmin } = await import('../admin-meetup-locations');
    await getAllMeetupLocationsAdmin({ type: 'POLICE_STATION' });

    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });
});

// ─── getMeetupLocationStatsAdmin ──────────────────────────────────────────────

describe('getMeetupLocationStatsAdmin', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns correct stats structure with all fields', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 10 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 7 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 3 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 5 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: 42 }]));

    const { getMeetupLocationStatsAdmin } = await import('../admin-meetup-locations');
    const result = await getMeetupLocationStatsAdmin();

    expect(result).toEqual({
      total: 10,
      active: 7,
      inactive: 3,
      verified: 5,
      totalMeetups: 42,
    });
  });

  it('returns zeros when no locations exist', async () => {
    for (let i = 0; i < 4; i++) {
      mockDbSelect.mockReturnValueOnce(makeSelectChain([{ count: 0 }]));
    }
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ total: null }]));

    const { getMeetupLocationStatsAdmin } = await import('../admin-meetup-locations');
    const result = await getMeetupLocationStatsAdmin();

    expect(result.total).toBe(0);
    expect(result.active).toBe(0);
    expect(result.inactive).toBe(0);
    expect(result.verified).toBe(0);
    expect(result.totalMeetups).toBe(0);
  });

  it('coerces totalMeetups to number from SQL aggregate string', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 3 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 2 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 2 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: '77' }]));

    const { getMeetupLocationStatsAdmin } = await import('../admin-meetup-locations');
    const result = await getMeetupLocationStatsAdmin();

    expect(typeof result.totalMeetups).toBe('number');
    expect(result.totalMeetups).toBe(77);
  });
});
