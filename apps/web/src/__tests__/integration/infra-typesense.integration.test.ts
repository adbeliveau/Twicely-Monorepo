/**
 * Integration test: Typesense
 * Requires: Typesense running on localhost:8108
 *
 * Tests health check, collection creation, document indexing, and search.
 */
import { describe, it, expect, afterAll } from 'vitest';

const TYPESENSE_URL = process.env.TYPESENSE_URL ?? 'http://127.0.0.1:8108';
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY ?? 'xyz';
const TEST_COLLECTION = 'integration_test_listings';

const headers = {
  'Content-Type': 'application/json',
  'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY,
};

describe('Typesense Integration', () => {
  afterAll(async () => {
    // Clean up test collection
    await fetch(`${TYPESENSE_URL}/collections/${TEST_COLLECTION}`, {
      method: 'DELETE',
      headers,
    }).catch(() => {});
  });

  it('returns healthy status', async () => {
    const resp = await fetch(`${TYPESENSE_URL}/health`);
    const data = await resp.json();
    expect(data.ok).toBe(true);
  });

  it('creates a collection', async () => {
    const schema = {
      name: TEST_COLLECTION,
      fields: [
        { name: 'title', type: 'string' as const },
        { name: 'priceCents', type: 'int32' as const },
        { name: 'category', type: 'string' as const, facet: true },
      ],
      default_sorting_field: 'priceCents',
    };

    const resp = await fetch(`${TYPESENSE_URL}/collections`, {
      method: 'POST',
      headers,
      body: JSON.stringify(schema),
    });
    expect(resp.status).toBe(201);
    const data = await resp.json();
    expect(data.name).toBe(TEST_COLLECTION);
  });

  it('indexes a document and searches for it', async () => {
    const doc = {
      id: 'listing-001',
      title: 'Nike Air Jordan 1 Retro High OG',
      priceCents: 18500,
      category: 'Sneakers',
    };

    // Index
    const indexResp = await fetch(
      `${TYPESENSE_URL}/collections/${TEST_COLLECTION}/documents`,
      { method: 'POST', headers, body: JSON.stringify(doc) },
    );
    expect(indexResp.status).toBe(201);

    // Search
    const params = new URLSearchParams({
      q: 'Nike Jordan',
      query_by: 'title',
    });
    const searchResp = await fetch(
      `${TYPESENSE_URL}/collections/${TEST_COLLECTION}/documents/search?${params}`,
      { headers },
    );
    const results = await searchResp.json();
    expect(results.found).toBe(1);
    expect(results.hits[0].document.title).toContain('Nike');
  });

  it('supports faceted search', async () => {
    const params = new URLSearchParams({
      q: '*',
      query_by: 'title',
      facet_by: 'category',
    });
    const resp = await fetch(
      `${TYPESENSE_URL}/collections/${TEST_COLLECTION}/documents/search?${params}`,
      { headers },
    );
    const data = await resp.json();
    expect(data.facet_counts).toBeDefined();
    expect(data.facet_counts.length).toBeGreaterThan(0);
  });
});
