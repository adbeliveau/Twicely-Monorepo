import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock next/headers before importing the module under test
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import {
  createImpersonationToken,
  verifyImpersonationToken,
  type ImpersonationTokenPayload,
} from '../impersonation';

const VALID_SECRET = 'test-secret-32-bytes-long-at-least';

const VALID_PAYLOAD: ImpersonationTokenPayload = {
  targetUserId: 'user-abc123',
  staffUserId: 'staff-xyz789',
  staffDisplayName: 'Test Staff',
  expiresAt: Date.now() + 15 * 60 * 1000,
};

describe('createImpersonationToken', () => {
  beforeEach(() => {
    vi.stubEnv('IMPERSONATION_SECRET', VALID_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a dot-separated two-part string', () => {
    const token = createImpersonationToken(VALID_PAYLOAD);
    const parts = token.split('.');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBeTruthy();
    expect(parts[1]).toBeTruthy();
  });

  it('encodes the payload as base64url in the first segment', () => {
    const token = createImpersonationToken(VALID_PAYLOAD);
    const encodedPayload = token.split('.')[0]!;
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as ImpersonationTokenPayload;
    expect(decoded.targetUserId).toBe(VALID_PAYLOAD.targetUserId);
    expect(decoded.staffUserId).toBe(VALID_PAYLOAD.staffUserId);
    expect(decoded.staffDisplayName).toBe(VALID_PAYLOAD.staffDisplayName);
    expect(decoded.expiresAt).toBe(VALID_PAYLOAD.expiresAt);
  });

  it('throws if IMPERSONATION_SECRET is undefined', () => {
    vi.stubEnv('IMPERSONATION_SECRET', undefined as unknown as string);
    expect(() => createImpersonationToken(VALID_PAYLOAD)).toThrow(
      'IMPERSONATION_SECRET is not configured'
    );
  });

  it('throws if IMPERSONATION_SECRET is empty string', () => {
    vi.stubEnv('IMPERSONATION_SECRET', '');
    expect(() => createImpersonationToken(VALID_PAYLOAD)).toThrow(
      'IMPERSONATION_SECRET is not configured'
    );
  });
});

describe('verifyImpersonationToken', () => {
  beforeEach(() => {
    vi.stubEnv('IMPERSONATION_SECRET', VALID_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the decoded payload for a valid unexpired token', () => {
    const token = createImpersonationToken(VALID_PAYLOAD);
    const result = verifyImpersonationToken(token);
    expect(result).not.toBeNull();
    expect(result?.targetUserId).toBe(VALID_PAYLOAD.targetUserId);
    expect(result?.staffUserId).toBe(VALID_PAYLOAD.staffUserId);
    expect(result?.staffDisplayName).toBe(VALID_PAYLOAD.staffDisplayName);
  });

  it('returns null when the payload is tampered', () => {
    const token = createImpersonationToken(VALID_PAYLOAD);
    const parts = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...VALID_PAYLOAD, targetUserId: 'evil-user' })
    ).toString('base64url');
    const tamperedToken = `${tamperedPayload}.${parts[1]}`;
    expect(verifyImpersonationToken(tamperedToken)).toBeNull();
  });

  it('returns null when the signature is tampered', () => {
    const token = createImpersonationToken(VALID_PAYLOAD);
    const parts = token.split('.');
    const tamperedToken = `${parts[0]}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
    expect(verifyImpersonationToken(tamperedToken)).toBeNull();
  });

  it('returns null for an expired token (expiresAt in the past)', () => {
    const expiredPayload: ImpersonationTokenPayload = {
      ...VALID_PAYLOAD,
      expiresAt: Date.now() - 1000,
    };
    const token = createImpersonationToken(expiredPayload);
    // Re-sign expired payload (createImpersonationToken throws on missing secret — secret is set)
    expect(verifyImpersonationToken(token)).toBeNull();
  });

  it('returns null for a token with only one segment', () => {
    expect(verifyImpersonationToken('onlyone')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(verifyImpersonationToken('')).toBeNull();
  });

  it('returns null for a token where payload is invalid JSON', () => {
    const badPayload = Buffer.from('not-json!!!').toString('base64url');
    // Need a valid-looking HMAC — but it won't match, so we expect null either way
    const token = `${badPayload}.invalidsignature`;
    expect(verifyImpersonationToken(token)).toBeNull();
  });
});
