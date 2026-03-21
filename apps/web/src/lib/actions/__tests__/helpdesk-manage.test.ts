import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInsert, mockUpdate, mockSelect, mockDelete, mockStaffAuthorize } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockDelete: vi.fn(),
  mockStaffAuthorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { insert: mockInsert, update: mockUpdate, select: mockSelect, delete: mockDelete },
}));
vi.mock('@twicely/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  updateMacro,
  createTeam,
  updateTeam,
  createRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
  updateSlaPolicyFields,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  updateHelpdeskSetting,
} from '../helpdesk-manage';

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

function makeManagerSession() {
  return {
    session: {
      staffUserId: 'staff-test-mgr',
      displayName: 'Manager',
      email: 'mgr@twicely.co',
      isPlatformStaff: true as const,
      platformRoles: ['HELPDESK_MANAGER' as const],
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeLeadSession() {
  return {
    session: {
      staffUserId: 'staff-test-lead',
      displayName: 'Lead',
      email: 'lead@twicely.co',
      isPlatformStaff: true as const,
      platformRoles: ['HELPDESK_LEAD' as const],
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeAgentSession() {
  return {
    session: {
      staffUserId: 'staff-test-agent',
      displayName: 'Agent',
      email: 'agent@twicely.co',
      isPlatformStaff: true as const,
      platformRoles: ['HELPDESK_AGENT' as const],
    },
    ability: { can: vi.fn().mockReturnValue(false) },
  };
}

const VALID_MACRO_ID = 'cljd4bvd00000wjh07mcy26x';
const VALID_TEAM_ID = 'cljd4bvd00001wjh07mcy26y';
const VALID_RULE_ID = 'cljd4bvd00002wjh07mcy26z';
const VALID_POLICY_ID = 'cljd4bvd00003wjh07mcy26w';
const VALID_CONDITION = { field: 'type' as const, operator: 'eq' as const, value: 'ORDER' };
const VALID_ACTION = { assignTeamId: VALID_TEAM_ID };
const VALID_AUTO_ACTION = { type: 'SET_PRIORITY' as const, value: 'HIGH' };

// ─── updateMacro ──────────────────────────────────────────────────────────────

describe('updateMacro', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns access denied for agent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const result = await updateMacro({ macroId: VALID_MACRO_ID, name: 'Updated' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('returns validation error for invalid macroId', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const result = await updateMacro({ macroId: '', name: 'Updated' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('updates macro fields when lead authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const selectChain = makeChain([{ id: VALID_MACRO_ID }]);
    mockSelect.mockReturnValue(selectChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const result = await updateMacro({ macroId: VALID_MACRO_ID, name: 'New Name', isShared: false });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Name', isShared: false })
    );
  });
});

// ─── createTeam / updateTeam ──────────────────────────────────────────────────

describe('createTeam', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns access denied for lead (not manager)', async () => {
    const leadSession = makeLeadSession();
    leadSession.ability.can = vi.fn().mockReturnValue(false);
    mockStaffAuthorize.mockResolvedValue(leadSession);
    const result = await createTeam({ name: 'Support Team' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('returns validation error for empty name', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const result = await createTeam({ name: '' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('creates team and returns id', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const insertChain = makeChain([{ id: VALID_TEAM_ID }]);
    mockInsert.mockReturnValue(insertChain);

    const result = await createTeam({ name: 'Billing Team', description: 'Handles billing issues' });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(VALID_TEAM_ID);
  });
});

describe('updateTeam', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns access denied for non-manager', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const result = await updateTeam({ teamId: VALID_TEAM_ID, name: 'New Name' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('updates team name when manager authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const selectChain = makeChain([{ id: VALID_TEAM_ID }]);
    mockSelect.mockReturnValue(selectChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const result = await updateTeam({ teamId: VALID_TEAM_ID, name: 'Renamed Team' });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Renamed Team' })
    );
  });
});

// ─── Routing Rules ────────────────────────────────────────────────────────────

describe('createRoutingRule', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns access denied for non-manager', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const result = await createRoutingRule({
      name: 'Order Rule', conditionsJson: [VALID_CONDITION], actionsJson: VALID_ACTION,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('returns validation error for empty conditions', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const result = await createRoutingRule({
      name: 'Order Rule', conditionsJson: [], actionsJson: VALID_ACTION,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('creates routing rule when manager authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const insertChain = makeChain([{ id: VALID_RULE_ID }]);
    mockInsert.mockReturnValue(insertChain);

    const result = await createRoutingRule({
      name: 'Order Route', conditionsJson: [VALID_CONDITION], actionsJson: VALID_ACTION,
    });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(VALID_RULE_ID);
  });
});

describe('updateRoutingRule', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns access denied for non-manager', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const result = await updateRoutingRule({ ruleId: VALID_RULE_ID, name: 'Updated' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('updates routing rule name and conditions', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const selectChain = makeChain([{ id: VALID_RULE_ID }]);
    mockSelect.mockReturnValue(selectChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const result = await updateRoutingRule({
      ruleId: VALID_RULE_ID, name: 'Updated Rule', conditionsJson: [VALID_CONDITION],
    });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated Rule' }));
  });
});

describe('deleteRoutingRule', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns access denied for non-manager', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const result = await deleteRoutingRule(VALID_RULE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('deletes routing rule when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const deleteChain = { where: vi.fn().mockResolvedValue([]) };
    mockDelete.mockReturnValue(deleteChain);

    const result = await deleteRoutingRule(VALID_RULE_ID);
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });
});

// ─── updateSlaPolicyFields ────────────────────────────────────────────────────

describe('updateSlaPolicyFields', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns access denied for non-manager', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const result = await updateSlaPolicyFields({ policyId: VALID_POLICY_ID, firstResponseMinutes: 60 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('updates first response and resolution minutes', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const result = await updateSlaPolicyFields({
      policyId: VALID_POLICY_ID, firstResponseMinutes: 60, resolutionMinutes: 480,
    });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ firstResponseMinutes: 60, resolutionMinutes: 480 })
    );
  });

  it('updates businessHoursOnly and escalateOnBreach toggles', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const result = await updateSlaPolicyFields({
      policyId: VALID_POLICY_ID, businessHoursOnly: false, escalateOnBreach: true,
    });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ businessHoursOnly: false, escalateOnBreach: true })
    );
  });
});

// ─── createAutomationRule ─────────────────────────────────────────────────────

describe('createAutomationRule', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns access denied for non-manager', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const result = await createAutomationRule({
      name: 'SLA Warning', triggerEvent: 'SLA_WARNING', conditionsJson: [], actionsJson: [VALID_AUTO_ACTION],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('returns validation error for missing trigger event', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const result = await createAutomationRule({
      name: 'Bad Rule', conditionsJson: [], actionsJson: [VALID_AUTO_ACTION],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('creates automation rule with trigger and actions', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const insertChain = makeChain([{ id: VALID_RULE_ID }]);
    mockInsert.mockReturnValue(insertChain);

    const result = await createAutomationRule({
      name: 'SLA Warning Escalation', triggerEvent: 'SLA_WARNING', conditionsJson: [], actionsJson: [VALID_AUTO_ACTION],
    });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(VALID_RULE_ID);
  });
});

// ─── updateAutomationRule ─────────────────────────────────────────────────────

describe('updateAutomationRule', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns access denied for non-manager', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const result = await updateAutomationRule({ ruleId: VALID_RULE_ID, name: 'Updated' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('updates automation rule when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const selectChain = makeChain([{ id: VALID_RULE_ID }]);
    mockSelect.mockReturnValue(selectChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const result = await updateAutomationRule({ ruleId: VALID_RULE_ID, name: 'Updated Rule', isActive: false });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated Rule', isActive: false })
    );
  });
});

// ─── deleteAutomationRule ─────────────────────────────────────────────────────

describe('deleteAutomationRule', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns access denied for non-manager', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const result = await deleteAutomationRule(VALID_RULE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('deletes automation rule when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const deleteChain = { where: vi.fn().mockResolvedValue([]) };
    mockDelete.mockReturnValue(deleteChain);

    const result = await deleteAutomationRule(VALID_RULE_ID);
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });
});

// ─── updateHelpdeskSetting ────────────────────────────────────────────────────

describe('updateHelpdeskSetting', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns access denied for non-manager', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const result = await updateHelpdeskSetting({ key: 'helpdesk.csat.enabled', value: false });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('rejects keys that do not start with helpdesk.', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const result = await updateHelpdeskSetting({ key: 'commerce.payout.minimumCents', value: 500 });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('updates helpdesk platform setting and creates audit entry', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const SETTING_ID = 'cljd4bvd00010wjh07mcy26v';
    const selectChain = makeChain([{ id: SETTING_ID, value: true }]);
    mockSelect.mockReturnValue(selectChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const result = await updateHelpdeskSetting({ key: 'helpdesk.csat.enabled', value: false });
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ value: false })
    );
  });
});
