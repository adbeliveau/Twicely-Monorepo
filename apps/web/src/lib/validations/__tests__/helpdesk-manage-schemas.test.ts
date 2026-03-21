import { describe, it, expect } from 'vitest';
import {
  createTeamSchema,
  updateMacroSchema,
  createRoutingRuleSchema,
  createAutomationRuleSchema,
  updateSlaPolicySchema,
} from '@/lib/validations/helpdesk';

const VALID_CUID2 = 'cljd4bvd00000wjh07mcy26x';

describe('createTeamSchema', () => {
  it('accepts valid input', () => {
    const result = createTeamSchema.safeParse({
      name: 'Billing Team',
      description: 'Handles billing questions',
      maxConcurrentCases: 20,
      roundRobinEnabled: true,
    });
    expect(result.success).toBe(true);
  });

  it('applies defaults for maxConcurrentCases and roundRobinEnabled', () => {
    const result = createTeamSchema.safeParse({ name: 'Support Team' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxConcurrentCases).toBe(25);
      expect(result.data.roundRobinEnabled).toBe(true);
    }
  });

  it('rejects empty name', () => {
    const result = createTeamSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys (strict mode)', () => {
    const result = createTeamSchema.safeParse({ name: 'Team', unknownField: 'bad' });
    expect(result.success).toBe(false);
  });

  it('rejects maxConcurrentCases below 1', () => {
    const result = createTeamSchema.safeParse({ name: 'Team', maxConcurrentCases: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects maxConcurrentCases above 100', () => {
    const result = createTeamSchema.safeParse({ name: 'Team', maxConcurrentCases: 101 });
    expect(result.success).toBe(false);
  });
});

describe('updateMacroSchema', () => {
  it('accepts partial update with only macroId and name', () => {
    const result = updateMacroSchema.safeParse({ macroId: VALID_CUID2, name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts update with all optional fields', () => {
    const result = updateMacroSchema.safeParse({
      macroId: VALID_CUID2,
      name: 'Updated Macro',
      description: 'Updated description',
      bodyTemplate: 'Hi {{buyer_name}}, your issue has been resolved.',
      isShared: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts seed-format macroId', () => {
    const result = updateMacroSchema.safeParse({ macroId: 'seed-macro-001', name: 'Test' });
    expect(result.success).toBe(true);
  });

  it('rejects empty macroId', () => {
    const result = updateMacroSchema.safeParse({ macroId: '', name: 'Test' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys (strict mode)', () => {
    const result = updateMacroSchema.safeParse({ macroId: VALID_CUID2, unknownField: 'bad' });
    expect(result.success).toBe(false);
  });
});

describe('createRoutingRuleSchema', () => {
  const VALID_CONDITION = {
    field: 'type' as const,
    operator: 'eq' as const,
    value: 'ORDER',
  };

  it('accepts valid routing rule with one condition', () => {
    const result = createRoutingRuleSchema.safeParse({
      name: 'Order Rule',
      conditionsJson: [VALID_CONDITION],
      actionsJson: { assignTeamId: VALID_CUID2 },
    });
    expect(result.success).toBe(true);
  });

  it('requires at least 1 condition', () => {
    const result = createRoutingRuleSchema.safeParse({
      name: 'Empty Conditions',
      conditionsJson: [],
      actionsJson: { assignTeamId: VALID_CUID2 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid condition operator', () => {
    const result = createRoutingRuleSchema.safeParse({
      name: 'Bad Op Rule',
      conditionsJson: [{ field: 'type', operator: 'not_a_valid_op', value: 'ORDER' }],
      actionsJson: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid condition field', () => {
    const result = createRoutingRuleSchema.safeParse({
      name: 'Bad Field Rule',
      conditionsJson: [{ field: 'unknownField', operator: 'eq', value: 'x' }],
      actionsJson: {},
    });
    expect(result.success).toBe(false);
  });

  it('defaults isActive to true', () => {
    const result = createRoutingRuleSchema.safeParse({
      name: 'Active Rule',
      conditionsJson: [VALID_CONDITION],
      actionsJson: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });
});

describe('createAutomationRuleSchema', () => {
  const VALID_ACTION = { type: 'SET_PRIORITY' as const, value: 'HIGH' };

  it('accepts valid automation rule', () => {
    const result = createAutomationRuleSchema.safeParse({
      name: 'SLA Warning Rule',
      triggerEvent: 'SLA_WARNING',
      conditionsJson: [],
      actionsJson: [VALID_ACTION],
    });
    expect(result.success).toBe(true);
  });

  it('requires valid trigger event', () => {
    const result = createAutomationRuleSchema.safeParse({
      name: 'Bad Trigger',
      triggerEvent: 'NOT_A_REAL_EVENT',
      conditionsJson: [],
      actionsJson: [VALID_ACTION],
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid trigger events', () => {
    const triggers = [
      'CASE_CREATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED',
      'SLA_WARNING', 'SLA_BREACHED', 'NO_RESPONSE',
      'AGENT_ASSIGNED', 'MESSAGE_RECEIVED', 'CASE_REOPENED',
    ] as const;
    for (const triggerEvent of triggers) {
      const result = createAutomationRuleSchema.safeParse({
        name: 'Rule',
        triggerEvent,
        conditionsJson: [],
        actionsJson: [VALID_ACTION],
      });
      expect(result.success).toBe(true);
    }
  });

  it('requires at least 1 action', () => {
    const result = createAutomationRuleSchema.safeParse({
      name: 'No Actions Rule',
      triggerEvent: 'CASE_CREATED',
      conditionsJson: [],
      actionsJson: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid action type', () => {
    const result = createAutomationRuleSchema.safeParse({
      name: 'Bad Action',
      triggerEvent: 'CASE_CREATED',
      conditionsJson: [],
      actionsJson: [{ type: 'INVALID_TYPE', value: 'x' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('updateSlaPolicySchema', () => {
  it('accepts partial fields update', () => {
    const result = updateSlaPolicySchema.safeParse({
      policyId: VALID_CUID2,
      firstResponseMinutes: 60,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all optional fields at once', () => {
    const result = updateSlaPolicySchema.safeParse({
      policyId: VALID_CUID2,
      firstResponseMinutes: 30,
      resolutionMinutes: 240,
      businessHoursOnly: true,
      escalateOnBreach: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative or zero minutes', () => {
    const zeroResponse = updateSlaPolicySchema.safeParse({
      policyId: VALID_CUID2,
      firstResponseMinutes: 0,
    });
    expect(zeroResponse.success).toBe(false);

    const negativeResolution = updateSlaPolicySchema.safeParse({
      policyId: VALID_CUID2,
      resolutionMinutes: -10,
    });
    expect(negativeResolution.success).toBe(false);
  });

  it('accepts seed-format policyId', () => {
    const result = updateSlaPolicySchema.safeParse({
      policyId: 'seed-sla-policy-001',
      firstResponseMinutes: 60,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty policyId', () => {
    const result = updateSlaPolicySchema.safeParse({
      policyId: '',
      firstResponseMinutes: 60,
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys (strict mode)', () => {
    const result = updateSlaPolicySchema.safeParse({
      policyId: VALID_CUID2,
      unknownField: 'bad',
    });
    expect(result.success).toBe(false);
  });
});
