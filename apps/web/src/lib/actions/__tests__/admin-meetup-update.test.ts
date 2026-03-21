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

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
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

// ─── updateMeetupLocationAction ───────────────────────────────────────────────

describe('updateMeetupLocationAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies update on Setting', async () => {
    mockForbidden();
    const { updateMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await updateMeetupLocationAction({ locationId: 'loc-1', name: 'New Name' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input when locationId is missing', async () => {
    mockCanUpdateSetting();
    const { updateMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await updateMeetupLocationAction({ name: 'New Name' }))
      .toEqual({ error: 'Invalid input' });
  });

  it('rejects extra (unknown) fields via strict schema', async () => {
    mockCanUpdateSetting();
    const { updateMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await updateMeetupLocationAction({ locationId: 'loc-1', hackerField: 'bad' }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns success when only locationId is provided (no fields to update)', async () => {
    mockCanUpdateSetting();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { updateMeetupLocationAction } = await import('../admin-meetup-locations');
    const result = await updateMeetupLocationAction({ locationId: 'loc-1' });

    expect(result).toEqual({ success: true });
  });

  it('updates provided fields and sets updatedAt', async () => {
    mockCanUpdateSetting();
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { updateMeetupLocationAction } = await import('../admin-meetup-locations');
    await updateMeetupLocationAction({ locationId: 'loc-1', name: 'New Name', city: 'Houston' });

    const setCall = updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setCall.name).toBe('New Name');
    expect(setCall.city).toBe('Houston');
    expect(setCall.updatedAt).toBeInstanceOf(Date);
  });

  it('creates UPDATE_MEETUP_LOCATION audit event with MEDIUM severity', async () => {
    mockCanUpdateSetting();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValue(auditChain);

    const { updateMeetupLocationAction } = await import('../admin-meetup-locations');
    await updateMeetupLocationAction({ locationId: 'loc-5', name: 'Updated Name' });

    const auditValues = auditChain.values.mock.calls[0]![0] as Record<string, unknown>;
    expect(auditValues.action).toBe('UPDATE_MEETUP_LOCATION');
    expect(auditValues.severity).toBe('MEDIUM');
    expect(auditValues.subject).toBe('Setting');
    expect(auditValues.subjectId).toBe('loc-5');
    expect(auditValues.actorType).toBe('STAFF');
  });

  it('uses session staffUserId as actorId in audit event', async () => {
    mockCanUpdateSetting();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValue(auditChain);

    const { updateMeetupLocationAction } = await import('../admin-meetup-locations');
    await updateMeetupLocationAction({ locationId: 'loc-7', verifiedSafe: true });

    const auditValues = auditChain.values.mock.calls[0]![0] as Record<string, unknown>;
    expect(auditValues.actorId).toBe('staff-admin-001');
  });

  it('does not include undefined optional fields in the update set', async () => {
    mockCanUpdateSetting();
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { updateMeetupLocationAction } = await import('../admin-meetup-locations');
    await updateMeetupLocationAction({ locationId: 'loc-1', state: 'CA' });

    const setCall = updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setCall.state).toBe('CA');
    expect(setCall.name).toBeUndefined();
    expect(setCall.city).toBeUndefined();
    expect(setCall.address).toBeUndefined();
  });
});
