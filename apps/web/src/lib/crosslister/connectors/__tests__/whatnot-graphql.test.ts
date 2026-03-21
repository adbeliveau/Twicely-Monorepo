import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('executeGraphQL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends POST with correct headers and body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { me: { id: '1' } } }),
    });

    const { executeGraphQL } = await import('../whatnot-graphql');
    await executeGraphQL({
      accessToken: 'test-token',
      environment: 'PRODUCTION',
      query: 'query { me { id } }',
      variables: { foo: 'bar' },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.whatnot.com/seller-api/graphql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
        body: expect.stringContaining('"query"'),
      }),
    );

    const firstCall = mockFetch.mock.calls[0]!;
    const sentBody = JSON.parse(firstCall[1].body as string) as {
      variables: { foo: string };
    };
    expect(sentBody.variables.foo).toBe('bar');
  });

  it('returns data on successful response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { listings: { nodes: [] } } }),
    });

    const { executeGraphQL } = await import('../whatnot-graphql');
    const result = await executeGraphQL<{ listings: { nodes: unknown[] } }>({
      accessToken: 'tok',
      environment: 'PRODUCTION',
      query: 'query { listings { nodes } }',
    });

    expect(result.data).toEqual({ listings: { nodes: [] } });
    expect(result.errors).toBeNull();
    expect(result.status).toBe(200);
  });

  it('returns errors array from GraphQL error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: null,
        errors: [{ message: 'Listing not found', path: ['listing'] }],
      }),
    });

    const { executeGraphQL } = await import('../whatnot-graphql');
    const result = await executeGraphQL({
      accessToken: 'tok',
      environment: 'PRODUCTION',
      query: 'query { listing(id: "x") { id } }',
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]?.message).toBe('Listing not found');
    expect(result.data).toBeNull();
  });

  it('handles HTTP error with parseable body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ errors: [{ message: 'Forbidden' }] }),
    });

    const { executeGraphQL } = await import('../whatnot-graphql');
    const result = await executeGraphQL({
      accessToken: 'tok',
      environment: 'PRODUCTION',
      query: 'query { me { id } }',
    });

    expect(result.status).toBe(403);
    expect(result.data).toBeNull();
    expect(result.errors).not.toBeNull();
  });

  it('handles HTTP error with unparseable body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error('Invalid JSON'); },
    });

    const { executeGraphQL } = await import('../whatnot-graphql');
    const result = await executeGraphQL({
      accessToken: 'tok',
      environment: 'PRODUCTION',
      query: 'query { me { id } }',
    });

    expect(result.status).toBe(500);
    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.message).toContain('500');
  });

  it('handles network failure gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const { executeGraphQL } = await import('../whatnot-graphql');
    const result = await executeGraphQL({
      accessToken: 'tok',
      environment: 'PRODUCTION',
      query: 'query { me { id } }',
    });

    expect(result.status).toBe(0);
    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.message).toContain('ECONNREFUSED');
  });

  it('uses production URL by default', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    });

    const { executeGraphQL } = await import('../whatnot-graphql');
    await executeGraphQL({ accessToken: 'tok', environment: 'PRODUCTION', query: 'query { me { id } }' });

    expect(mockFetch.mock.calls[0]![0]).toBe('https://api.whatnot.com/seller-api/graphql');
  });

  it('uses staging URL when environment is STAGING', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    });

    const { executeGraphQL } = await import('../whatnot-graphql');
    await executeGraphQL({ accessToken: 'tok', environment: 'STAGING', query: 'query { me { id } }' });

    expect(mockFetch.mock.calls[0]![0]).toBe('https://api.stage.whatnot.com/seller-api/graphql');
  });

  it('returns data:null and errors:null when 200 OK but body is not parseable JSON', async () => {
    // Edge case: response.ok=true but json() throws — returns { data: null, errors: null, status: 200 }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new Error('Invalid JSON'); },
    });

    const { executeGraphQL } = await import('../whatnot-graphql');
    const result = await executeGraphQL({
      accessToken: 'tok',
      environment: 'PRODUCTION',
      query: 'query { me { id } }',
    });

    expect(result.status).toBe(200);
    expect(result.data).toBeNull();
    expect(result.errors).toBeNull();
  });

  it('returns both data and errors when response has partial data with errors', async () => {
    // GraphQL partial success: data returned alongside errors
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: { listings: { nodes: [{ id: 'l1' }] } },
        errors: [{ message: 'Some field error', path: ['listings', '0', 'price'] }],
      }),
    });

    const { executeGraphQL } = await import('../whatnot-graphql');
    const result = await executeGraphQL({
      accessToken: 'tok',
      environment: 'PRODUCTION',
      query: 'query { listings { nodes { id price { amount } } } }',
    });

    // When errors present, still returns partial data
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]?.message).toBe('Some field error');
    expect(result.status).toBe(200);
  });

  it('uses fallback error message when HTTP error has no errors array in body', async () => {
    // HTTP error with parseable body but no errors array -> synthesized error message
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ data: null }), // no errors key
    });

    const { executeGraphQL } = await import('../whatnot-graphql');
    const result = await executeGraphQL({
      accessToken: 'expired-tok',
      environment: 'PRODUCTION',
      query: 'query { me { id } }',
    });

    expect(result.status).toBe(401);
    expect(result.data).toBeNull();
    // Fallback: errors array should contain synthesized HTTP message
    expect(result.errors).not.toBeNull();
    expect(result.errors?.[0]?.message).toContain('401');
  });
});

describe('getGraphQLUrl', () => {
  it('returns production URL for PRODUCTION environment', async () => {
    const { getGraphQLUrl } = await import('../whatnot-graphql');
    expect(getGraphQLUrl('PRODUCTION')).toBe('https://api.whatnot.com/seller-api/graphql');
  });

  it('returns staging URL for STAGING environment', async () => {
    const { getGraphQLUrl } = await import('../whatnot-graphql');
    expect(getGraphQLUrl('STAGING')).toBe('https://api.stage.whatnot.com/seller-api/graphql');
  });

  it('returns production URL for unknown environment (default)', async () => {
    const { getGraphQLUrl } = await import('../whatnot-graphql');
    // Any non-STAGING value falls back to production
    expect(getGraphQLUrl('UNKNOWN')).toBe('https://api.whatnot.com/seller-api/graphql');
  });
});
