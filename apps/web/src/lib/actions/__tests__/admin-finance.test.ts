import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbInsert = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { insert: mockDbInsert },
}));

vi.mock('@twicely/db/schema', () => ({
  ledgerEntry: { id: 'id', type: 'type' },
  auditEvent: { id: 'id', action: 'action' },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockCanManage() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'manage' && s === 'LedgerEntry') };
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

// ─── createManualAdjustmentAction — auth + validation ─────────────────────────

describe('createManualAdjustmentAction — auth and validation', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when caller lacks manage on LedgerEntry', async () => {
    mockForbidden();
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      userId: 'user-abc', amountCents: 500, type: 'MANUAL_CREDIT',
      reasonCode: 'GOODWILL_CREDIT', reasonText: 'Sorry',
    })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing userId', async () => {
    mockCanManage();
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      amountCents: 500, type: 'MANUAL_CREDIT', reasonCode: 'GOODWILL_CREDIT', reasonText: 'credit',
    })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for non-integer amountCents', async () => {
    mockCanManage();
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      userId: 'user-abc', amountCents: 4.50, type: 'MANUAL_CREDIT',
      reasonCode: 'GOODWILL_CREDIT', reasonText: 'credit',
    })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for zero amountCents (must be positive)', async () => {
    mockCanManage();
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      userId: 'user-abc', amountCents: 0, type: 'MANUAL_CREDIT',
      reasonCode: 'GOODWILL_CREDIT', reasonText: 'credit',
    })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for negative amountCents', async () => {
    mockCanManage();
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      userId: 'user-abc', amountCents: -100, type: 'MANUAL_CREDIT',
      reasonCode: 'GOODWILL_CREDIT', reasonText: 'credit',
    })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for invalid type enum', async () => {
    mockCanManage();
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      userId: 'user-abc', amountCents: 500, type: 'MANUAL_BONUS',
      reasonCode: 'GOODWILL_CREDIT', reasonText: 'credit',
    })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for invalid reasonCode enum', async () => {
    mockCanManage();
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      userId: 'user-abc', amountCents: 500, type: 'MANUAL_CREDIT',
      reasonCode: 'INVALID_CODE', reasonText: 'credit',
    })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for empty reasonText', async () => {
    mockCanManage();
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      userId: 'user-abc', amountCents: 500, type: 'MANUAL_CREDIT',
      reasonCode: 'GOODWILL_CREDIT', reasonText: '',
    })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for reasonText over 500 chars', async () => {
    mockCanManage();
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      userId: 'user-abc', amountCents: 500, type: 'MANUAL_CREDIT',
      reasonCode: 'GOODWILL_CREDIT', reasonText: 't'.repeat(501),
    })).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra (unknown) fields via strict schema', async () => {
    mockCanManage();
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      userId: 'user-abc', amountCents: 500, type: 'MANUAL_CREDIT',
      reasonCode: 'GOODWILL_CREDIT', reasonText: 'good', internalNote: 'bad',
    })).toEqual({ error: 'Invalid input' });
  });
});
