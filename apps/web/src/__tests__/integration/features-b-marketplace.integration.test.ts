/**
 * Phase B Integration: Core Marketplace
 * Tests homepage, search, cart, pricing, and dashboard shells.
 */
import { describe, it, expect } from 'vitest';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function get(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, { redirect: 'follow' });
}

describe('Phase B — Core Marketplace', () => {
  it('homepage renders with content', async () => {
    const resp = await get('/');
    expect(resp.status).toBe(200);
    const html = await resp.text();
    expect(html.length).toBeGreaterThan(1000);
  });

  it('search page accepts query params', async () => {
    const resp = await get('/s?q=nike&sort=newest');
    expect(resp.status).toBe(200);
  });

  it('search page works without query', async () => {
    const resp = await get('/s');
    expect(resp.status).toBe(200);
  });

  it('cart page renders (empty cart OK)', async () => {
    const resp = await get('/cart');
    expect(resp.status).toBe(200);
  });

  it('pricing page renders with tier info', async () => {
    const resp = await get('/pricing');
    expect(resp.status).toBe(200);
    const html = await resp.text();
    expect(html).toMatch(/STARTER|PRO|POWER/i);
  });

  it('buyer dashboard pages render', async () => {
    const pages = ['/my', '/my/buying', '/my/buying/orders',
      '/my/buying/watchlist', '/my/buying/offers', '/my/buying/reviews'];
    for (const page of pages) {
      const resp = await get(page);
      expect(resp.status, `${page} should be 200`).toBe(200);
    }
  });

  it('seller dashboard pages render', async () => {
    const pages = ['/my/selling', '/my/selling/orders', '/my/selling/listings',
      '/my/selling/listings/new', '/my/selling/shipping'];
    for (const page of pages) {
      const resp = await get(page);
      expect(resp.status, `${page} should be 200`).toBe(200);
    }
  });

  it('settings pages render', async () => {
    const pages = ['/my/settings', '/my/settings/addresses', '/my/settings/security'];
    for (const page of pages) {
      const resp = await get(page);
      expect(resp.status, `${page} should be 200`).toBe(200);
    }
  });
});
