/**
 * Hub Admin Integration: All admin routes
 * Tests that every hub route returns 200 (staff session via SSR).
 */
import { describe, it, expect } from 'vitest';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function get(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, { redirect: 'follow' });
}

describe('Hub Admin Routes', () => {
  it('dashboard renders', async () => {
    const resp = await get('/d');
    expect(resp.status).toBe(200);
  });

  it('user management renders', async () => {
    const resp = await get('/usr');
    expect(resp.status).toBe(200);
  });

  it('transaction pages render', async () => {
    const pages = ['/tx', '/tx/orders', '/tx/payments'];
    for (const page of pages) {
      const resp = await get(page);
      expect(resp.status, `${page} should be 200`).toBe(200);
    }
  });

  it('finance pages render', async () => {
    const pages = ['/fin', '/fin/ledger', '/fin/payouts', '/fin/recon',
      '/fin/adjustments', '/fin/costs', '/fin/promo-codes'];
    for (const page of pages) {
      const resp = await get(page);
      expect(resp.status, `${page} should be 200`).toBe(200);
    }
  });

  it('moderation pages render', async () => {
    const pages = ['/mod', '/mod/listings', '/mod/messages', '/mod/reviews'];
    for (const page of pages) {
      const resp = await get(page);
      expect(resp.status, `${page} should be 200`).toBe(200);
    }
  });

  it('config page renders all tabs', async () => {
    const tabs = ['commerce', 'fulfillment', 'discovery', 'fees', 'payments',
      'trust', 'environment', 'integrations', 'comms', 'privacy', 'meetup-locations'];
    for (const tab of tabs) {
      const resp = await get(`/cfg?tab=${tab}`);
      expect(resp.status, `/cfg?tab=${tab} should be 200`).toBe(200);
    }
  });

  it('system pages render', async () => {
    const pages = ['/roles', '/audit', '/health', '/health/doctor', '/flags'];
    for (const page of pages) {
      const resp = await get(page);
      expect(resp.status, `${page} should be 200`).toBe(200);
    }
  });
});
