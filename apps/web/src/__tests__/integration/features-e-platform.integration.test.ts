/**
 * Phase E Integration: Platform Infrastructure
 * Tests notifications, messaging, support, help center.
 */
import { describe, it, expect } from 'vitest';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function get(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, { redirect: 'follow' });
}

describe('Phase E — Platform Infrastructure', () => {
  it('notification preferences render', async () => {
    const resp = await get('/my/settings/notifications');
    expect(resp.status).toBe(200);
  });

  it('support page renders', async () => {
    const resp = await get('/my/support');
    expect(resp.status).toBe(200);
  });

  it('help center renders', async () => {
    const resp = await get('/h');
    expect(resp.status).toBe(200);
  });

  it('contact support page renders', async () => {
    const resp = await get('/h/contact');
    expect(resp.status).toBe(200);
  });

  it('messages page renders', async () => {
    const resp = await get('/my/messages');
    expect(resp.status).toBe(200);
  });
});
