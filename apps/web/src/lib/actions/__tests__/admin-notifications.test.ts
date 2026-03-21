import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEMPLATE_ID = 'cm1template0000000000001';
const TEMPLATE_ID_NONE = 'cm1templatenotfound00000';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
vi.mock('@twicely/db', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args) => ({ type: 'and', args })),
}));

vi.mock('@twicely/db/schema', () => ({
  notificationTemplate: {
    id: 'id',
    key: 'key',
    isSystemOnly: 'is_system_only',
    isActive: 'is_active',
  },
  auditEvent: { id: 'id', action: 'action' },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
  };
  ['from', 'where', 'innerJoin', 'leftJoin', 'orderBy', 'limit', 'offset', 'groupBy'].forEach(
    (k) => {
      chain[k] = vi.fn().mockReturnValue(chain);
    },
  );
  return chain;
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

function makeDeleteChain() {
  return { where: vi.fn().mockResolvedValue(undefined) };
}

function mockCanManage() {
  const ability = {
    can: vi.fn((a: string, _s: string) =>
      ['create', 'update', 'delete', 'read'].includes(a),
    ),
  };
  const session = {
    staffUserId: 'staff-001',
    email: 's@hub.co',
    displayName: 'Staff',
    isPlatformStaff: true as const,
    platformRoles: ['ADMIN'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = {
    staffUserId: 'staff-002',
    email: 'f@hub.co',
    displayName: 'F',
    isPlatformStaff: true as const,
    platformRoles: [],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

const VALID_CREATE_INPUT = {
  key: 'order.confirmed',
  name: 'Order Confirmed',
  category: 'orders',
  bodyTemplate: 'Your order has been confirmed.',
  channels: ['EMAIL'],
};

// ─── createNotificationTemplateAction ────────────────────────────────────────

describe('createNotificationTemplateAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Forbidden when CASL denies create on Notification', async () => {
    mockForbidden();
    const { createNotificationTemplateAction } = await import('../admin-notifications');
    expect(await createNotificationTemplateAction(VALID_CREATE_INPUT)).toEqual({
      error: 'Forbidden',
    });
  });

  it('returns Invalid input for missing required fields', async () => {
    mockCanManage();
    const { createNotificationTemplateAction } = await import('../admin-notifications');
    expect(await createNotificationTemplateAction({})).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for key with uppercase letters', async () => {
    mockCanManage();
    const { createNotificationTemplateAction } = await import('../admin-notifications');
    expect(
      await createNotificationTemplateAction({ ...VALID_CREATE_INPUT, key: 'Order.Confirmed' }),
    ).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for key with spaces', async () => {
    mockCanManage();
    const { createNotificationTemplateAction } = await import('../admin-notifications');
    expect(
      await createNotificationTemplateAction({ ...VALID_CREATE_INPUT, key: 'order confirmed' }),
    ).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for empty channels array', async () => {
    mockCanManage();
    const { createNotificationTemplateAction } = await import('../admin-notifications');
    expect(
      await createNotificationTemplateAction({ ...VALID_CREATE_INPUT, channels: [] }),
    ).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields via strict schema', async () => {
    mockCanManage();
    const { createNotificationTemplateAction } = await import('../admin-notifications');
    expect(
      await createNotificationTemplateAction({ ...VALID_CREATE_INPUT, extra: 'bad' }),
    ).toEqual({ error: 'Invalid input' });
  });

  it('returns error when key already exists', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: TEMPLATE_ID }]));
    const { createNotificationTemplateAction } = await import('../admin-notifications');
    const result = await createNotificationTemplateAction(VALID_CREATE_INPUT);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('already exists');
  });

  it('inserts template with correct explicit fields on valid input', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { createNotificationTemplateAction } = await import('../admin-notifications');
    const result = await createNotificationTemplateAction(VALID_CREATE_INPUT);

    expect(result).toHaveProperty('success', true);
    const insertValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(insertValues.key).toBe('order.confirmed');
    expect(insertValues.name).toBe('Order Confirmed');
    expect(insertValues.category).toBe('orders');
    expect(insertValues.channels).toEqual(['EMAIL']);
  });

  it('writes audit event on successful create', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { createNotificationTemplateAction } = await import('../admin-notifications');
    await createNotificationTemplateAction(VALID_CREATE_INPUT);

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[1]![0];
    expect(auditValues.action).toBe('CREATE_NOTIFICATION_TEMPLATE');
    expect(auditValues.severity).toBe('MEDIUM');
    expect(auditValues.subject).toBe('Notification');
    expect(auditValues.actorType).toBe('STAFF');
  });

  it('calls revalidatePath for /notifications', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { revalidatePath } = await import('next/cache');

    const { createNotificationTemplateAction } = await import('../admin-notifications');
    await createNotificationTemplateAction(VALID_CREATE_INPUT);
    expect(revalidatePath).toHaveBeenCalledWith('/notifications');
  });

  it('returns success with templateId', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { createNotificationTemplateAction } = await import('../admin-notifications');
    const result = await createNotificationTemplateAction(VALID_CREATE_INPUT);
    expect(result).toHaveProperty('success', true);
    expect(typeof (result as { templateId: string }).templateId).toBe('string');
  });
});

// ─── updateNotificationTemplateAction ────────────────────────────────────────

describe('updateNotificationTemplateAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Forbidden when CASL denies update', async () => {
    mockForbidden();
    const { updateNotificationTemplateAction } = await import('../admin-notifications');
    expect(await updateNotificationTemplateAction({ templateId: TEMPLATE_ID })).toEqual({
      error: 'Forbidden',
    });
  });

  it('returns Invalid input for missing templateId', async () => {
    mockCanManage();
    const { updateNotificationTemplateAction } = await import('../admin-notifications');
    expect(await updateNotificationTemplateAction({})).toEqual({ error: 'Invalid input' });
  });

  it('returns Not found when templateId does not exist', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const { updateNotificationTemplateAction } = await import('../admin-notifications');
    expect(await updateNotificationTemplateAction({ templateId: TEMPLATE_ID_NONE })).toEqual({
      error: 'Not found',
    });
  });

  it('updates only provided fields (partial update)', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: TEMPLATE_ID }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { updateNotificationTemplateAction } = await import('../admin-notifications');
    const result = await updateNotificationTemplateAction({
      templateId: TEMPLATE_ID,
      name: 'New Name',
    });

    expect(result).toEqual({ success: true });
    const setFields = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(setFields.name).toBe('New Name');
    expect(setFields.key).toBeUndefined();
  });

  it('always sets updatedAt on update', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: TEMPLATE_ID }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { updateNotificationTemplateAction } = await import('../admin-notifications');
    await updateNotificationTemplateAction({ templateId: TEMPLATE_ID, name: 'Test' });

    const setFields = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(setFields.updatedAt).toBeInstanceOf(Date);
  });

  it('writes audit event on successful update', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: TEMPLATE_ID }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { updateNotificationTemplateAction } = await import('../admin-notifications');
    await updateNotificationTemplateAction({ templateId: TEMPLATE_ID, name: 'Test' });

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('UPDATE_NOTIFICATION_TEMPLATE');
    expect(auditValues.severity).toBe('MEDIUM');
    expect(auditValues.subject).toBe('Notification');
  });

  it('calls revalidatePath for both list and detail pages', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: TEMPLATE_ID }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { revalidatePath } = await import('next/cache');

    const { updateNotificationTemplateAction } = await import('../admin-notifications');
    await updateNotificationTemplateAction({ templateId: TEMPLATE_ID });
    expect(revalidatePath).toHaveBeenCalledWith('/notifications');
    expect(revalidatePath).toHaveBeenCalledWith('/notifications/' + TEMPLATE_ID);
  });
});

// ─── deleteNotificationTemplateAction ────────────────────────────────────────

describe('deleteNotificationTemplateAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Forbidden when CASL denies delete', async () => {
    mockForbidden();
    const { deleteNotificationTemplateAction } = await import('../admin-notifications');
    expect(await deleteNotificationTemplateAction({ templateId: TEMPLATE_ID })).toEqual({
      error: 'Forbidden',
    });
  });

  it('returns Not found when templateId does not exist', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const { deleteNotificationTemplateAction } = await import('../admin-notifications');
    expect(await deleteNotificationTemplateAction({ templateId: TEMPLATE_ID_NONE })).toEqual({
      error: 'Not found',
    });
  });

  it('returns error when template is system-only', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(
      makeSelectChain([{ id: TEMPLATE_ID, isSystemOnly: true }]),
    );
    const { deleteNotificationTemplateAction } = await import('../admin-notifications');
    const result = await deleteNotificationTemplateAction({ templateId: TEMPLATE_ID });
    expect(result).toEqual({ error: 'Cannot delete system-only template' });
  });

  it('deletes template and writes HIGH severity audit event', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(
      makeSelectChain([{ id: TEMPLATE_ID, isSystemOnly: false }]),
    );
    mockDbDelete.mockReturnValue(makeDeleteChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { deleteNotificationTemplateAction } = await import('../admin-notifications');
    const result = await deleteNotificationTemplateAction({ templateId: TEMPLATE_ID });

    expect(result).toEqual({ success: true });
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('DELETE_NOTIFICATION_TEMPLATE');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.subject).toBe('Notification');
  });

  it('calls revalidatePath for /notifications', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValueOnce(
      makeSelectChain([{ id: TEMPLATE_ID, isSystemOnly: false }]),
    );
    mockDbDelete.mockReturnValue(makeDeleteChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { revalidatePath } = await import('next/cache');

    const { deleteNotificationTemplateAction } = await import('../admin-notifications');
    await deleteNotificationTemplateAction({ templateId: TEMPLATE_ID });
    expect(revalidatePath).toHaveBeenCalledWith('/notifications');
  });
});

// ─── toggleNotificationTemplateAction ────────────────────────────────────────

describe('toggleNotificationTemplateAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Forbidden when CASL denies update', async () => {
    mockForbidden();
    const { toggleNotificationTemplateAction } = await import('../admin-notifications');
    expect(
      await toggleNotificationTemplateAction({ templateId: TEMPLATE_ID, isActive: false }),
    ).toEqual({ error: 'Forbidden' });
  });

  it('toggles isActive and writes audit event', async () => {
    mockCanManage();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { toggleNotificationTemplateAction } = await import('../admin-notifications');
    const result = await toggleNotificationTemplateAction({
      templateId: TEMPLATE_ID,
      isActive: false,
    });

    expect(result).toEqual({ success: true });
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('TOGGLE_NOTIFICATION_TEMPLATE');
    expect(auditValues.subject).toBe('Notification');
    expect(auditValues.severity).toBe('MEDIUM');
  });

  it('includes isActive value in audit detailsJson', async () => {
    mockCanManage();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { toggleNotificationTemplateAction } = await import('../admin-notifications');
    await toggleNotificationTemplateAction({ templateId: TEMPLATE_ID, isActive: true });

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.detailsJson).toEqual({ isActive: true });
  });
});
