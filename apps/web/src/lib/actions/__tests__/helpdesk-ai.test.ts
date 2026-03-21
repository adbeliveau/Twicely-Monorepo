import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));

vi.mock('@twicely/db/schema', () => ({
  helpdeskCase: { id: 'id', type: 'type', priority: 'priority', subject: 'subject', description: 'description', orderId: 'order_id' },
  caseMessage: { caseId: 'case_id', direction: 'direction', body: 'body', createdAt: 'created_at' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  desc: vi.fn((col: unknown) => ({ desc: col })),
}));

const mockGenerateSuggestion = vi.fn();
const mockAssistReply = vi.fn();
vi.mock('@/lib/helpdesk/ai-service', () => ({
  generateSuggestion: (...args: unknown[]) => mockGenerateSuggestion(...args),
  assistReply: (...args: unknown[]) => mockAssistReply(...args),
}));

// =============================================================================
// HELPERS
// =============================================================================

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'orderBy', 'limit'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

function mockAllowed() {
  const ability = { can: vi.fn().mockReturnValue(true) };
  const session = {
    staffUserId: 'staff-001',
    email: 'agent@hub.twicely.co',
    displayName: 'Agent',
    isPlatformStaff: true as const,
    platformRoles: ['SUPPORT'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
  return { ability, session };
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = {
    staffUserId: 'staff-002',
    email: 'readonly@hub.twicely.co',
    displayName: 'ReadOnly',
    isPlatformStaff: true as const,
    platformRoles: [],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockUnauthorized() {
  mockStaffAuthorize.mockRejectedValue(new Error('Unauthorized'));
}

const CASE_ROW = {
  id: 'case-001',
  type: 'SUPPORT',
  priority: 'NORMAL',
  subject: 'Item not received',
  description: 'I have not received my item.',
  orderId: null,
};

const MESSAGE_ROWS = [
  { direction: 'INBOUND', body: 'Where is my order?' },
  { direction: 'OUTBOUND', body: 'We are looking into it.' },
];

// =============================================================================
// getAiSuggestion
// =============================================================================

describe('getAiSuggestion', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns suggestion for valid case ID', async () => {
    mockAllowed();
    let selectCall = 0;
    mockDbSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([CASE_ROW]);
      return makeSelectChain(MESSAGE_ROWS);
    });
    mockGenerateSuggestion.mockResolvedValue('Here is your suggested reply.');

    const { getAiSuggestion } = await import('../helpdesk-ai');
    const result = await getAiSuggestion({ caseId: 'case-001' });
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.suggestion).toBe('Here is your suggested reply.');
    }
  });

  it('returns error when case not found', async () => {
    mockAllowed();
    mockDbSelect.mockImplementation(() => makeSelectChain([])); // no case row

    const { getAiSuggestion } = await import('../helpdesk-ai');
    const result = await getAiSuggestion({ caseId: 'nonexistent-case' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns error when unauthorized (throws)', async () => {
    mockUnauthorized();

    const { getAiSuggestion } = await import('../helpdesk-ai');
    const result = await getAiSuggestion({ caseId: 'case-001' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns error when CASL denies read on HelpdeskCase', async () => {
    mockForbidden();

    const { getAiSuggestion } = await import('../helpdesk-ai');
    const result = await getAiSuggestion({ caseId: 'case-001' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('returns error when AI service returns null', async () => {
    mockAllowed();
    let selectCall = 0;
    mockDbSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([CASE_ROW]);
      return makeSelectChain(MESSAGE_ROWS);
    });
    mockGenerateSuggestion.mockResolvedValue(null);

    const { getAiSuggestion } = await import('../helpdesk-ai');
    const result = await getAiSuggestion({ caseId: 'case-001' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('AI suggestion unavailable');
  });

  it('rejects extra fields via .strict()', async () => {
    mockAllowed();

    const { getAiSuggestion } = await import('../helpdesk-ai');
    const result = await getAiSuggestion({ caseId: 'case-001', extra: 'bad' });
    expect(result.success).toBe(false);
  });

  it('rejects empty caseId', async () => {
    mockAllowed();

    const { getAiSuggestion } = await import('../helpdesk-ai');
    const result = await getAiSuggestion({ caseId: '' });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// getAiAssist
// =============================================================================

describe('getAiAssist', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns transformed text for valid input', async () => {
    mockAllowed();
    mockAssistReply.mockResolvedValue('Professional rewritten reply.');

    const { getAiAssist } = await import('../helpdesk-ai');
    const result = await getAiAssist({ body: 'sorry for the trouble', action: 'REWRITE' });
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.result).toBe('Professional rewritten reply.');
    }
  });

  it('rejects when body exceeds 5000 chars', async () => {
    mockAllowed();

    const { getAiAssist } = await import('../helpdesk-ai');
    const longBody = 'a'.repeat(5001);
    const result = await getAiAssist({ body: longBody, action: 'REWRITE' });
    expect(result.success).toBe(false);
  });

  it('validates action enum (rejects invalid actions)', async () => {
    mockAllowed();

    const { getAiAssist } = await import('../helpdesk-ai');
    const result = await getAiAssist({ body: 'Some text', action: 'INVALID_ACTION' });
    expect(result.success).toBe(false);
  });

  it('returns error when unauthorized', async () => {
    mockUnauthorized();

    const { getAiAssist } = await import('../helpdesk-ai');
    const result = await getAiAssist({ body: 'text', action: 'SUMMARIZE' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns error when AI service returns null', async () => {
    mockAllowed();
    mockAssistReply.mockResolvedValue(null);

    const { getAiAssist } = await import('../helpdesk-ai');
    const result = await getAiAssist({ body: 'Some text', action: 'TRANSLATE_FR' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('AI assist unavailable');
  });

  it('rejects extra fields via .strict()', async () => {
    mockAllowed();

    const { getAiAssist } = await import('../helpdesk-ai');
    const result = await getAiAssist({ body: 'text', action: 'REWRITE', extra: 'injected' });
    expect(result.success).toBe(false);
  });

  it('returns error when CASL denies read on HelpdeskCase', async () => {
    mockForbidden();

    const { getAiAssist } = await import('../helpdesk-ai');
    const result = await getAiAssist({ body: 'text', action: 'REWRITE' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });
});
