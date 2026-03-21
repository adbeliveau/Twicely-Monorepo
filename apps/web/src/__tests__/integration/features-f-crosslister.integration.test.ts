/**
 * Phase F Integration: Crosslister
 * Tests crosslister dashboard, connect, import, automation pages.
 */
import { describe, it, expect } from 'vitest';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function get(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, { redirect: 'follow' });
}

describe('Phase F — Crosslister', () => {
  it('crosslister dashboard renders', async () => {
    const resp = await get('/my/selling/crosslist');
    expect(resp.status).toBe(200);
  });

  it('connect platform page renders', async () => {
    const resp = await get('/my/selling/crosslist/connect');
    expect(resp.status).toBe(200);
  });

  it('import page renders', async () => {
    const resp = await get('/my/selling/crosslist/import');
    expect(resp.status).toBe(200);
  });

  it('import issues page renders', async () => {
    const resp = await get('/my/selling/crosslist/import/issues');
    expect(resp.status).toBe(200);
  });

  it('automation page renders', async () => {
    const resp = await get('/my/selling/crosslist/automation');
    expect(resp.status).toBe(200);
  });
});
