/**
 * Admin Broadcast Setting Action Tests (I11)
 * Covers updateBroadcastSettingAction authorization, validation, upsert, and audit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  platformSetting: {
    id: 'id', key: 'key', value: 'value',
    updatedByStaffId: 'updated_by_staff_id', updatedAt: 'updated_at',
    type: 'type', category: 'category',
  },
  auditEvent: { id: 'id', action: 'action' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq' })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCanUpdateSetting() {
  const ability = {
    can: vi.fn((action: string, subject: string) => action === 'update' && subject === 'Setting'),
  };
  const session = {
    staffUserId: 'staff-admin-001',
    email: 'admin@twicely.co',
    displayName: 'Admin',
    isPlatformStaff: true as const,
    platformRoles: ['ADMIN'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function makeForbidden() {
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

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
    }),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

// ─── updateBroadcastSettingAction ─────────────────────────────────────────────

describe('updateBroadcastSettingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Forbidden when staff cannot update Setting', async () => {
    makeForbidden();
    const { updateBroadcastSettingAction } = await import('../admin-broadcast');

    const result = await updateBroadcastSettingAction('broadcast.banner', 'hello');

    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns error when key does not start with broadcast.', async () => {
    makeCanUpdateSetting();
    const { updateBroadcastSettingAction } = await import('../admin-broadcast');

    const result = await updateBroadcastSettingAction('general.siteName', 'value');

    expect(result).toEqual({ error: 'Key must start with broadcast.' });
  });

  it('upserts setting (update path) when row exists', async () => {
    makeCanUpdateSetting();
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: 'ps-001', value: 'old' }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { updateBroadcastSettingAction } = await import('../admin-broadcast');

    const result = await updateBroadcastSettingAction('broadcast.banner', 'new value');

    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('inserts setting (insert path) when row does not exist', async () => {
    makeCanUpdateSetting();
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { updateBroadcastSettingAction } = await import('../admin-broadcast');

    const result = await updateBroadcastSettingAction('broadcast.new-key', 'value');

    expect(result).toEqual({ success: true });
    expect(mockDbInsert).toHaveBeenCalledTimes(2); // insert setting + insert auditEvent
  });

  it('writes an audit event on success', async () => {
    makeCanUpdateSetting();
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { updateBroadcastSettingAction } = await import('../admin-broadcast');

    await updateBroadcastSettingAction('broadcast.banner', 'text');

    expect(mockDbInsert).toHaveBeenCalledTimes(2);
  });

  it('calls revalidatePath for /admin-messages', async () => {
    makeCanUpdateSetting();
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { updateBroadcastSettingAction } = await import('../admin-broadcast');
    const { revalidatePath } = await import('next/cache');

    await updateBroadcastSettingAction('broadcast.banner', 'text');

    expect(revalidatePath).toHaveBeenCalledWith('/admin-messages');
  });

  it('returns error on invalid input (empty key)', async () => {
    makeCanUpdateSetting();
    const { updateBroadcastSettingAction } = await import('../admin-broadcast');

    const result = await updateBroadcastSettingAction('', 'value');

    expect(result).toMatchObject({ error: expect.any(String) });
  });
});
