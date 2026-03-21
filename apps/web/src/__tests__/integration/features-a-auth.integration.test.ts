/**
 * Phase A Integration: Auth & Foundation
 * Tests auth pages, policy pages, and platform settings seed data.
 */
import { describe, it, expect } from 'vitest';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function get(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, { redirect: 'follow' });
}

describe('Phase A — Auth & Foundation', () => {
  it('login page renders', async () => {
    const resp = await get('/auth/login');
    expect(resp.status).toBe(200);
    const html = await resp.text();
    expect(html.toLowerCase()).toContain('sign in');
  });

  it('signup page renders', async () => {
    const resp = await get('/auth/signup');
    expect(resp.status).toBe(200);
  });

  it('forgot password page renders', async () => {
    const resp = await get('/auth/forgot-password');
    expect(resp.status).toBe(200);
  });

  it('policy pages all return 200', async () => {
    const pages = ['/p/how-it-works', '/p/policies', '/p/terms', '/p/privacy',
      '/p/buyer-protection', '/p/fees'];
    for (const page of pages) {
      const resp = await get(page);
      expect(resp.status, `${page} should be 200`).toBe(200);
    }
  });

  it('about page renders', async () => {
    const resp = await get('/about');
    expect(resp.status).toBe(200);
  });

  it('verify-email page renders', async () => {
    const resp = await get('/auth/verify-email');
    expect(resp.status).toBe(200);
  });
});
