/**
 * Phase G1 Integration: Affiliate, Promo Codes, Onboarding
 * Tests affiliate pages, onboarding wizard, referral handler.
 */
import { describe, it, expect } from 'vitest';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function get(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, { redirect: 'follow' });
}

describe('Phase G1 — Affiliate & Onboarding', () => {
  it('buyer onboarding page renders', async () => {
    const resp = await get('/auth/onboarding');
    expect(resp.status).toBe(200);
  });

  it('seller onboarding wizard renders', async () => {
    const resp = await get('/my/selling/onboarding');
    expect(resp.status).toBe(200);
  });

  it('affiliate dashboard renders', async () => {
    const resp = await get('/my/selling/affiliate');
    expect(resp.status).toBe(200);
  });

  it('affiliate referrals page renders', async () => {
    const resp = await get('/my/selling/affiliate/referrals');
    expect(resp.status).toBe(200);
  });

  it('affiliate payouts page renders', async () => {
    const resp = await get('/my/selling/affiliate/payouts');
    expect(resp.status).toBe(200);
  });

  it('new listing page with AI autofill renders', async () => {
    const resp = await get('/my/selling/listings/new');
    expect(resp.status).toBe(200);
  });
});
