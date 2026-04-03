import { describe, it, expect, vi, beforeEach } from 'vitest';

// DB mocks
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockDb = { insert: mockInsert, update: mockUpdate, select: mockSelect };

// Auth mocks
const mockAuthorize = vi.fn();
const mockStaffAuthorize = vi.fn();

// Helpers
const mockGetPlatformSetting = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/auth', () => ({ auth: { api: {} } }));
vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize, sub: (...args: unknown[]) => args }));
vi.mock('@twicely/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }));
vi.mock('@/lib/helpdesk/routing', () => ({ evaluateRoutingRules: vi.fn() }));
vi.mock('@/lib/helpdesk/sla', () => ({ calculateSlaDue: vi.fn() }));
vi.mock('@/lib/helpdesk/case-number', () => ({ generateCaseNumber: vi.fn() }));
vi.mock('@/lib/queries/platform-settings', () => ({ getPlatformSetting: mockGetPlatformSetting }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/helpdesk/notify-watchers', () => ({ notifyCaseWatchers: vi.fn().mockResolvedValue(undefined) }));

// Chain builder for Drizzle
function makeChain(returnVal: unknown) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returnVal),
    then: undefined as unknown,
  };
  Object.defineProperty(chain, 'then', {
    get() { return (resolve: (v: unknown) => void) => resolve(returnVal); },
  });
  return chain;
}

describe('updateCaseStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error when not staff', async () => {
    mockStaffAuthorize.mockRejectedValue(new Error('Forbidden'));

    const { updateCaseStatus } = await import('../helpdesk-agent-cases');
    await expect(updateCaseStatus({ caseId: 'cljd4bvd00000wjh07mcy26x', status: 'OPEN' })).rejects.toThrow('Forbidden');
  });

  it('returns not found for nonexistent case', async () => {
    mockStaffAuthorize.mockResolvedValue({ session: { staffUserId: 'staff-1', displayName: 'Agent', platformRoles: ['HELPDESK_AGENT'] }, ability: { can: vi.fn().mockReturnValue(true) } });

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockSelect.mockReturnValue(selectChain);

    const { updateCaseStatus } = await import('../helpdesk-agent-cases');
    const result = await updateCaseStatus({ caseId: 'cljd4bvd00000wjh07mcy26x', status: 'RESOLVED' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('sets resolvedAt when status is RESOLVED', async () => {
    mockStaffAuthorize.mockResolvedValue({ session: { staffUserId: 'staff-1', displayName: 'Agent', platformRoles: ['HELPDESK_AGENT'] }, ability: { can: vi.fn().mockReturnValue(true) } });

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'cljd4bvd00000wjh07mcy26x', status: 'OPEN' }]),
    };
    mockSelect.mockReturnValue(selectChain);

    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const { updateCaseStatus } = await import('../helpdesk-agent-cases');
    await updateCaseStatus({ caseId: 'cljd4bvd00000wjh07mcy26x', status: 'RESOLVED' });

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ resolvedAt: expect.any(Date) })
    );
  });
});

describe('reopenCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('fails when case is not RESOLVED', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ requesterId: 'user-1', status: 'OPEN', resolvedAt: null }]),
    };
    mockSelect.mockReturnValue(selectChain);

    const { reopenCase } = await import('../helpdesk-cases');
    const result = await reopenCase('case-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not in RESOLVED');
  });

  it('fails when reopen window has expired', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ requesterId: 'user-1', status: 'RESOLVED', resolvedAt: oldDate }]),
    };
    mockSelect.mockReturnValue(selectChain);
    mockGetPlatformSetting.mockResolvedValue(7);

    const { reopenCase } = await import('../helpdesk-cases');
    const result = await reopenCase('case-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('succeeds when within reopen window', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ requesterId: 'user-1', status: 'RESOLVED', resolvedAt: recentDate }]),
    };
    mockSelect.mockReturnValue(selectChain);
    mockGetPlatformSetting.mockResolvedValue(7);

    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const { reopenCase } = await import('../helpdesk-cases');
    const result = await reopenCase('case-1');
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'OPEN' })
    );
  });
});
