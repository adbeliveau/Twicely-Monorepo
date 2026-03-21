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
  db: { select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

vi.mock('@twicely/db/schema', () => ({
  order: { id: 'id', status: 'status', buyerId: 'buyer_id', totalCents: 'total_cents' },
  ledgerEntry: { id: 'id', type: 'type' },
  auditEvent: { id: 'id', action: 'action' },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
    }),
  };
}

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function mockCanUpdate() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'update' && s === 'Order') };
  const session = { staffUserId: 'staff-test-001', email: 'a@b.co', displayName: 'A', isPlatformStaff: true as const, platformRoles: [] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockCanManage() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'manage' && s === 'Order') };
  const session = { staffUserId: 'staff-test-001', email: 'a@b.co', displayName: 'A', isPlatformStaff: true as const, platformRoles: ['ADMIN'] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = { staffUserId: 'staff-test-001', email: 'a@b.co', displayName: 'A', isPlatformStaff: true as const, platformRoles: [] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

// ─── refundOrderAction ────────────────────────────────────────────────────────

describe('refundOrderAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies update on Order', async () => {
    mockForbidden();
    const { refundOrderAction } = await import('../admin-orders');
    expect(await refundOrderAction({ orderId: 'ord-1', amountCents: 1000, reason: 'r', isPartial: false }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing orderId', async () => {
    mockCanUpdate();
    const { refundOrderAction } = await import('../admin-orders');
    expect(await refundOrderAction({ amountCents: 1000, reason: 'r', isPartial: false }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for non-integer amountCents', async () => {
    mockCanUpdate();
    const { refundOrderAction } = await import('../admin-orders');
    expect(await refundOrderAction({ orderId: 'ord-1', amountCents: 9.99, reason: 'r', isPartial: false }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for non-positive amountCents', async () => {
    mockCanUpdate();
    const { refundOrderAction } = await import('../admin-orders');
    expect(await refundOrderAction({ orderId: 'ord-1', amountCents: 0, reason: 'r', isPartial: false }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for extra (unknown) fields', async () => {
    mockCanUpdate();
    const { refundOrderAction } = await import('../admin-orders');
    expect(await refundOrderAction({ orderId: 'ord-1', amountCents: 500, reason: 'r', isPartial: false, extra: 'bad' }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Not found when order does not exist', async () => {
    mockCanUpdate();
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { refundOrderAction } = await import('../admin-orders');
    expect(await refundOrderAction({ orderId: 'ord-missing', amountCents: 500, reason: 'r', isPartial: false }))
      .toEqual({ error: 'Not found' });
  });

  it('creates ledger entry with negative amount and sets order REFUNDED for full refund', async () => {
    mockCanUpdate();
    const orderRow = { id: 'ord-1', buyerId: 'buyer-001', status: 'DELIVERED', totalCents: 5000 };
    mockDbSelect.mockReturnValue(makeSelectChain([orderRow]));
    const ledgerChain = makeInsertChain();
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(ledgerChain).mockReturnValueOnce(auditChain);
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { refundOrderAction } = await import('../admin-orders');
    const result = await refundOrderAction({ orderId: 'ord-1', amountCents: 5000, reason: 'Buyer claim', isPartial: false });

    expect(result).toEqual({ success: true });
    // Ledger entry insert
    const firstInsert = ledgerChain.values.mock.calls[0]![0];
    expect(firstInsert.type).toBe('REFUND_FULL');
    expect(firstInsert.amountCents).toBe(-5000);
    expect(firstInsert.userId).toBe('buyer-001');
    expect(firstInsert.reasonCode).toBe('ADMIN_REFUND');
    // Order status update should happen for full refund
    expect(mockDbUpdate).toHaveBeenCalled();
    // Audit event insert
    const auditInsert = auditChain.values.mock.calls[0]![0];
    expect(auditInsert.action).toBe('FULL_REFUND');
    expect(auditInsert.severity).toBe('HIGH');
  });

  it('does NOT update order status for partial refund', async () => {
    mockCanUpdate();
    const orderRow = { id: 'ord-1', buyerId: 'buyer-001', status: 'DELIVERED', totalCents: 5000 };
    mockDbSelect.mockReturnValue(makeSelectChain([orderRow]));
    const ledgerChain = makeInsertChain();
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(ledgerChain).mockReturnValueOnce(auditChain);

    const { refundOrderAction } = await import('../admin-orders');
    const result = await refundOrderAction({ orderId: 'ord-1', amountCents: 2500, reason: 'Partial refund', isPartial: true });

    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).not.toHaveBeenCalled();
    const auditInsert = auditChain.values.mock.calls[0]![0];
    expect(auditInsert.action).toBe('PARTIAL_REFUND');
  });
});

// ─── cancelOrderAction ────────────────────────────────────────────────────────

describe('cancelOrderAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { cancelOrderAction } = await import('../admin-orders');
    expect(await cancelOrderAction({ orderId: 'ord-1', reason: 'fraud' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for empty reason', async () => {
    mockCanUpdate();
    const { cancelOrderAction } = await import('../admin-orders');
    expect(await cancelOrderAction({ orderId: 'ord-1', reason: '' })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for reason over 500 chars', async () => {
    mockCanUpdate();
    const { cancelOrderAction } = await import('../admin-orders');
    expect(await cancelOrderAction({ orderId: 'ord-1', reason: 'x'.repeat(501) })).toEqual({ error: 'Invalid input' });
  });

  it('cancels order and creates CANCEL_ORDER audit event', async () => {
    mockCanUpdate();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { cancelOrderAction } = await import('../admin-orders');
    const result = await cancelOrderAction({ orderId: 'ord-1', reason: 'Suspicious activity' });

    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('CANCEL_ORDER');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.subjectId).toBe('ord-1');
    expect(auditValues.detailsJson).toEqual({ reason: 'Suspicious activity' });
  });
});

// ─── overrideOrderStatusAction ────────────────────────────────────────────────

describe('overrideOrderStatusAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies manage on Order (only ADMIN can override)', async () => {
    mockForbidden();
    const { overrideOrderStatusAction } = await import('../admin-orders');
    expect(await overrideOrderStatusAction({ orderId: 'ord-1', newStatus: 'DELIVERED', reason: 'fix' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('also denied when caller has update but not manage', async () => {
    mockCanUpdate(); // only 'update', not 'manage'
    const { overrideOrderStatusAction } = await import('../admin-orders');
    expect(await overrideOrderStatusAction({ orderId: 'ord-1', newStatus: 'DELIVERED', reason: 'fix' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing newStatus', async () => {
    mockCanManage();
    const { overrideOrderStatusAction } = await import('../admin-orders');
    expect(await overrideOrderStatusAction({ orderId: 'ord-1', reason: 'fix' })).toEqual({ error: 'Invalid input' });
  });

  it('returns Not found when order does not exist', async () => {
    mockCanManage();
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { overrideOrderStatusAction } = await import('../admin-orders');
    expect(await overrideOrderStatusAction({ orderId: 'ord-missing', newStatus: 'DELIVERED', reason: 'fix' }))
      .toEqual({ error: 'Not found' });
  });

  it('overrides status and creates CRITICAL audit event', async () => {
    mockCanManage();
    const order = { id: 'ord-1', status: 'SHIPPED', buyerId: 'buyer-001', totalCents: 3000 };
    mockDbSelect.mockReturnValue(makeSelectChain([order]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { overrideOrderStatusAction } = await import('../admin-orders');
    const result = await overrideOrderStatusAction({ orderId: 'ord-1', newStatus: 'DELIVERED', reason: 'Manual confirmation' });

    expect(result).toEqual({ success: true });
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('OVERRIDE_ORDER_STATUS');
    expect(auditValues.severity).toBe('CRITICAL');
    expect(auditValues.detailsJson.previousStatus).toBe('SHIPPED');
    expect(auditValues.detailsJson.newStatus).toBe('DELIVERED');
    expect(auditValues.detailsJson.reason).toBe('Manual confirmation');
  });
});
