import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockDb = { insert: mockInsert, update: mockUpdate, select: mockSelect };
const mockStaffAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }));
vi.mock('@/lib/helpdesk/sla', () => ({ calculateSlaDue: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const CASE_ID = 'cljd4bvd00000wjh07mcy26x';

function makeChain(returnVal: unknown) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnVal),
    returning: vi.fn().mockResolvedValue(returnVal),
  };
  Object.defineProperty(chain, 'then', {
    get() { return (res: (v: unknown) => void) => Promise.resolve(returnVal).then(res); },
  });
  return chain;
}

function makeStaffSession() {
  return {
    session: {
      staffUserId: 'staff-test-001',
      displayName: 'Test Agent',
      email: 'agent@twicely.co',
      isPlatformStaff: true as const,
      platformRoles: ['HELPDESK_AGENT' as const],
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

describe('addAgentReply — NEW to OPEN status transition', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('transitions NEW case to OPEN on outbound reply', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: CASE_ID, firstResponseAt: null, requesterId: 'user-1', status: 'NEW' }]),
    };
    mockSelect.mockReturnValue(selectChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const { addAgentReply } = await import('../helpdesk-agent-cases');
    const result = await addAgentReply({ caseId: CASE_ID, body: 'First reply to new case', isInternal: false });
    expect(result.success).toBe(true);
    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg?.status).toBe('OPEN');
  });

  it('does NOT transition NEW case to OPEN on internal note', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: CASE_ID, firstResponseAt: null, requesterId: 'user-1', status: 'NEW' }]),
    };
    mockSelect.mockReturnValue(selectChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const { addAgentReply } = await import('../helpdesk-agent-cases');
    await addAgentReply({ caseId: CASE_ID, body: 'Internal note only', isInternal: true });
    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg?.status).toBeUndefined();
  });

  it('does NOT transition OPEN case status on outbound reply', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: CASE_ID, firstResponseAt: new Date(), requesterId: 'user-1', status: 'OPEN' }]),
    };
    mockSelect.mockReturnValue(selectChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const { addAgentReply } = await import('../helpdesk-agent-cases');
    await addAgentReply({ caseId: CASE_ID, body: 'Another reply on open case', isInternal: false });
    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg?.status).toBeUndefined();
  });
});
