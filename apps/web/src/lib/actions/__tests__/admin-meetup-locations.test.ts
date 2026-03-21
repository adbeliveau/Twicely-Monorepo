import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { update: mockDbUpdate, insert: mockDbInsert },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

vi.mock('@twicely/db/schema', () => ({
  safeMeetupLocation: { id: 'id', isActive: 'is_active', updatedAt: 'updated_at' },
  auditEvent: { id: 'id', action: 'action' },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInsertReturningChain(returnedId: string) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: returnedId }]),
    }),
  };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function mockCanUpdateSetting() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'update' && s === 'Setting') };
  const session = {
    staffUserId: 'staff-admin-001',
    email: 'admin@twicely.co',
    displayName: 'Admin',
    isPlatformStaff: true as const,
    platformRoles: ['ADMIN'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = {
    staffUserId: 'staff-support-001',
    email: 'support@twicely.co',
    displayName: 'Support',
    isPlatformStaff: true as const,
    platformRoles: ['SUPPORT'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

const validLocationInput = {
  name: 'Police Station - 1st Precinct',
  address: '123 Main St',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  country: 'US',
  latitude: 30.2672,
  longitude: -97.7431,
  type: 'POLICE_STATION',
  verifiedSafe: true,
};

// ─── createMeetupLocationAction ───────────────────────────────────────────────

describe('createMeetupLocationAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies update on Setting', async () => {
    mockForbidden();
    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await createMeetupLocationAction(validLocationInput)).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing name', async () => {
    mockCanUpdateSetting();
    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    const { name: _name, ...withoutName } = validLocationInput;
    expect(await createMeetupLocationAction(withoutName)).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for missing city', async () => {
    mockCanUpdateSetting();
    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    const { city: _city, ...withoutCity } = validLocationInput;
    expect(await createMeetupLocationAction(withoutCity)).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for latitude out of range (> 90)', async () => {
    mockCanUpdateSetting();
    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await createMeetupLocationAction({ ...validLocationInput, latitude: 91 }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for latitude out of range (< -90)', async () => {
    mockCanUpdateSetting();
    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await createMeetupLocationAction({ ...validLocationInput, latitude: -91 }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for longitude out of range (> 180)', async () => {
    mockCanUpdateSetting();
    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await createMeetupLocationAction({ ...validLocationInput, longitude: 181 }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for longitude out of range (< -180)', async () => {
    mockCanUpdateSetting();
    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await createMeetupLocationAction({ ...validLocationInput, longitude: -181 }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for name over 200 chars', async () => {
    mockCanUpdateSetting();
    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await createMeetupLocationAction({ ...validLocationInput, name: 'n'.repeat(201) }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for country under 2 chars', async () => {
    mockCanUpdateSetting();
    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await createMeetupLocationAction({ ...validLocationInput, country: 'X' }))
      .toEqual({ error: 'Invalid input' });
  });

  it('rejects extra (unknown) fields via strict schema', async () => {
    mockCanUpdateSetting();
    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await createMeetupLocationAction({ ...validLocationInput, internalCode: 'XYZ' }))
      .toEqual({ error: 'Invalid input' });
  });

  it('creates location and returns success with id', async () => {
    mockCanUpdateSetting();
    mockDbInsert
      .mockReturnValueOnce(makeInsertReturningChain('loc-new-001'))
      .mockReturnValueOnce(makeInsertChain());

    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    const result = await createMeetupLocationAction(validLocationInput);

    expect(result).toEqual({ success: true, id: 'loc-new-001' });
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
  });

  it('stores addedByStaffId from session in created location', async () => {
    mockCanUpdateSetting();
    const locationChain = makeInsertReturningChain('loc-new-001');
    mockDbInsert
      .mockReturnValueOnce(locationChain)
      .mockReturnValueOnce(makeInsertChain());

    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    await createMeetupLocationAction(validLocationInput);

    const locationValues = locationChain.values.mock.calls[0]![0];
    expect(locationValues.addedByStaffId).toBe('staff-admin-001');
    expect(locationValues.name).toBe(validLocationInput.name);
    expect(locationValues.city).toBe(validLocationInput.city);
  });

  it('creates MEDIUM audit event with CREATE_MEETUP_LOCATION action', async () => {
    mockCanUpdateSetting();
    mockDbInsert
      .mockReturnValueOnce(makeInsertReturningChain('loc-new-001'))
      .mockReturnValueOnce(makeInsertChain());

    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    await createMeetupLocationAction(validLocationInput);

    const auditChain = mockDbInsert.mock.results[1]!.value;
    const auditValues = auditChain.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('CREATE_MEETUP_LOCATION');
    expect(auditValues.severity).toBe('MEDIUM');
    expect(auditValues.subject).toBe('Setting');
    expect(auditValues.subjectId).toBe('loc-new-001');
    expect(auditValues.detailsJson).toEqual({ name: validLocationInput.name, city: validLocationInput.city });
  });

  it('defaults country to US when not provided', async () => {
    mockCanUpdateSetting();
    const locationChain = makeInsertReturningChain('loc-new-002');
    mockDbInsert
      .mockReturnValueOnce(locationChain)
      .mockReturnValueOnce(makeInsertChain());

    const { country: _country, ...withoutCountry } = validLocationInput;
    const { createMeetupLocationAction } = await import('../admin-meetup-locations');
    const result = await createMeetupLocationAction(withoutCountry);

    expect(result).toEqual({ success: true, id: 'loc-new-002' });
    const locationValues = locationChain.values.mock.calls[0]![0];
    expect(locationValues.country).toBe('US');
  });
});
