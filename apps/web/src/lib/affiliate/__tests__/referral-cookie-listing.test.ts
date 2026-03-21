/**
 * Tests for referral-cookie.ts — G3.6 additions:
 * LISTING_REF_COOKIE_NAME, getListingRefCookie(), clearListingRefCookie()
 *
 * The G1.6 functions are tested in referral-cookie.test.ts.
 * This file covers only the new listing-level attribution cookie helpers.
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
  LISTING_REF_COOKIE_NAME,
  getListingRefCookie,
  clearListingRefCookie,
  type ListingRefCookiePayload,
} from '../referral-cookie';

// ─── LISTING_REF_COOKIE_NAME ──────────────────────────────────────────────────

describe('LISTING_REF_COOKIE_NAME', () => {
  it('equals twicely_listing_ref', () => {
    expect(LISTING_REF_COOKIE_NAME).toBe('twicely_listing_ref');
  });

  it('is distinct from the regular referral cookie name (twicely_ref)', () => {
    expect(LISTING_REF_COOKIE_NAME).not.toBe('twicely_ref');
  });
});

// ─── getListingRefCookie ──────────────────────────────────────────────────────

describe('getListingRefCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const VALID_PAYLOAD: ListingRefCookiePayload = {
    referralId: 'ref-test-001',
    affiliateId: 'aff-test-001',
    affiliateCode: 'CREATOR123',
    clickedAt: '2026-03-13T10:00:00.000Z',
  };

  it('returns null when no cookie is present', async () => {
    mockCookiesGet.mockReturnValue(undefined);

    const result = await getListingRefCookie();

    expect(result).toBeNull();
    expect(mockCookiesGet).toHaveBeenCalledWith('twicely_listing_ref');
  });

  it('returns the parsed payload when cookie contains valid JSON', async () => {
    mockCookiesGet.mockReturnValue({ value: JSON.stringify(VALID_PAYLOAD) });

    const result = await getListingRefCookie();

    expect(result).toEqual(VALID_PAYLOAD);
  });

  it('returns referralId from the parsed payload', async () => {
    mockCookiesGet.mockReturnValue({ value: JSON.stringify(VALID_PAYLOAD) });

    const result = await getListingRefCookie();

    expect(result?.referralId).toBe('ref-test-001');
  });

  it('returns affiliateId from the parsed payload', async () => {
    mockCookiesGet.mockReturnValue({ value: JSON.stringify(VALID_PAYLOAD) });

    const result = await getListingRefCookie();

    expect(result?.affiliateId).toBe('aff-test-001');
  });

  it('returns affiliateCode from the parsed payload', async () => {
    mockCookiesGet.mockReturnValue({ value: JSON.stringify(VALID_PAYLOAD) });

    const result = await getListingRefCookie();

    expect(result?.affiliateCode).toBe('CREATOR123');
  });

  it('returns clickedAt from the parsed payload', async () => {
    mockCookiesGet.mockReturnValue({ value: JSON.stringify(VALID_PAYLOAD) });

    const result = await getListingRefCookie();

    expect(result?.clickedAt).toBe('2026-03-13T10:00:00.000Z');
  });

  it('returns null when cookie value is not valid JSON', async () => {
    mockCookiesGet.mockReturnValue({ value: 'not-valid-json{{{' });

    const result = await getListingRefCookie();

    expect(result).toBeNull();
  });

  it('returns null when cookie value is empty string', async () => {
    mockCookiesGet.mockReturnValue({ value: '' });

    const result = await getListingRefCookie();

    expect(result).toBeNull();
  });

  it('returns null when cookie has no value property', async () => {
    mockCookiesGet.mockReturnValue({ value: undefined });

    const result = await getListingRefCookie();

    expect(result).toBeNull();
  });

  it('reads with the correct cookie name twicely_listing_ref', async () => {
    mockCookiesGet.mockReturnValue(undefined);

    await getListingRefCookie();

    expect(mockCookiesGet).toHaveBeenCalledWith('twicely_listing_ref');
  });
});

// ─── clearListingRefCookie ────────────────────────────────────────────────────

describe('clearListingRefCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls delete with twicely_listing_ref', async () => {
    await clearListingRefCookie();

    expect(mockCookiesDelete).toHaveBeenCalledWith('twicely_listing_ref');
  });

  it('calls delete exactly once', async () => {
    await clearListingRefCookie();

    expect(mockCookiesDelete).toHaveBeenCalledTimes(1);
  });

  it('resolves without throwing', async () => {
    mockCookiesDelete.mockResolvedValue(undefined);

    await expect(clearListingRefCookie()).resolves.toBeUndefined();
  });

  it('does NOT delete the regular twicely_ref cookie', async () => {
    await clearListingRefCookie();

    expect(mockCookiesDelete).not.toHaveBeenCalledWith('twicely_ref');
  });
});
