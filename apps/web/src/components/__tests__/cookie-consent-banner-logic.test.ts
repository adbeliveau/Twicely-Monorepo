import { describe, it, expect } from 'vitest';

/**
 * Pure logic tests for cookie consent banner behavior.
 *
 * The component runs in a browser (client component). These tests exercise
 * the pure logic functions that can be tested in node environment without DOM.
 *
 * readConsentCookie() has a typeof document === 'undefined' guard — in node
 * env it always returns null (SSR-safe behavior). Tests for the browser-side
 * cookie parsing are covered by extracting and testing the pure logic.
 */

const CONSENT_VERSION = '1';

// Mirror pure logic extracted from cookie-consent-banner.tsx
function isConsentFresh(consent: { version: string } | null): boolean {
  return consent !== null && consent.version === CONSENT_VERSION;
}

function parseConsentJson(raw: string): {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  timestamp: string;
  version: string;
} | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed.functional === 'boolean' &&
      typeof parsed.analytics === 'boolean' &&
      typeof parsed.version === 'string'
    ) {
      return {
        necessary: true,
        functional: parsed.functional,
        analytics: parsed.analytics,
        timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : '',
        version: parsed.version,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function buildConsentCookieValue(
  functional: boolean,
  analytics: boolean
): string {
  const state = {
    necessary: true,
    functional,
    analytics,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  return encodeURIComponent(JSON.stringify(state));
}

describe('Cookie consent banner — pure logic', () => {
  describe('parseConsentJson', () => {
    it('returns null for empty string', () => {
      expect(parseConsentJson('')).toBeNull();
    });

    it('returns null for malformed JSON', () => {
      expect(parseConsentJson('not-json')).toBeNull();
    });

    it('parses valid consent JSON with functional=true analytics=false', () => {
      const json = JSON.stringify({
        necessary: true,
        functional: true,
        analytics: false,
        timestamp: '2026-03-15T10:00:00Z',
        version: CONSENT_VERSION,
      });
      const result = parseConsentJson(json);
      expect(result).not.toBeNull();
      expect(result?.functional).toBe(true);
      expect(result?.analytics).toBe(false);
    });

    it('returns null when required fields are missing', () => {
      const json = JSON.stringify({ necessary: true });
      expect(parseConsentJson(json)).toBeNull();
    });
  });

  describe('isConsentFresh', () => {
    it('returns false for null consent', () => {
      expect(isConsentFresh(null)).toBe(false);
    });

    it('returns true when version matches current CONSENT_VERSION', () => {
      expect(isConsentFresh({ version: CONSENT_VERSION })).toBe(true);
    });

    it('returns false when version is outdated', () => {
      expect(isConsentFresh({ version: '0' })).toBe(false);
    });

    it('returns false when version is a future version', () => {
      expect(isConsentFresh({ version: '99' })).toBe(false);
    });
  });

  describe('buildConsentCookieValue', () => {
    it('encodes consent state as URL-encoded JSON', () => {
      const encoded = buildConsentCookieValue(true, false);
      const decoded = JSON.parse(decodeURIComponent(encoded)) as Record<string, unknown>;
      expect(decoded.necessary).toBe(true);
      expect(decoded.functional).toBe(true);
      expect(decoded.analytics).toBe(false);
      expect(decoded.version).toBe(CONSENT_VERSION);
    });

    it('includes timestamp as ISO string', () => {
      const encoded = buildConsentCookieValue(false, false);
      const decoded = JSON.parse(decodeURIComponent(encoded)) as Record<string, unknown>;
      expect(typeof decoded.timestamp).toBe('string');
      expect(decoded.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('banner visibility logic', () => {
    it('should show banner when consentRequired=true and no cookie exists', () => {
      const consentRequired = true;
      const existing = null; // no cookie
      const shouldShow = consentRequired && !isConsentFresh(existing);
      expect(shouldShow).toBe(true);
    });

    it('should not show banner when consentRequired=false', () => {
      const consentRequired = false;
      const shouldShow = consentRequired && !isConsentFresh(null);
      expect(shouldShow).toBe(false);
    });

    it('should not show banner when valid current-version consent exists', () => {
      const consentRequired = true;
      const existingConsent = {
        version: CONSENT_VERSION,
        functional: true,
        analytics: false,
        necessary: true as const,
        timestamp: '2026-03-15T10:00:00Z',
      };
      const shouldShow = consentRequired && !isConsentFresh(existingConsent);
      expect(shouldShow).toBe(false);
    });

    it('should show banner when consent cookie version is outdated', () => {
      const consentRequired = true;
      const outdatedConsent = {
        version: '0', // old version
        functional: true,
        analytics: true,
        necessary: true as const,
        timestamp: '2025-01-01T00:00:00Z',
      };
      const shouldShow = consentRequired && !isConsentFresh(outdatedConsent);
      expect(shouldShow).toBe(true);
    });

    it('strictly necessary cookies cannot be disabled (always forced true)', () => {
      // Strictly necessary is always true in the banner — cannot be toggled
      const consentState = buildConsentCookieValue(false, false);
      const decoded = JSON.parse(decodeURIComponent(consentState)) as Record<string, unknown>;
      expect(decoded.necessary).toBe(true);
    });
  });
});
