import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  platformSetting: {
    id: 'id', key: 'key', value: 'value', type: 'type', category: 'category',
    description: 'description', isSecret: 'is_secret', updatedAt: 'updated_at',
    updatedByStaffId: 'updated_by_staff_id',
  },
  platformSettingHistory: {
    id: 'id', settingId: 'setting_id', previousValue: 'previous_value',
    newValue: 'new_value', changedByStaffId: 'changed_by_staff_id',
    reason: 'reason', createdAt: 'created_at',
  },
  auditEvent: {
    id: 'id', actorType: 'actor_type', actorId: 'actor_id', action: 'action',
    subject: 'subject', subjectId: 'subject_id', severity: 'severity',
    detailsJson: 'details_json', createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (_col: unknown, _val: unknown) => ({ type: 'eq' }),
  asc: (_col: unknown) => ({ type: 'asc' }),
  desc: (_col: unknown) => ({ type: 'desc' }),
  inArray: (_col: unknown, _vals: unknown) => ({ type: 'inArray' }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectFrom(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function makeSelectFromWhereLimit(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function makeJoinChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
      }),
    }),
  };
}

function makeSelectFromWhereEq(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

// ─── getSettingsByKeys ────────────────────────────────────────────────────────

describe('getSettingsByKeys', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty array for empty keys input', async () => {
    const { getSettingsByKeys } = await import('../admin-settings');
    const result = await getSettingsByKeys([]);
    expect(result).toEqual([]);
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('returns SettingRow array for matching keys', async () => {
    const rows = [
      { id: 's1', key: 'general.siteName', value: 'Twicely', type: 'string', category: 'general', description: null, isSecret: false, updatedAt: new Date() },
    ];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(rows) }),
      }),
    });
    const { getSettingsByKeys } = await import('../admin-settings');
    const result = await getSettingsByKeys(['general.siteName']);
    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe('general.siteName');
  });
});

// ─── getSettingHistory ────────────────────────────────────────────────────────

describe('getSettingHistory', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns history entries for a setting', async () => {
    const rows = [
      { id: 'h1', settingId: 's1', previousValue: 'old', newValue: 'new', changedByStaffId: 'staff-1', reason: 'test', createdAt: new Date() },
    ];
    mockDbSelect.mockReturnValue(makeSelectFromWhereLimit(rows));

    const { getSettingHistory } = await import('../admin-settings');
    const result = await getSettingHistory('s1');
    expect(result).toHaveLength(1);
    expect(result[0]!.settingId).toBe('s1');
  });

  it('returns empty array when no history exists', async () => {
    mockDbSelect.mockReturnValue(makeSelectFromWhereLimit([]));

    const { getSettingHistory } = await import('../admin-settings');
    const result = await getSettingHistory('s-missing');
    expect(result).toHaveLength(0);
  });
});

// ─── getSettingHistoryAction ──────────────────────────────────────────────────

describe('getSettingHistoryAction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns up to 20 history entries', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `h${i}`, settingId: 's1', previousValue: i, newValue: i + 1,
      changedByStaffId: 'staff-1', reason: null, createdAt: new Date(),
    }));
    mockDbSelect.mockReturnValue(makeSelectFromWhereLimit(rows));

    const { getSettingHistoryAction } = await import('../admin-settings');
    const result = await getSettingHistoryAction('s1');
    expect(result).toHaveLength(5);
  });
});

// ─── getRecentAuditEvents ─────────────────────────────────────────────────────

describe('getRecentAuditEvents', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns audit events filtered by subject', async () => {
    const rows = [
      { id: 'ae1', actorType: 'STAFF', actorId: 'staff-1', action: 'UPDATE_PROVIDER_CONFIG', subject: 'ProviderInstance', subjectId: 'inst-1', severity: 'HIGH', detailsJson: {}, createdAt: new Date() },
    ];
    mockDbSelect.mockReturnValue(makeSelectFromWhereEq(rows));

    const { getRecentAuditEvents } = await import('../admin-settings');
    const result = await getRecentAuditEvents({ actionPrefix: 'ProviderInstance', limit: 5 });
    expect(result).toHaveLength(1);
    expect(result[0]!.subject).toBe('ProviderInstance');
  });

  it('returns empty array when no events match', async () => {
    mockDbSelect.mockReturnValue(makeSelectFromWhereEq([]));

    const { getRecentAuditEvents } = await import('../admin-settings');
    const result = await getRecentAuditEvents({ actionPrefix: 'NoMatch', limit: 5 });
    expect(result).toHaveLength(0);
  });
});

// ─── getSettingsOverview ──────────────────────────────────────────────────────

describe('getSettingsOverview', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns totalSettings count from all settings', async () => {
    const allSettingsRows = [
      { id: 's1', key: 'general.siteName', value: 'Twicely', type: 'string', category: 'general', description: null, isSecret: false, updatedAt: new Date() },
      { id: 's2', key: 'fees.insertion.NONE', value: 0, type: 'cents', category: 'fees', description: null, isSecret: false, updatedAt: new Date() },
    ];
    const historyRows = [
      { id: 'h1', settingId: 's1', previousValue: 'Old', newValue: 'Twicely', changedByStaffId: 'staff-1', reason: 'Update', createdAt: new Date(), settingKey: 'general.siteName' },
    ];
    // First call: getAll settings; second call: join query
    mockDbSelect
      .mockReturnValueOnce(makeSelectFrom(allSettingsRows))
      .mockReturnValueOnce(makeJoinChain(historyRows));

    const { getSettingsOverview } = await import('../admin-settings');
    const result = await getSettingsOverview();
    expect(result.totalSettings).toBe(2);
  });

  it('returns recentChanges from platformSettingHistory', async () => {
    const historyRows = [
      { id: 'h1', settingId: 's1', previousValue: 100, newValue: 200, changedByStaffId: 'staff-1', reason: 'Raise limit', createdAt: new Date(), settingKey: 'fees.insertion.NONE' },
    ];
    mockDbSelect
      .mockReturnValueOnce(makeSelectFrom([]))
      .mockReturnValueOnce(makeJoinChain(historyRows));

    const { getSettingsOverview } = await import('../admin-settings');
    const result = await getSettingsOverview();
    expect(result.recentChanges).toHaveLength(1);
    expect(result.recentChanges[0]!.settingKey).toBe('fees.insertion.NONE');
  });

  it('returns empty recentChanges when no history', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectFrom([]))
      .mockReturnValueOnce(makeJoinChain([]));

    const { getSettingsOverview } = await import('../admin-settings');
    const result = await getSettingsOverview();
    expect(result.recentChanges).toHaveLength(0);
    expect(result.customizedSettings).toBe(0);
  });
});
