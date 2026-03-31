import { describe, it, expect, vi, beforeEach } from 'vitest';

// DB mocks
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockDb = { insert: mockInsert, update: mockUpdate, select: mockSelect };

// Auth mocks
const mockAuthorize = vi.fn();
const mockStaffAuthorize = vi.fn();

// Routing/SLA mocks
const mockEvaluateRoutingRules = vi.fn();
const mockCalculateSlaDue = vi.fn();
const mockGenerateCaseNumber = vi.fn();
const mockGetPlatformSetting = vi.fn();

vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn() }));

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize, sub: (...args: unknown[]) => args }));
vi.mock('@twicely/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }));
vi.mock('@/lib/helpdesk/routing', () => ({ evaluateRoutingRules: mockEvaluateRoutingRules }));
vi.mock('@/lib/helpdesk/sla', () => ({ calculateSlaDue: mockCalculateSlaDue }));
vi.mock('@/lib/helpdesk/case-number', () => ({ generateCaseNumber: mockGenerateCaseNumber }));
vi.mock('@/lib/queries/platform-settings', () => ({ getPlatformSetting: mockGetPlatformSetting }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

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
  // Make it thenable for await
  Object.defineProperty(chain, 'then', {
    get() { return (resolve: (v: unknown) => void) => resolve(returnVal); },
  });
  return chain;
}

describe('createCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null });

    const { createCase } = await import('../helpdesk-cases');
    const result = await createCase({
      type: 'SUPPORT',
      subject: 'My order has not arrived',
      description: 'I placed an order three weeks ago and it still has not arrived at my address.',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
  });

  it('returns validation error for invalid type', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const { createCase } = await import('../helpdesk-cases');
    const result = await createCase({
      type: 'CHARGEBACK',
      subject: 'Chargeback case from user',
      description: 'I want to file a chargeback against this seller who sold me a fake item.',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns validation error for short subject', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const { createCase } = await import('../helpdesk-cases');
    const result = await createCase({
      type: 'SUPPORT',
      subject: 'Short',
      description: 'This is my description which is long enough to meet the minimum requirement here.',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('creates case successfully with routing and SLA', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    mockEvaluateRoutingRules.mockResolvedValue({
      assignedTeamId: 'team-general',
      assignedAgentId: null,
      priority: 'NORMAL',
      tags: [],
      category: null,
    });
    mockCalculateSlaDue.mockResolvedValue({
      firstResponseDue: new Date(Date.now() + 8 * 60 * 60 * 1000),
      resolutionDue: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });
    mockGenerateCaseNumber.mockResolvedValue('HD-000001');

    const insertChain = makeChain([{ id: 'case-abc', caseNumber: 'HD-000001' }]);
    const insertEventChain = makeChain([]);
    const insertMsgChain = makeChain([]);

    mockInsert
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(insertMsgChain)
      .mockReturnValueOnce(insertEventChain);

    const { createCase } = await import('../helpdesk-cases');
    const result = await createCase({
      type: 'ORDER',
      subject: 'My order has not arrived after two weeks',
      description: 'I placed order TWC-000123 on March first and it still has not arrived. The tracking shows it left the warehouse but has not moved since then.',
    });

    expect(result.success).toBe(true);
    expect(result.data?.caseNumber).toBe('HD-000001');
  });
});

describe('addUserReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null });

    const { addUserReply } = await import('../helpdesk-cases');
    const result = await addUserReply('case-1', { body: 'My reply message' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
  });

  it('returns not found when case does not exist', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockSelect.mockReturnValue(selectChain);

    const { addUserReply } = await import('../helpdesk-cases');
    const result = await addUserReply('case-no-exist', { body: 'My reply' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('transitions PENDING_USER status to OPEN on reply', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'case-1', requesterId: 'user-1', status: 'PENDING_USER' }]),
    };
    mockSelect.mockReturnValue(selectChain);

    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const { addUserReply } = await import('../helpdesk-cases');
    const result = await addUserReply('case-1', { body: 'Here is my response to the agent.' });

    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'OPEN' })
    );
  });
});
