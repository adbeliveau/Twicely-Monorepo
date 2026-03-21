import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockDb = { select: mockSelect, update: mockUpdate, insert: mockInsert };
const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/logger', () => ({ logger: mockLogger }));

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  ['from', 'where', 'orderBy', 'limit'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

function makeChain(returnVal: unknown) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(returnVal),
  };
  return chain;
}

const BASE_CASE_DATA = {
  id: 'case-test-001',
  type: 'ORDER',
  priority: 'NORMAL',
  status: 'OPEN',
  channel: 'WEB',
  tags: [] as string[],
  requesterId: 'user-test-001',
  assignedTeamId: null as string | null,
  assignedAgentId: null as string | null,
};

describe('evaluateAutomationRules', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('does nothing when no rules match the trigger event', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));

    const { evaluateAutomationRules } = await import('../automation-engine');
    await evaluateAutomationRules('case_created', BASE_CASE_DATA);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('does nothing when rule conditions do not match', async () => {
    const rule = {
      id: 'rule-1', name: 'Billing Rule', isActive: true,
      triggerEvent: 'case_created',
      conditionsJson: [{ field: 'type', operator: 'eq', value: 'BILLING' }],
      actionsJson: [{ type: 'SET_STATUS', value: 'ON_HOLD' }],
    };
    mockSelect.mockReturnValue(makeSelectChain([rule]));

    const { evaluateAutomationRules } = await import('../automation-engine');
    // Case type is ORDER, rule requires BILLING — should not match
    await evaluateAutomationRules('case_created', BASE_CASE_DATA);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('executes SET_STATUS action when rule matches', async () => {
    const rule = {
      id: 'rule-1', name: 'Auto-Hold', isActive: true,
      triggerEvent: 'case_created',
      conditionsJson: [{ field: 'type', operator: 'eq', value: 'ORDER' }],
      actionsJson: [{ type: 'SET_STATUS', value: 'ON_HOLD' }],
    };
    mockSelect.mockReturnValue(makeSelectChain([rule]));
    const updateChain = makeChain([]);
    mockUpdate.mockReturnValue(updateChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const { evaluateAutomationRules } = await import('../automation-engine');
    await evaluateAutomationRules('case_created', BASE_CASE_DATA);
    expect(mockUpdate).toHaveBeenCalled();
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ON_HOLD' })
    );
  });

  it('executes ASSIGN_TEAM action when rule matches', async () => {
    const rule = {
      id: 'rule-2', name: 'Route to Billing', isActive: true,
      triggerEvent: 'case_created',
      conditionsJson: [{ field: 'type', operator: 'eq', value: 'ORDER' }],
      actionsJson: [{ type: 'ASSIGN_TEAM', value: 'team-billing' }],
    };
    mockSelect.mockReturnValue(makeSelectChain([rule]));
    const updateChain = makeChain([]);
    mockUpdate.mockReturnValue(updateChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const { evaluateAutomationRules } = await import('../automation-engine');
    await evaluateAutomationRules('case_created', BASE_CASE_DATA);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ assignedTeamId: 'team-billing' })
    );
  });

  it('executes SET_PRIORITY action', async () => {
    const rule = {
      id: 'rule-3', name: 'Escalate Critical', isActive: true,
      triggerEvent: 'user_replied',
      conditionsJson: [{ field: 'priority', operator: 'eq', value: 'NORMAL' }],
      actionsJson: [{ type: 'SET_PRIORITY', value: 'HIGH' }],
    };
    mockSelect.mockReturnValue(makeSelectChain([rule]));
    const updateChain = makeChain([]);
    mockUpdate.mockReturnValue(updateChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const { evaluateAutomationRules } = await import('../automation-engine');
    await evaluateAutomationRules('user_replied', BASE_CASE_DATA);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'HIGH' })
    );
  });

  it('executes ADD_NOTE action by inserting case message', async () => {
    const rule = {
      id: 'rule-4', name: 'Add Internal Note', isActive: true,
      triggerEvent: 'case_created',
      conditionsJson: [],
      actionsJson: [{ type: 'ADD_NOTE', value: 'Automated: case received and being reviewed.' }],
    };
    mockSelect.mockReturnValue(makeSelectChain([rule]));
    const insertChain = makeChain([]);
    insertChain.values = vi.fn().mockResolvedValue([]);
    mockInsert.mockReturnValue(insertChain);

    const { evaluateAutomationRules } = await import('../automation-engine');
    await evaluateAutomationRules('case_created', BASE_CASE_DATA);
    expect(mockInsert).toHaveBeenCalled();
  });

  it('inserts automation_applied event after applying rule', async () => {
    const rule = {
      id: 'rule-5', name: 'Status Rule', isActive: true,
      triggerEvent: 'case_created',
      conditionsJson: [],
      actionsJson: [{ type: 'SET_STATUS', value: 'PENDING_INTERNAL' }],
    };
    mockSelect.mockReturnValue(makeSelectChain([rule]));
    const updateChain = makeChain([]);
    mockUpdate.mockReturnValue(updateChain);
    const insertChain = makeChain([]);
    insertChain.values = vi.fn().mockResolvedValue([]);
    mockInsert.mockReturnValue(insertChain);

    const { evaluateAutomationRules } = await import('../automation-engine');
    await evaluateAutomationRules('case_created', BASE_CASE_DATA);
    // Should insert the automation_applied event
    expect(mockInsert).toHaveBeenCalled();
    const insertedValues = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedValues?.eventType).toBe('automation_applied');
    expect((insertedValues?.dataJson as Record<string, unknown>)?.ruleId).toBe('rule-5');
  });

  it('evaluates multiple rules (all-match, not first-wins)', async () => {
    const rules = [
      {
        id: 'rule-a', name: 'Rule A', isActive: true, triggerEvent: 'case_created',
        conditionsJson: [{ field: 'type', operator: 'eq', value: 'ORDER' }],
        actionsJson: [{ type: 'SET_PRIORITY', value: 'HIGH' }],
      },
      {
        id: 'rule-b', name: 'Rule B', isActive: true, triggerEvent: 'case_created',
        conditionsJson: [{ field: 'channel', operator: 'eq', value: 'WEB' }],
        actionsJson: [{ type: 'ASSIGN_TEAM', value: 'team-web' }],
      },
    ];
    mockSelect.mockReturnValue(makeSelectChain(rules));
    const updateChain = makeChain([]);
    mockUpdate.mockReturnValue(updateChain);
    const insertChain = makeChain([]);
    insertChain.values = vi.fn().mockResolvedValue([]);
    mockInsert.mockReturnValue(insertChain);

    const { evaluateAutomationRules } = await import('../automation-engine');
    await evaluateAutomationRules('case_created', BASE_CASE_DATA);
    // Both rules match — update called twice (once per rule), insert for events
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('handles contains operator for tag matching', async () => {
    const rule = {
      id: 'rule-contains', name: 'Tag Rule', isActive: true,
      triggerEvent: 'tags_changed',
      conditionsJson: [{ field: 'tags', operator: 'contains', value: 'fraud' }],
      actionsJson: [{ type: 'SET_PRIORITY', value: 'CRITICAL' }],
    };
    mockSelect.mockReturnValue(makeSelectChain([rule]));
    const updateChain = makeChain([]);
    mockUpdate.mockReturnValue(updateChain);
    const insertChain = makeChain([]);
    insertChain.values = vi.fn().mockResolvedValue([]);
    mockInsert.mockReturnValue(insertChain);

    const { evaluateAutomationRules } = await import('../automation-engine');
    await evaluateAutomationRules('tags_changed', { ...BASE_CASE_DATA, tags: ['fraud', 'urgent'] });
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ priority: 'CRITICAL' }));
  });
});
