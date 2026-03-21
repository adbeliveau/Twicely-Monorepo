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

// ─── toggleMeetupLocationAction ───────────────────────────────────────────────

describe('toggleMeetupLocationAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies update on Setting', async () => {
    mockForbidden();
    const { toggleMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await toggleMeetupLocationAction({ locationId: 'loc-1', isActive: false }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing locationId', async () => {
    mockCanUpdateSetting();
    const { toggleMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await toggleMeetupLocationAction({ isActive: true })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for non-boolean isActive', async () => {
    mockCanUpdateSetting();
    const { toggleMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await toggleMeetupLocationAction({ locationId: 'loc-1', isActive: 'yes' }))
      .toEqual({ error: 'Invalid input' });
  });

  it('rejects extra (unknown) fields via strict schema', async () => {
    mockCanUpdateSetting();
    const { toggleMeetupLocationAction } = await import('../admin-meetup-locations');
    expect(await toggleMeetupLocationAction({ locationId: 'loc-1', isActive: true, extra: 'bad' }))
      .toEqual({ error: 'Invalid input' });
  });

  it('activates location and creates ACTIVATE_MEETUP_LOCATION audit event', async () => {
    mockCanUpdateSetting();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValue(auditChain);

    const { toggleMeetupLocationAction } = await import('../admin-meetup-locations');
    const result = await toggleMeetupLocationAction({ locationId: 'loc-1', isActive: true });

    expect(result).toEqual({ success: true });
    const auditValues = auditChain.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('ACTIVATE_MEETUP_LOCATION');
    expect(auditValues.severity).toBe('MEDIUM');
    expect(auditValues.subjectId).toBe('loc-1');
    expect(auditValues.actorType).toBe('STAFF');
    expect(auditValues.actorId).toBe('staff-admin-001');
  });

  it('deactivates location and creates DEACTIVATE_MEETUP_LOCATION audit event', async () => {
    mockCanUpdateSetting();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValue(auditChain);

    const { toggleMeetupLocationAction } = await import('../admin-meetup-locations');
    const result = await toggleMeetupLocationAction({ locationId: 'loc-2', isActive: false });

    expect(result).toEqual({ success: true });
    const auditValues = auditChain.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('DEACTIVATE_MEETUP_LOCATION');
    expect(auditValues.severity).toBe('MEDIUM');
    expect(auditValues.subjectId).toBe('loc-2');
  });

  it('updates isActive and updatedAt on the location record', async () => {
    mockCanUpdateSetting();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { toggleMeetupLocationAction } = await import('../admin-meetup-locations');
    await toggleMeetupLocationAction({ locationId: 'loc-1', isActive: false });

    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.isActive).toBe(false);
    expect(updateSet.updatedAt).toBeInstanceOf(Date);
  });

  it('sets isActive to true when activating', async () => {
    mockCanUpdateSetting();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { toggleMeetupLocationAction } = await import('../admin-meetup-locations');
    await toggleMeetupLocationAction({ locationId: 'loc-3', isActive: true });

    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.isActive).toBe(true);
  });

  it('uses session staffUserId as actorId in audit event', async () => {
    mockCanUpdateSetting();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValue(auditChain);

    const { toggleMeetupLocationAction } = await import('../admin-meetup-locations');
    await toggleMeetupLocationAction({ locationId: 'loc-4', isActive: true });

    const auditValues = auditChain.values.mock.calls[0]![0];
    expect(auditValues.actorId).toBe('staff-admin-001');
    expect(auditValues.subject).toBe('Setting');
  });
});
