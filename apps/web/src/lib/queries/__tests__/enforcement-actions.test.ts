import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  enforcementAction: {
    id: 'id',
    userId: 'user_id',
    actionType: 'action_type',
    trigger: 'trigger',
    status: 'status',
    reason: 'reason',
    issuedByStaffId: 'issued_by_staff_id',
    expiresAt: 'expires_at',
    createdAt: 'created_at',
  },
  user: { id: 'id', name: 'name' },
}));

import { db } from '@twicely/db';
import {
  getEnforcementActions,
  getEnforcementActionById,
  getActiveEnforcementForUser,
  getEnforcementHistory,
  getEnforcementKPIs,
} from '../enforcement-actions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockDbSelect = vi.mocked(db.select);

function makeListChain(rows: unknown[], countRow: { count: number }) {
  const countChain = {
    from: vi.fn(),
    where: vi.fn().mockResolvedValue([countRow]),
  };
  countChain.from.mockReturnValue(countChain);

  const listChain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn().mockResolvedValue(rows),
  };
  listChain.from.mockReturnValue(listChain);
  listChain.where.mockReturnValue(listChain);
  listChain.orderBy.mockReturnValue(listChain);
  listChain.limit.mockReturnValue(listChain);

  const userChain = {
    from: vi.fn(),
    where: vi.fn().mockResolvedValue([{ id: 'user-001', name: 'Bob' }]),
  };
  userChain.from.mockReturnValue(userChain);

  return { countChain, listChain, userChain };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getEnforcementActions', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns paginated results filtered by user and status', async () => {
    const mockAction = {
      id: 'action-001',
      userId: 'user-001',
      actionType: 'WARNING',
      trigger: 'ADMIN_MANUAL',
      status: 'ACTIVE',
      reason: 'Test reason',
      issuedByStaffId: 'staff-001',
      expiresAt: null,
      createdAt: new Date(),
    };

    const { countChain, listChain, userChain } = makeListChain([mockAction], { count: 1 });

    mockDbSelect
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(listChain as never)
      .mockReturnValueOnce(userChain as never);

    const result = await getEnforcementActions('user-001', 'ACTIVE', 1, 10);

    expect(result.total).toBe(1);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.userName).toBe('Bob');
  });

  it('returns all results when filters are null', async () => {
    const { countChain, listChain, userChain } = makeListChain([], { count: 0 });

    mockDbSelect
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(listChain as never)
      .mockReturnValueOnce(userChain as never);

    const result = await getEnforcementActions(null, null, 1, 10);

    expect(result.total).toBe(0);
    expect(result.actions).toHaveLength(0);
  });
});

describe('getEnforcementActionById', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns full action with user info', async () => {
    const mockAction = {
      id: 'action-001',
      userId: 'user-001',
      actionType: 'RESTRICTION',
      trigger: 'POLICY_VIOLATION',
      status: 'ACTIVE',
      reason: 'Repeated violations',
      issuedByStaffId: 'staff-001',
      details: {},
      expiresAt: null,
      liftedAt: null,
      liftedByStaffId: null,
      liftedReason: null,
      contentReportId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const chain = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([mockAction]),
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);

    mockDbSelect.mockReturnValue(chain as never);

    const result = await getEnforcementActionById('action-001');

    expect(result).not.toBeNull();
    expect(result?.actionType).toBe('RESTRICTION');
  });

  it('returns null for non-existent action', async () => {
    const chain = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([]),
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);

    mockDbSelect.mockReturnValue(chain as never);

    const result = await getEnforcementActionById('non-existent');

    expect(result).toBeNull();
  });
});

describe('getActiveEnforcementForUser', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns only ACTIVE actions for a user', async () => {
    const chain = {
      from: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn().mockResolvedValue([
        { id: 'action-001', userId: 'user-001', actionType: 'WARNING', status: 'ACTIVE' },
      ]),
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);

    mockDbSelect.mockReturnValue(chain as never);

    const result = await getActiveEnforcementForUser('user-001');

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('ACTIVE');
  });
});

describe('getEnforcementHistory', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns all actions for a user regardless of status', async () => {
    const chain = {
      from: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn().mockResolvedValue([
        { id: 'action-001', status: 'ACTIVE' },
        { id: 'action-002', status: 'LIFTED' },
      ]),
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);

    mockDbSelect.mockReturnValue(chain as never);

    const result = await getEnforcementHistory('user-001');

    expect(result).toHaveLength(2);
  });
});

describe('getEnforcementKPIs', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns correct counts for active warnings, restrictions, suspensions', async () => {
    mockDbSelect
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 3 }]) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 1 }]) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 2 }]) }) } as never);

    const result = await getEnforcementKPIs();

    expect(result.activeWarnings).toBe(3);
    expect(result.activeRestrictions).toBe(1);
    expect(result.activeSuspensions).toBe(2);
  });
});
