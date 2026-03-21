/**
 * G10.8 impersonation — edge cases NOT covered by the primary test file.
 *
 * Covers:
 *  A. verifyImpersonationToken branches missed by impersonation.test.ts
 *     - missing secret returns null (not throw)
 *     - wrong-length signature exits the constant-time loop early
 *     - valid HMAC over payload whose fields have wrong types → null
 *     - empty payload / empty signature segments → null
 *  B. CASL ability — combined platform roles
 *     - non-admin role + SUPPORT → can impersonate
 *     - non-admin role + ADMIN → can impersonate (admin path wins)
 *     - custom role granting 'impersonate' on 'User' is honoured for agent
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';

// ---------------------------------------------------------------------------
// next/headers must be mocked before importing impersonation.ts
// ---------------------------------------------------------------------------
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import {
  createImpersonationToken,
  verifyImpersonationToken,
  type ImpersonationTokenPayload,
} from '../impersonation';

import { defineAbilitiesFor } from '@twicely/casl/ability';
import type { CaslSession, PlatformRole } from '@twicely/casl/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SECRET = 'test-secret-32-bytes-long-at-least';

const VALID_PAYLOAD: ImpersonationTokenPayload = {
  targetUserId: 'user-edge-001',
  staffUserId: 'staff-edge-001',
  staffDisplayName: 'Edge Tester',
  expiresAt: Date.now() + 15 * 60 * 1000,
};

/** Build a token with a valid HMAC over arbitrary payload bytes. */
function signPayloadBytes(payloadBase64url: string, secret: string): string {
  const sig = createHmac('sha256', secret)
    .update(payloadBase64url)
    .digest('hex');
  return `${payloadBase64url}.${sig}`;
}

function makeStaffSession(
  roles: PlatformRole[],
  customRolePermissions?: Array<{ subject: string; action: string }>
): CaslSession {
  return {
    userId: 'staff-combo-001',
    email: 'combo@hub.twicely.co',
    isSeller: false,
    sellerId: null,
    sellerStatus: null,
    delegationId: null,
    onBehalfOfSellerId: null,
    onBehalfOfSellerProfileId: null,
    delegatedScopes: [],
    isPlatformStaff: true,
    platformRoles: roles,
    customRolePermissions,
  };
}

// ---------------------------------------------------------------------------
// Part A: verifyImpersonationToken — branches not covered by primary tests
// ---------------------------------------------------------------------------

describe('verifyImpersonationToken — uncovered branches', () => {
  beforeEach(() => {
    vi.stubEnv('IMPERSONATION_SECRET', VALID_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when IMPERSONATION_SECRET becomes unset after token was created', () => {
    // Sign with valid secret, then remove it — verify catches the throw and returns null
    const token = createImpersonationToken(VALID_PAYLOAD);
    vi.stubEnv('IMPERSONATION_SECRET', undefined as unknown as string);
    expect(verifyImpersonationToken(token)).toBeNull();
  });

  it('returns null for a signature shorter than the expected HMAC hex (early-exit length check)', () => {
    // HMAC-SHA256 produces 64 hex chars; 32-char string triggers the length early-exit at line 66
    const token = createImpersonationToken(VALID_PAYLOAD);
    const payloadPart = token.split('.')[0]!;
    expect(verifyImpersonationToken(`${payloadPart}.${'a'.repeat(32)}`)).toBeNull();
  });

  it('returns null for a signature longer than the expected HMAC hex', () => {
    const token = createImpersonationToken(VALID_PAYLOAD);
    const payloadPart = token.split('.')[0]!;
    expect(verifyImpersonationToken(`${payloadPart}.${'b'.repeat(128)}`)).toBeNull();
  });

  it('returns null for a validly-signed token where expiresAt is a string (type mismatch)', () => {
    const badPayload = {
      targetUserId: 'user-edge-001',
      staffUserId: 'staff-edge-001',
      staffDisplayName: 'Edge Tester',
      expiresAt: String(Date.now() + 15 * 60 * 1000), // string, not number
    };
    const encoded = Buffer.from(JSON.stringify(badPayload)).toString('base64url');
    expect(verifyImpersonationToken(signPayloadBytes(encoded, VALID_SECRET))).toBeNull();
  });

  it('returns null for a validly-signed token missing targetUserId', () => {
    const badPayload = {
      staffUserId: 'staff-edge-001',
      staffDisplayName: 'Edge Tester',
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    const encoded = Buffer.from(JSON.stringify(badPayload)).toString('base64url');
    expect(verifyImpersonationToken(signPayloadBytes(encoded, VALID_SECRET))).toBeNull();
  });

  it('returns null for a validly-signed token missing staffDisplayName', () => {
    const badPayload = {
      targetUserId: 'user-edge-001',
      staffUserId: 'staff-edge-001',
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    const encoded = Buffer.from(JSON.stringify(badPayload)).toString('base64url');
    expect(verifyImpersonationToken(signPayloadBytes(encoded, VALID_SECRET))).toBeNull();
  });

  it('returns null for a validly-signed token whose payload is a JSON array', () => {
    // Arrays pass JSON.parse but typeof .targetUserId will be undefined
    const encoded = Buffer.from(JSON.stringify([1, 2, 3])).toString('base64url');
    expect(verifyImpersonationToken(signPayloadBytes(encoded, VALID_SECRET))).toBeNull();
  });

  it('returns null for a token with an empty payload segment (dot at position 0)', () => {
    // ".someSignature" — encodedPayload === ''
    expect(verifyImpersonationToken('.someSignature')).toBeNull();
  });

  it('returns null for a token with an empty signature segment', () => {
    const token = createImpersonationToken(VALID_PAYLOAD);
    const payloadPart = token.split('.')[0]!;
    // "payload." — providedSig === ''
    expect(verifyImpersonationToken(`${payloadPart}.`)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Part B: CASL ability — combined platform roles
// ---------------------------------------------------------------------------

describe('CASL impersonate — combined platform roles', () => {
  it('HELPDESK_AGENT + SUPPORT: SUPPORT grants impersonate despite agent role', () => {
    const ability = defineAbilitiesFor(makeStaffSession(['HELPDESK_AGENT', 'SUPPORT']));
    expect(ability.can('impersonate', 'User')).toBe(true);
  });

  it('MODERATION + SUPPORT: SUPPORT grants impersonate', () => {
    const ability = defineAbilitiesFor(makeStaffSession(['MODERATION', 'SUPPORT']));
    expect(ability.can('impersonate', 'User')).toBe(true);
  });

  it('MODERATION + ADMIN: admin path grants impersonate', () => {
    const ability = defineAbilitiesFor(makeStaffSession(['MODERATION', 'ADMIN']));
    expect(ability.can('impersonate', 'User')).toBe(true);
  });

  it('HELPDESK_AGENT + SUPER_ADMIN: super-admin path grants impersonate', () => {
    const ability = defineAbilitiesFor(makeStaffSession(['HELPDESK_AGENT', 'SUPER_ADMIN']));
    expect(ability.can('impersonate', 'User')).toBe(true);
  });

  it('FINANCE + DEVELOPER: neither role grants impersonate', () => {
    const ability = defineAbilitiesFor(makeStaffSession(['FINANCE', 'DEVELOPER']));
    expect(ability.can('impersonate', 'User')).toBe(false);
  });

  it('custom role granting impersonate/User is additive for agent-only staff', () => {
    // HELPDESK_AGENT alone cannot impersonate; custom role adds it
    const ability = defineAbilitiesFor(makeStaffSession(
      ['HELPDESK_AGENT'],
      [{ action: 'impersonate', subject: 'User' }]
    ));
    expect(ability.can('impersonate', 'User')).toBe(true);
  });

  it('unrelated custom role permission does not grant impersonate', () => {
    const ability = defineAbilitiesFor(makeStaffSession(
      ['HELPDESK_AGENT'],
      [{ action: 'read', subject: 'User' }]
    ));
    expect(ability.can('impersonate', 'User')).toBe(false);
  });
});
