/**
 * Tests for referral-cookie.ts — REFERRAL_COOKIE_NAME constant,
 * getReferralIdFromCookie(), and clearReferralCookie() (G1.6)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock variables ───────────────────────────────────────────────────

const { mockCookiesGet, mockCookiesDelete, mockCookieStore } = vi.hoisted(() => {
  const mockCookiesGet = vi.fn();
  const mockCookiesDelete = vi.fn();
  const mockCookieStore = { get: mockCookiesGet, delete: mockCookiesDelete };
  return { mockCookiesGet, mockCookiesDelete, mockCookieStore };
});

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

// ─── Import module under test after mocks ─────────────────────────────────────

import {
  REFERRAL_COOKIE_NAME,
  getReferralIdFromCookie,
  clearReferralCookie,
} from '../referral-cookie';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('REFERRAL_COOKIE_NAME', () => {
  it('equals twicely_ref', () => {
    expect(REFERRAL_COOKIE_NAME).toBe('twicely_ref');
  });
});

describe('getReferralIdFromCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the referral ID when the cookie is set', async () => {
    mockCookiesGet.mockReturnValue({ value: 'ref-test-abc123' });

    const result = await getReferralIdFromCookie();

    expect(result).toBe('ref-test-abc123');
    expect(mockCookiesGet).toHaveBeenCalledWith('twicely_ref');
  });

  it('returns null when no cookie is set', async () => {
    mockCookiesGet.mockReturnValue(undefined);

    const result = await getReferralIdFromCookie();

    expect(result).toBeNull();
  });

  it('returns null when cookie exists but has no value property', async () => {
    mockCookiesGet.mockReturnValue({ value: undefined });

    const result = await getReferralIdFromCookie();

    expect(result).toBeNull();
  });
});

describe('clearReferralCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls delete with the correct cookie name', async () => {
    await clearReferralCookie();

    expect(mockCookiesDelete).toHaveBeenCalledWith('twicely_ref');
  });

  it('calls delete exactly once', async () => {
    await clearReferralCookie();

    expect(mockCookiesDelete).toHaveBeenCalledTimes(1);
  });

  it('resolves without throwing', async () => {
    mockCookiesDelete.mockResolvedValue(undefined);

    await expect(clearReferralCookie()).resolves.toBeUndefined();
  });
});
