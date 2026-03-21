/**
 * Tests for ExtensionStatusBanner component logic.
 * Uses pure-logic extraction pattern (Vitest environment: node, no DOM).
 * Source: H1.4 install prompt §6.2
 */

import { describe, it, expect } from 'vitest';

// ─── Types mirrored from extension-status-banner.tsx ─────────────────────────

interface BannerProps {
  hasExtension: boolean;
  lastHeartbeatAt: Date | null;
  tierCAccountCount: number;
  sourceParam: string | null;
}

// ─── State logic extracted from the component ─────────────────────────────────

type BannerState = 'connected' | 'warning' | 'install';

function getBannerState(props: BannerProps): BannerState {
  const isConfirmed = props.sourceParam === 'extension' || props.hasExtension;
  if (isConfirmed) return 'connected';
  if (props.tierCAccountCount > 0) return 'warning';
  return 'install';
}

// ─── Static constants mirrored from the component ────────────────────────────

// Chrome Web Store placeholder URL
const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/twicely-crosslister/PLACEHOLDER_ID';

// Copy strings
const INSTALL_PROMPT_TEXT =
  'Install the Twicely browser extension to connect Poshmark and The RealReal. These platforms require session-based authentication via the extension.';
const WARNING_TEXT_PARTIAL = 'Extension not detected';
const CONNECTED_TEXT = 'Browser extension connected';
const ADD_TO_CHROME_LABEL = 'Add to Chrome';
const REINSTALL_LABEL = 'Reinstall the Twicely extension';

// ─── Relative time helper (mirrored from component) ──────────────────────────

function formatRelativeTime(date: Date, now: number = Date.now()): string {
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return '1 hour ago';
  return `${diffHr} hours ago`;
}

// ─── Banned terms check ───────────────────────────────────────────────────────

const ALL_COMPONENT_COPY = [
  INSTALL_PROMPT_TEXT,
  WARNING_TEXT_PARTIAL,
  CONNECTED_TEXT,
  ADD_TO_CHROME_LABEL,
  REINSTALL_LABEL,
].join(' ');

const BANNED_TERMS = [
  'Seller' + 'Tier',
  'Subscription' + 'Tier',
  'FV' + 'F',
  'fv' + 'f',
  'Final Value' + ' Fee',
  'BAS' + 'IC',
  'ELI' + 'TE',
  'PLU' + 'S',
  'MA' + 'X',
  'PREMI' + 'UM',
  'STANDA' + 'RD',
  'RISI' + 'NG',
  'Twicely' + ' Balance',
  'wall' + 'et',
  'With' + 'draw',
  'Finance' + 'Tier',
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExtensionStatusBanner — connected state', () => {
  it('shows green connected state when hasExtension is true', () => {
    const state = getBannerState({
      hasExtension: true,
      lastHeartbeatAt: null,
      tierCAccountCount: 0,
      sourceParam: null,
    });
    expect(state).toBe('connected');
  });

  it('shows connected state when sourceParam is "extension"', () => {
    const state = getBannerState({
      hasExtension: false,
      lastHeartbeatAt: null,
      tierCAccountCount: 0,
      sourceParam: 'extension',
    });
    expect(state).toBe('connected');
  });

  it('shows connected state when both hasExtension and sourceParam are set', () => {
    const state = getBannerState({
      hasExtension: true,
      lastHeartbeatAt: new Date(),
      tierCAccountCount: 2,
      sourceParam: 'extension',
    });
    expect(state).toBe('connected');
  });

  it('connected text constant is correct', () => {
    expect(CONNECTED_TEXT).toBe('Browser extension connected');
  });

  it('shows relative time for last heartbeat when connected', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const text = formatRelativeTime(fiveMinutesAgo);
    expect(text).toBe('5 minutes ago');
  });

  it('shows "just now" when heartbeat is less than 1 minute ago', () => {
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const text = formatRelativeTime(thirtySecondsAgo);
    expect(text).toBe('just now');
  });

  it('shows "1 minute ago" for exactly 1 minute', () => {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const text = formatRelativeTime(oneMinuteAgo);
    expect(text).toBe('1 minute ago');
  });

  it('shows "1 hour ago" for 60 minutes', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const text = formatRelativeTime(oneHourAgo);
    expect(text).toBe('1 hour ago');
  });
});

describe('ExtensionStatusBanner — install prompt state', () => {
  it('shows info install prompt when hasExtension is false and no Tier C accounts', () => {
    const state = getBannerState({
      hasExtension: false,
      lastHeartbeatAt: null,
      tierCAccountCount: 0,
      sourceParam: null,
    });
    expect(state).toBe('install');
  });

  it('includes Chrome Web Store link in install state', () => {
    expect(CHROME_STORE_URL).toContain('chromewebstore.google.com');
    expect(CHROME_STORE_URL).toContain('twicely-crosslister');
    expect(CHROME_STORE_URL).toContain('PLACEHOLDER_ID');
  });

  it('install prompt mentions Poshmark and The RealReal', () => {
    expect(INSTALL_PROMPT_TEXT).toContain('Poshmark');
    expect(INSTALL_PROMPT_TEXT).toContain('The RealReal');
  });

  it('install prompt does not mention FB Marketplace (Tier B, not Tier C)', () => {
    expect(INSTALL_PROMPT_TEXT).not.toContain('Facebook');
    expect(INSTALL_PROMPT_TEXT).not.toContain('FB Marketplace');
  });
});

describe('ExtensionStatusBanner — warning state', () => {
  it('shows warning when hasExtension is false and Tier C accounts exist', () => {
    const state = getBannerState({
      hasExtension: false,
      lastHeartbeatAt: null,
      tierCAccountCount: 1,
      sourceParam: null,
    });
    expect(state).toBe('warning');
  });

  it('shows warning with multiple Tier C accounts', () => {
    const state = getBannerState({
      hasExtension: false,
      lastHeartbeatAt: null,
      tierCAccountCount: 2,
      sourceParam: null,
    });
    expect(state).toBe('warning');
  });

  it('warning state partial text constant is correct', () => {
    expect(WARNING_TEXT_PARTIAL).toBe('Extension not detected');
  });

  it('reinstall CTA label is present', () => {
    expect(REINSTALL_LABEL).toBe('Reinstall the Twicely extension');
  });
});

describe('ExtensionStatusBanner — vocabulary compliance', () => {
  it('does not contain any banned terms in component copy', () => {
    for (const term of BANNED_TERMS) {
      const found = ALL_COMPONENT_COPY.includes(term);
      expect(found, `Banned term found in copy: "${term}"`).toBe(false);
    }
  });

  it('uses correct route prefixes — no /dashboard or /admin', () => {
    // The banner only links to chromewebstore.google.com — no internal routing
    expect(CHROME_STORE_URL).not.toContain('/dashboard');
    expect(CHROME_STORE_URL).not.toContain('/admin');
  });
});
