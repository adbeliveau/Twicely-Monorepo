import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// HOISTED MOCKS — variables used in vi.mock factories must be hoisted
// =============================================================================

const { mockDbSelect, mockMessagesCreate } = vi.hoisted(() => {
  const mockDbSelect = vi.fn();
  const mockMessagesCreate = vi.fn();
  return { mockDbSelect, mockMessagesCreate };
});

vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));
vi.mock('@twicely/db/schema', () => ({
  platformSetting: { key: 'key', value: 'value' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
}));

// Anthropic SDK mock — class form so constructor works with `new`
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockMessagesCreate };
  },
}));

// Import functions once — no resetModules (we need the SDK mock to stay live)
import { generateSuggestion, assistReply } from '../ai-service';

// =============================================================================
// HELPERS
// =============================================================================

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'limit'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

const CASE_CONTEXT = {
  type: 'SUPPORT',
  priority: 'NORMAL',
  subject: 'Item not received',
  description: 'I ordered a week ago and have not received my item.',
  recentMessages: [
    { direction: 'INBOUND', body: 'Where is my order?' },
    { direction: 'OUTBOUND', body: 'We are looking into it.' },
  ],
};

// =============================================================================
// generateSuggestion
// =============================================================================

describe('generateSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  it('returns a string when API succeeds', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeSelectChain([{ value: true }]);   // suggestionEnabled
      return makeSelectChain([{ value: 'claude-haiku-4-5-20251001' }]); // model
    });
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Thank you for reaching out. Your order is on its way.' }],
    });

    const result = await generateSuggestion(CASE_CONTEXT);
    expect(result).toBe('Thank you for reaching out. Your order is on its way.');
  });

  it('returns null when API key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockDbSelect.mockImplementation(() => makeSelectChain([{ value: true }]));

    const result = await generateSuggestion(CASE_CONTEXT);
    expect(result).toBeNull();
  });

  it('returns null when platform setting suggestionEnabled is false', async () => {
    mockDbSelect.mockImplementation(() => makeSelectChain([{ value: false }]));

    const result = await generateSuggestion(CASE_CONTEXT);
    expect(result).toBeNull();
  });

  it('returns null when API call throws', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeSelectChain([{ value: true }]);
      return makeSelectChain([{ value: 'claude-haiku-4-5-20251001' }]);
    });
    mockMessagesCreate.mockRejectedValue(new Error('API rate limit exceeded'));

    const result = await generateSuggestion(CASE_CONTEXT);
    expect(result).toBeNull();
  });

  it('reads model from platform_settings (not hardcoded)', async () => {
    const capturedParams: unknown[] = [];
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeSelectChain([{ value: true }]);
      return makeSelectChain([{ value: 'claude-haiku-custom-model' }]);
    });
    mockMessagesCreate.mockImplementation((params: unknown) => {
      capturedParams.push(params);
      return Promise.resolve({ content: [{ type: 'text', text: 'Reply text' }] });
    });

    await generateSuggestion(CASE_CONTEXT);
    const callParams = capturedParams[0] as Record<string, unknown>;
    expect(callParams?.model).toBe('claude-haiku-custom-model');
  });

  it('returns null when content array is empty', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeSelectChain([{ value: true }]);
      return makeSelectChain([{ value: 'claude-haiku-4-5-20251001' }]);
    });
    mockMessagesCreate.mockResolvedValue({ content: [] });

    const result = await generateSuggestion(CASE_CONTEXT);
    expect(result).toBeNull();
  });
});

// =============================================================================
// assistReply
// =============================================================================

describe('assistReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  it('returns transformed text for REWRITE action', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeSelectChain([{ value: true }]);
      return makeSelectChain([{ value: 'claude-haiku-4-5-20251001' }]);
    });
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'We sincerely apologize for any inconvenience caused.' }],
    });

    const result = await assistReply('Sorry for the trouble.', 'REWRITE');
    expect(result).toBe('We sincerely apologize for any inconvenience caused.');
  });

  it('returns translated text for TRANSLATE_ES action', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeSelectChain([{ value: true }]);
      return makeSelectChain([{ value: 'claude-haiku-4-5-20251001' }]);
    });
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Lamentamos los inconvenientes causados.' }],
    });

    const result = await assistReply('Sorry for the inconvenience.', 'TRANSLATE_ES');
    expect(result).toBe('Lamentamos los inconvenientes causados.');
  });

  it('returns null when body is empty', async () => {
    const result = await assistReply('', 'REWRITE');
    expect(result).toBeNull();
  });

  it('returns null when body is only whitespace', async () => {
    const result = await assistReply('   ', 'REWRITE');
    expect(result).toBeNull();
  });

  it('returns null when platform setting assistEnabled is false', async () => {
    mockDbSelect.mockImplementation(() => makeSelectChain([{ value: false }]));

    const result = await assistReply('Some reply text', 'SUMMARIZE');
    expect(result).toBeNull();
  });

  it('returns null when API call throws', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeSelectChain([{ value: true }]);
      return makeSelectChain([{ value: 'claude-haiku-4-5-20251001' }]);
    });
    mockMessagesCreate.mockRejectedValue(new Error('Network error'));

    const result = await assistReply('Some reply text', 'TRANSLATE_FR');
    expect(result).toBeNull();
  });

  it('returns null when API key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockDbSelect.mockImplementation(() => makeSelectChain([{ value: true }]));

    const result = await assistReply('Some body text', 'SUMMARIZE');
    expect(result).toBeNull();
  });

  it('falls back to FALLBACK_MODEL when model setting is missing', async () => {
    const capturedParams: unknown[] = [];
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeSelectChain([{ value: true }]);
      return makeSelectChain([]); // no model row — fallback to FALLBACK_MODEL
    });
    mockMessagesCreate.mockImplementation((params: unknown) => {
      capturedParams.push(params);
      return Promise.resolve({ content: [{ type: 'text', text: 'Result' }] });
    });

    await assistReply('Some text', 'REWRITE');
    const callParams = capturedParams[0] as Record<string, unknown>;
    expect(typeof callParams?.model).toBe('string');
    expect((callParams?.model as string).length).toBeGreaterThan(0);
  });
});
