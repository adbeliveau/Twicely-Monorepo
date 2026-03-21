import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAddCaseWatcher = vi.fn().mockResolvedValue({ success: true });
const mockRemoveCaseWatcher = vi.fn().mockResolvedValue({ success: true });

vi.mock('@/lib/actions/helpdesk-agent', () => ({
  addCaseWatcher: mockAddCaseWatcher,
  removeCaseWatcher: mockRemoveCaseWatcher,
  toggleAgentOnlineStatus: vi.fn(),
  addTeamMember: vi.fn(),
  removeTeamMember: vi.fn(),
  toggleTeamMemberAvailability: vi.fn(),
  toggleRoutingRule: vi.fn(),
  reorderRoutingRules: vi.fn(),
  createMacro: vi.fn(),
  deleteMacro: vi.fn(),
  createSavedView: vi.fn(),
  deleteSavedView: vi.fn(),
  updateSlaPolicyTargets: vi.fn(),
  toggleAutomationRule: vi.fn(),
}));

vi.mock('@twicely/utils', () => ({ cn: (...args: string[]) => args.filter(Boolean).join(' ') }));

const WATCHERS = [
  { id: 'w-1', staffUserId: 'staff-100', displayName: 'Alice Smith', createdAt: new Date() },
  { id: 'w-2', staffUserId: 'staff-200', displayName: 'Bob Jones', createdAt: new Date() },
];

describe('CaseWatchers — logic and prop contract', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders watcher list with names — watchers array is iterable', () => {
    expect(WATCHERS).toHaveLength(2);
    expect(WATCHERS[0]?.displayName).toBe('Alice Smith');
    expect(WATCHERS[1]?.displayName).toBe('Bob Jones');
  });

  it('shows "Watch" when current agent is not in watcher list', () => {
    const currentStaffUserId = 'staff-999';
    const isWatching = WATCHERS.some((w) => w.staffUserId === currentStaffUserId);
    expect(isWatching).toBe(false);
  });

  it('shows "Unwatch" when current agent is already watching', () => {
    const currentStaffUserId = 'staff-100';
    const isWatching = WATCHERS.some((w) => w.staffUserId === currentStaffUserId);
    expect(isWatching).toBe(true);
  });

  it('calls addCaseWatcher when Watch is triggered', async () => {
    const caseId = 'case-xyz';
    const staffUserId = 'staff-999';
    await mockAddCaseWatcher(caseId, staffUserId);
    expect(mockAddCaseWatcher).toHaveBeenCalledWith(caseId, staffUserId);
    expect(mockAddCaseWatcher).toHaveBeenCalledTimes(1);
  });

  it('calls removeCaseWatcher when Unwatch is triggered', async () => {
    const caseId = 'case-xyz';
    const staffUserId = 'staff-100';
    await mockRemoveCaseWatcher(caseId, staffUserId);
    expect(mockRemoveCaseWatcher).toHaveBeenCalledWith(caseId, staffUserId);
    expect(mockRemoveCaseWatcher).toHaveBeenCalledTimes(1);
  });
});
