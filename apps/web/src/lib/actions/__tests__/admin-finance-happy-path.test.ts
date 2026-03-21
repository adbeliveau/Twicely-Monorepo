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

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

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

// ─── createManualAdjustmentAction — happy path + audit ───────────────────────

describe('createManualAdjustmentAction — happy path', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('creates POSTED ledger entry with positive amount for MANUAL_CREDIT', async () => {
    mockCanManage();
    const ledgerChain = makeInsertChain();
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(ledgerChain).mockReturnValueOnce(auditChain);

    const { createManualAdjustmentAction } = await import('../admin-finance');
    const result = await createManualAdjustmentAction({
      userId: 'user-abc',
      amountCents: 1000,
      type: 'MANUAL_CREDIT',
      reasonCode: 'GOODWILL_CREDIT',
      reasonText: 'Compensation for delay',
    });

    expect(result).toEqual({ success: true });
    expect(mockDbInsert).toHaveBeenCalledTimes(2);

    const ledgerValues = ledgerChain.values.mock.calls[0]![0];
    expect(ledgerValues.type).toBe('MANUAL_CREDIT');
    expect(ledgerValues.status).toBe('POSTED');
    expect(ledgerValues.amountCents).toBe(1000);
    expect(ledgerValues.currency).toBe('USD');
    expect(ledgerValues.userId).toBe('user-abc');
    expect(ledgerValues.createdByStaffId).toBe('staff-admin-001');
    expect(ledgerValues.reasonCode).toBe('GOODWILL_CREDIT');
    expect(ledgerValues.memo).toBe('Compensation for delay');
    expect(ledgerValues.postedAt).toBeInstanceOf(Date);
  });

  it('stores negative amountCents for MANUAL_DEBIT', async () => {
    mockCanManage();
    const ledgerChain = makeInsertChain();
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(ledgerChain).mockReturnValueOnce(auditChain);

    const { createManualAdjustmentAction } = await import('../admin-finance');
    const result = await createManualAdjustmentAction({
      userId: 'user-abc',
      amountCents: 500,
      type: 'MANUAL_DEBIT',
      reasonCode: 'ERROR_CORRECTION',
      reasonText: 'Duplicate credit reversal',
    });

    expect(result).toEqual({ success: true });
    const ledgerValues = ledgerChain.values.mock.calls[0]![0];
    expect(ledgerValues.amountCents).toBe(-500);
    expect(ledgerValues.type).toBe('MANUAL_DEBIT');
  });

  it('creates CRITICAL audit event for MANUAL_ADJUSTMENT', async () => {
    mockCanManage();
    const ledgerChain = makeInsertChain();
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(ledgerChain).mockReturnValueOnce(auditChain);

    const { createManualAdjustmentAction } = await import('../admin-finance');
    await createManualAdjustmentAction({
      userId: 'user-abc',
      amountCents: 750,
      type: 'MANUAL_CREDIT',
      reasonCode: 'PROMOTIONAL',
      reasonText: 'Referral bonus',
    });

    const auditValues = auditChain.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('MANUAL_ADJUSTMENT');
    expect(auditValues.severity).toBe('CRITICAL');
    expect(auditValues.subject).toBe('LedgerEntry');
    expect(auditValues.subjectId).toBe('user-abc');
    expect(auditValues.actorType).toBe('STAFF');
    expect(auditValues.actorId).toBe('staff-admin-001');
    expect(auditValues.detailsJson.amountCents).toBe(750);
    expect(auditValues.detailsJson.type).toBe('MANUAL_CREDIT');
    expect(auditValues.detailsJson.reasonCode).toBe('PROMOTIONAL');
  });

  it('accepts GOODWILL_CREDIT reasonCode', async () => {
    mockCanManage();
    mockDbInsert.mockReturnValueOnce(makeInsertChain()).mockReturnValueOnce(makeInsertChain());
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      userId: 'u', amountCents: 100, type: 'MANUAL_CREDIT', reasonCode: 'GOODWILL_CREDIT', reasonText: 'ok',
    })).toEqual({ success: true });
  });

  it('accepts ERROR_CORRECTION reasonCode', async () => {
    mockCanManage();
    mockDbInsert.mockReturnValueOnce(makeInsertChain()).mockReturnValueOnce(makeInsertChain());
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      userId: 'u', amountCents: 100, type: 'MANUAL_CREDIT', reasonCode: 'ERROR_CORRECTION', reasonText: 'ok',
    })).toEqual({ success: true });
  });

  it('accepts PROMOTIONAL reasonCode', async () => {
    mockCanManage();
    mockDbInsert.mockReturnValueOnce(makeInsertChain()).mockReturnValueOnce(makeInsertChain());
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      userId: 'u', amountCents: 100, type: 'MANUAL_CREDIT', reasonCode: 'PROMOTIONAL', reasonText: 'ok',
    })).toEqual({ success: true });
  });

  it('accepts OTHER reasonCode', async () => {
    mockCanManage();
    mockDbInsert.mockReturnValueOnce(makeInsertChain()).mockReturnValueOnce(makeInsertChain());
    const { createManualAdjustmentAction } = await import('../admin-finance');
    expect(await createManualAdjustmentAction({
      userId: 'u', amountCents: 100, type: 'MANUAL_CREDIT', reasonCode: 'OTHER', reasonText: 'ok',
    })).toEqual({ success: true });
  });

  it('uses actorId from session in ledger entry', async () => {
    mockCanManage();
    const ledgerChain = makeInsertChain();
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(ledgerChain).mockReturnValueOnce(auditChain);

    const { createManualAdjustmentAction } = await import('../admin-finance');
    await createManualAdjustmentAction({
      userId: 'user-xyz',
      amountCents: 200,
      type: 'MANUAL_DEBIT',
      reasonCode: 'OTHER',
      reasonText: 'Manual debit',
    });

    const ledgerValues = ledgerChain.values.mock.calls[0]![0];
    expect(ledgerValues.createdByStaffId).toBe('staff-admin-001');
    expect(ledgerValues.userId).toBe('user-xyz');
  });
});
