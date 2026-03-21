/**
 * Phase C Integration: Trust & Monetization
 * Tests seller finance pages, offers, returns.
 */
import { describe, it, expect } from 'vitest';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function get(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, { redirect: 'follow' });
}

describe('Phase C — Trust & Monetization', () => {
  it('seller offers page renders', async () => {
    const resp = await get('/my/selling/offers');
    expect(resp.status).toBe(200);
  });

  it('seller returns page renders', async () => {
    const resp = await get('/my/selling/returns');
    expect(resp.status).toBe(200);
  });

  it('finance overview renders', async () => {
    const resp = await get('/my/selling/finances');
    expect(resp.status).toBe(200);
  });

  it('finance sub-pages render', async () => {
    const pages = ['/my/selling/finances/transactions',
      '/my/selling/finances/payouts', '/my/selling/finances/statements'];
    for (const page of pages) {
      const resp = await get(page);
      expect(resp.status, `${page} should be 200`).toBe(200);
    }
  });
});
