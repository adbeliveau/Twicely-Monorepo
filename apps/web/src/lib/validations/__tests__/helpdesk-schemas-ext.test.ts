import { describe, it, expect } from 'vitest';
import {
  assignCaseSchema,
  createSavedViewSchema,
  createAgentCaseSchema,
} from '@/lib/validations/helpdesk';

// Valid cuid2 IDs for schema tests
const CASE_ID = 'cljd4bvd00000wjh07mcy26x';
const STAFF_ID = 'cljd4bvd00001wjh07mcy26y';
const TEAM_ID = 'cljd4bvd00002wjh07mcy26z';
const USER_ID = 'cljd4bvd00003wjh07mcy270';

describe('assignCaseSchema', () => {
  it('accepts null agent and null team (unassign)', () => {
    const result = assignCaseSchema.safeParse({
      caseId: CASE_ID,
      assignedAgentId: null,
      assignedTeamId: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts both agent and team assigned', () => {
    const result = assignCaseSchema.safeParse({
      caseId: CASE_ID,
      assignedAgentId: STAFF_ID,
      assignedTeamId: TEAM_ID,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing caseId', () => {
    const result = assignCaseSchema.safeParse({
      assignedAgentId: null,
      assignedTeamId: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing assignedAgentId field', () => {
    const result = assignCaseSchema.safeParse({
      caseId: CASE_ID,
      assignedTeamId: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict mode)', () => {
    const result = assignCaseSchema.safeParse({
      caseId: CASE_ID,
      assignedAgentId: null,
      assignedTeamId: null,
      extraField: 'bad',
    });
    expect(result.success).toBe(false);
  });

  it('accepts seed-format IDs (non-cuid2)', () => {
    const result = assignCaseSchema.safeParse({
      caseId: 'seed-hd-case-001',
      assignedAgentId: 'seed-staff-admin-001',
      assignedTeamId: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty caseId', () => {
    const result = assignCaseSchema.safeParse({
      caseId: '',
      assignedAgentId: null,
      assignedTeamId: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('createSavedViewSchema', () => {
  const VALID_VIEW = {
    name: 'My Open Cases',
    filtersJson: { status: 'OPEN' },
  };

  it('accepts valid saved view', () => {
    expect(createSavedViewSchema.safeParse(VALID_VIEW).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(createSavedViewSchema.safeParse({ ...VALID_VIEW, name: '' }).success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    expect(createSavedViewSchema.safeParse({ ...VALID_VIEW, name: 'x'.repeat(101) }).success).toBe(false);
  });

  it('defaults isDefault to false', () => {
    const result = createSavedViewSchema.safeParse(VALID_VIEW);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isDefault).toBe(false);
    }
  });

  it('accepts isDefault: true', () => {
    const result = createSavedViewSchema.safeParse({ ...VALID_VIEW, isDefault: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isDefault).toBe(true);
    }
  });

  it('accepts optional sortJson', () => {
    expect(createSavedViewSchema.safeParse({ ...VALID_VIEW, sortJson: { field: 'lastActivityAt', dir: 'desc' } }).success).toBe(true);
  });

  it('rejects extra fields (strict)', () => {
    expect(createSavedViewSchema.safeParse({ ...VALID_VIEW, extra: 'bad' }).success).toBe(false);
  });
});

describe('createAgentCaseSchema', () => {
  const VALID_AGENT_CASE = {
    type: 'MODERATION' as const,
    subject: 'Suspicious listing activity detected',
    description: 'This listing appears to be selling counterfeit goods based on the images.',
    requesterId: USER_ID,
  };

  it('accepts valid agent-created case', () => {
    expect(createAgentCaseSchema.safeParse(VALID_AGENT_CASE).success).toBe(true);
  });

  it('accepts MODERATION and SYSTEM types not in user schema', () => {
    expect(createAgentCaseSchema.safeParse({ ...VALID_AGENT_CASE, type: 'MODERATION' }).success).toBe(true);
    expect(createAgentCaseSchema.safeParse({ ...VALID_AGENT_CASE, type: 'SYSTEM' }).success).toBe(true);
  });

  it('accepts all types including ORDER, RETURN, BILLING, ACCOUNT', () => {
    const types = ['SUPPORT', 'ORDER', 'RETURN', 'BILLING', 'ACCOUNT', 'MODERATION', 'SYSTEM'] as const;
    for (const type of types) {
      expect(createAgentCaseSchema.safeParse({ ...VALID_AGENT_CASE, type }).success).toBe(true);
    }
  });

  it('defaults priority to NORMAL', () => {
    const result = createAgentCaseSchema.safeParse(VALID_AGENT_CASE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe('NORMAL');
    }
  });

  it('accepts all priority values', () => {
    const priorities = ['CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW'] as const;
    for (const priority of priorities) {
      expect(createAgentCaseSchema.safeParse({ ...VALID_AGENT_CASE, priority }).success).toBe(true);
    }
  });

  it('rejects subject under 10 chars', () => {
    expect(createAgentCaseSchema.safeParse({ ...VALID_AGENT_CASE, subject: 'Too short' }).success).toBe(false);
  });

  it('rejects description under 10 chars', () => {
    expect(createAgentCaseSchema.safeParse({ ...VALID_AGENT_CASE, description: 'Short.' }).success).toBe(false);
  });

  it('rejects missing requesterId', () => {
    const { requesterId: _r, ...rest } = VALID_AGENT_CASE;
    expect(createAgentCaseSchema.safeParse(rest).success).toBe(false);
  });

  it('accepts seed-format requesterId', () => {
    expect(createAgentCaseSchema.safeParse({ ...VALID_AGENT_CASE, requesterId: 'seed-user-001' }).success).toBe(true);
  });

  it('rejects empty requesterId', () => {
    expect(createAgentCaseSchema.safeParse({ ...VALID_AGENT_CASE, requesterId: '' }).success).toBe(false);
  });

  it('rejects extra fields (strict)', () => {
    expect(createAgentCaseSchema.safeParse({ ...VALID_AGENT_CASE, extraField: 'bad' }).success).toBe(false);
  });
});
