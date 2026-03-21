import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbUpdate = vi.fn();
vi.mock('@twicely/db', () => ({ db: { update: mockDbUpdate } }));

vi.mock('@twicely/db/schema', () => ({
  staffUser: { id: 'id', signatureHtml: 'signature_html', updatedAt: 'updated_at' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
}));

// =============================================================================
// HELPERS
// =============================================================================

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

function mockAllowed() {
  const ability = { can: vi.fn().mockReturnValue(true) };
  const session = {
    staffUserId: 'staff-agent-001',
    email: 'agent@hub.twicely.co',
    displayName: 'Agent Smith',
    isPlatformStaff: true as const,
    platformRoles: ['SUPPORT'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
  return { session };
}

function mockUnauthorized() {
  mockStaffAuthorize.mockRejectedValue(new Error('Not authenticated'));
}

// =============================================================================
// updateAgentSignature
// =============================================================================

describe('updateAgentSignature', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('saves HTML to staffUser record on success', async () => {
    const { session } = mockAllowed();
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { updateAgentSignature } = await import('../helpdesk-signature');
    const result = await updateAgentSignature({ signatureHtml: 'Best regards,\nAgent Smith' });
    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    // Implementation escapes HTML and converts \n to <br />
    const updateChain = mockDbUpdate.mock.results[0]?.value;
    expect(updateChain.set).toHaveBeenCalled();
    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    // \n is converted to <br />, plain text is preserved
    expect(setArgs.signatureHtml).toBe('Best regards,<br />Agent Smith');
    void session;
  });

  it('sets signatureHtml to null when empty string provided', async () => {
    mockAllowed();
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { updateAgentSignature } = await import('../helpdesk-signature');
    const result = await updateAgentSignature({ signatureHtml: '' });
    expect(result.success).toBe(true);
    const setArgs = mockDbUpdate.mock.results[0]?.value.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.signatureHtml).toBeNull();
  });

  it('sets signatureHtml to null when whitespace-only string provided', async () => {
    mockAllowed();
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { updateAgentSignature } = await import('../helpdesk-signature');
    const result = await updateAgentSignature({ signatureHtml: '   ' });
    expect(result.success).toBe(true);
    const setArgs = mockDbUpdate.mock.results[0]?.value.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.signatureHtml).toBeNull();
  });

  it('returns Unauthorized when not staff authenticated', async () => {
    mockUnauthorized();

    const { updateAgentSignature } = await import('../helpdesk-signature');
    const result = await updateAgentSignature({ signatureHtml: 'Some signature' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('HTML-encodes script tags in signature (entity escape approach)', async () => {
    mockAllowed();
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { updateAgentSignature } = await import('../helpdesk-signature');
    const maliciousSignature = 'Hello<script>alert("xss")</script>World';
    await updateAgentSignature({ signatureHtml: maliciousSignature });
    const setArgs = mockDbUpdate.mock.results[0]?.value.set.mock.calls[0]?.[0] as Record<string, unknown>;
    // Implementation uses HTML entity escaping: < → &lt;, > → &gt;
    // Raw <script> tags are encoded, not stripped
    expect(setArgs.signatureHtml as string).not.toContain('<script>');
    expect(setArgs.signatureHtml as string).toContain('&lt;script&gt;');
    expect(setArgs.signatureHtml as string).toContain('Hello');
    expect(setArgs.signatureHtml as string).toContain('World');
  });

  it('HTML-encodes inline event handlers (entity escape approach)', async () => {
    mockAllowed();
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { updateAgentSignature } = await import('../helpdesk-signature');
    const xssSignature = '<a onclick="alert(1)" href="#">Click</a>';
    await updateAgentSignature({ signatureHtml: xssSignature });
    const setArgs = mockDbUpdate.mock.results[0]?.value.set.mock.calls[0]?.[0] as Record<string, unknown>;
    // Raw < > " chars are entity-encoded — no literal HTML tags execute
    expect(setArgs.signatureHtml as string).not.toContain('<a ');
    expect(setArgs.signatureHtml as string).toContain('&lt;a ');
    expect(setArgs.signatureHtml as string).toContain('&quot;alert(1)&quot;');
  });

  it('rejects signatureHtml exceeding 2000 characters', async () => {
    mockAllowed();

    const { updateAgentSignature } = await import('../helpdesk-signature');
    const tooLong = 'a'.repeat(2001);
    const result = await updateAgentSignature({ signatureHtml: tooLong });
    expect(result.success).toBe(false);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('rejects extra fields via .strict()', async () => {
    mockAllowed();

    const { updateAgentSignature } = await import('../helpdesk-signature');
    const result = await updateAgentSignature({ signatureHtml: 'Hi', extra: 'injected' });
    expect(result.success).toBe(false);
  });
});
