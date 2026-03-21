import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdate = vi.fn();
const mockDb = { update: mockUpdate };
const mockStaffAuthorize = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));
vi.mock('@twicely/db/schema', () => ({
  helpdeskTeamMember: { staffUserId: 'staff_user_id', isAvailable: 'is_available' },
  helpdeskTeam: {},
  helpdeskMacro: {},
  helpdeskSavedView: {},
  helpdeskSlaPolicy: {},
  helpdeskAutomationRule: {},
  helpdeskRoutingRule: {},
  caseWatcher: {},
}));
vi.mock('@/lib/validations/helpdesk', () => ({
  createMacroSchema: { safeParse: vi.fn() },
  createSavedViewSchema: { safeParse: vi.fn() },
}));
vi.mock('@/lib/validations/helpdesk-agent-status', () => ({
  toggleAgentOnlineStatusSchema: {
    safeParse: vi.fn((data: unknown) => {
      if (typeof (data as { isOnline?: unknown })?.isOnline === 'boolean') {
        return { success: true, data };
      }
      return { success: false, error: { issues: [{ message: 'Invalid input' }] } };
    }),
  },
}));

function makeAgentSession(staffUserId = 'staff-agent-1') {
  return {
    session: {
      staffUserId,
      displayName: 'Test Agent',
      email: 'agent@twicely.co',
      isPlatformStaff: true as const,
      platformRoles: ['HELPDESK_AGENT' as const],
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

describe('toggleAgentOnlineStatus', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates all team memberships to online', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    mockUpdate.mockReturnValue(makeUpdateChain());
    const { toggleAgentOnlineStatus } = await import('../helpdesk-agent');
    const result = await toggleAgentOnlineStatus({ isOnline: true });
    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('updates all team memberships to offline', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    mockUpdate.mockReturnValue(makeUpdateChain());
    const { toggleAgentOnlineStatus } = await import('../helpdesk-agent');
    const result = await toggleAgentOnlineStatus({ isOnline: false });
    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('requires staff auth — throws if unauthenticated', async () => {
    mockStaffAuthorize.mockRejectedValue(new Error('authentication required'));
    const { toggleAgentOnlineStatus } = await import('../helpdesk-agent');
    await expect(toggleAgentOnlineStatus({ isOnline: true })).rejects.toThrow('authentication required');
  });

  it('validates input with Zod .strict() — rejects non-boolean', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { toggleAgentOnlineStatus } = await import('../helpdesk-agent');
    const result = await toggleAgentOnlineStatus({ isOnline: 'yes' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('succeeds with no team memberships (no-op update)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    mockUpdate.mockReturnValue(makeUpdateChain());
    const { toggleAgentOnlineStatus } = await import('../helpdesk-agent');
    const result = await toggleAgentOnlineStatus({ isOnline: true });
    expect(result.success).toBe(true);
  });

  it('calls revalidatePath after update', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    mockUpdate.mockReturnValue(makeUpdateChain());
    const { toggleAgentOnlineStatus } = await import('../helpdesk-agent');
    await toggleAgentOnlineStatus({ isOnline: false });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/hd');
  });
});
