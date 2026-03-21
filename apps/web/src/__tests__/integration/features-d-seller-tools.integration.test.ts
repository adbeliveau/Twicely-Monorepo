/**
 * Phase D Integration: Seller Tools
 * Tests analytics, store editor, promotions, staff, subscription pages.
 */
import { describe, it, expect } from 'vitest';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function get(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, { redirect: 'follow' });
}

describe('Phase D — Seller Tools', () => {
  it('analytics page renders', async () => {
    const resp = await get('/my/selling/analytics');
    expect(resp.status).toBe(200);
  });

  it('financial center pages render', async () => {
    const pages = ['/my/selling/finances/expenses',
      '/my/selling/finances/mileage', '/my/selling/finances/platforms'];
    for (const page of pages) {
      const resp = await get(page);
      expect(resp.status, `${page} should be 200`).toBe(200);
    }
  });

  it('store settings and editor render', async () => {
    const pages = ['/my/selling/store', '/my/selling/store/editor'];
    for (const page of pages) {
      const resp = await get(page);
      expect(resp.status, `${page} should be 200`).toBe(200);
    }
  });

  it('promotions pages render', async () => {
    const pages = ['/my/selling/promotions', '/my/selling/promoted'];
    for (const page of pages) {
      const resp = await get(page);
      expect(resp.status, `${page} should be 200`).toBe(200);
    }
  });

  it('staff management renders', async () => {
    const pages = ['/my/selling/staff', '/my/selling/staff/invite'];
    for (const page of pages) {
      const resp = await get(page);
      expect(resp.status, `${page} should be 200`).toBe(200);
    }
  });

  it('subscription page renders', async () => {
    const resp = await get('/my/selling/subscription');
    expect(resp.status).toBe(200);
  });
});
