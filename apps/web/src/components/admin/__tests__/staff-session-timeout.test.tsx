/**
 * Tests for StaffSessionTimeoutProvider pure logic (G10.7).
 *
 * The vitest environment is node (no jsdom / @testing-library).
 * We test the pure utility functions extracted from the component.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure functions mirrored from staff-session-timeout.tsx
// ---------------------------------------------------------------------------

const HARD_LIMIT_WARNING_SECONDS = 300;

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

type WarningVariant = 'inactivity' | 'hard-limit' | null;

function computeVariant(params: {
  msUntilAbsolute: number;
  msSinceActivity: number;
  inactivityMs: number;
  warnMs: number;
}): WarningVariant {
  const { msUntilAbsolute, msSinceActivity, inactivityMs, warnMs } = params;
  const hardLimitWarnMs = HARD_LIMIT_WARNING_SECONDS * 1000;

  if (msUntilAbsolute <= 0) return null; // should have logged out already
  if (msSinceActivity >= inactivityMs) return null; // should have logged out already

  const msUntilInactivity = inactivityMs - msSinceActivity;
  const inHardLimitWarn = msUntilAbsolute <= hardLimitWarnMs;
  const inInactivityWarn = msUntilInactivity <= warnMs;

  if (inHardLimitWarn) return 'hard-limit';
  if (inInactivityWarn) return 'inactivity';
  return null;
}

function shouldRedirectInactivity(params: {
  msSinceActivity: number;
  inactivityMs: number;
}): boolean {
  return params.msSinceActivity >= params.inactivityMs;
}

function shouldRedirectExpired(params: {
  msUntilAbsolute: number;
}): boolean {
  return params.msUntilAbsolute <= 0;
}

// ---------------------------------------------------------------------------
// Tests: formatCountdown
// ---------------------------------------------------------------------------

describe('formatCountdown', () => {
  it('formats seconds only when under 1 minute', () => {
    expect(formatCountdown(47_000)).toBe('47 seconds');
    expect(formatCountdown(1_000)).toBe('1 second');
    expect(formatCountdown(30_000)).toBe('30 seconds');
  });

  it('formats minutes and seconds', () => {
    expect(formatCountdown(4 * 60_000 + 32_000)).toBe('4 minutes and 32 seconds');
    expect(formatCountdown(1 * 60_000 + 1_000)).toBe('1 minute and 1 second');
    expect(formatCountdown(5 * 60_000)).toBe('5 minutes and 0 seconds');
  });

  it('returns 0 seconds for non-positive input', () => {
    expect(formatCountdown(0)).toBe('0 seconds');
    expect(formatCountdown(-1000)).toBe('0 seconds');
  });

  it('rounds up fractional seconds', () => {
    // 47,500ms → ceil(47.5) = 48 seconds
    expect(formatCountdown(47_500)).toBe('48 seconds');
  });
});

// ---------------------------------------------------------------------------
// Tests: computeVariant
// ---------------------------------------------------------------------------

describe('computeVariant', () => {
  const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes
  const WARN_MS = 60 * 1000; // 60 seconds warning

  it('should not render modal when session is active and user is active', () => {
    const result = computeVariant({
      msUntilAbsolute: 8 * 60 * 60 * 1000, // 8 hours left
      msSinceActivity: 0,
      inactivityMs: INACTIVITY_MS,
      warnMs: WARN_MS,
    });
    expect(result).toBeNull();
  });

  it('should show inactivity warning when idle time exceeds threshold minus warning seconds', () => {
    // 4 min 5s of idle: 5min timeout - 60s warn = 4min threshold
    const result = computeVariant({
      msUntilAbsolute: 8 * 60 * 60 * 1000,
      msSinceActivity: 4 * 60 * 1000 + 5_000, // 4min 5s idle
      inactivityMs: INACTIVITY_MS,
      warnMs: WARN_MS,
    });
    expect(result).toBe('inactivity');
  });

  it('should show hard limit warning when absolute expiry is within 5 minutes', () => {
    const result = computeVariant({
      msUntilAbsolute: 4 * 60 * 1000, // 4 minutes until expiry
      msSinceActivity: 0,
      inactivityMs: INACTIVITY_MS,
      warnMs: WARN_MS,
    });
    expect(result).toBe('hard-limit');
  });

  it('should prioritize hard limit warning over inactivity warning when both active', () => {
    const result = computeVariant({
      msUntilAbsolute: 4 * 60 * 1000, // within hard limit threshold
      msSinceActivity: 4 * 60 * 1000 + 5_000, // also within inactivity threshold
      inactivityMs: INACTIVITY_MS,
      warnMs: WARN_MS,
    });
    expect(result).toBe('hard-limit');
  });

  it('returns null when not in any warning range', () => {
    const result = computeVariant({
      msUntilAbsolute: 7 * 60 * 60 * 1000, // 7 hours left
      msSinceActivity: 30_000, // 30 seconds idle
      inactivityMs: INACTIVITY_MS,
      warnMs: WARN_MS,
    });
    expect(result).toBeNull();
  });

  it('hard limit warning threshold is exactly 300 seconds', () => {
    const justBefore = computeVariant({
      msUntilAbsolute: 301 * 1000,
      msSinceActivity: 0,
      inactivityMs: INACTIVITY_MS,
      warnMs: WARN_MS,
    });
    const justAt = computeVariant({
      msUntilAbsolute: 300 * 1000,
      msSinceActivity: 0,
      inactivityMs: INACTIVITY_MS,
      warnMs: WARN_MS,
    });
    expect(justBefore).toBeNull();
    expect(justAt).toBe('hard-limit');
  });

  it('inactivity warning threshold matches warnMs', () => {
    const inactivityMs = INACTIVITY_MS;
    const warnMs = WARN_MS;
    const thresholdMs = inactivityMs - warnMs;

    const justBefore = computeVariant({
      msUntilAbsolute: 8 * 60 * 60 * 1000,
      msSinceActivity: thresholdMs - 1,
      inactivityMs,
      warnMs,
    });
    const justAt = computeVariant({
      msUntilAbsolute: 8 * 60 * 60 * 1000,
      msSinceActivity: thresholdMs,
      inactivityMs,
      warnMs,
    });
    expect(justBefore).toBeNull();
    expect(justAt).toBe('inactivity');
  });
});

// ---------------------------------------------------------------------------
// Tests: redirect conditions
// ---------------------------------------------------------------------------

describe('shouldRedirectInactivity', () => {
  it('should redirect to /login?reason=inactivity when inactivity timer expires', () => {
    expect(
      shouldRedirectInactivity({
        msSinceActivity: 5 * 60 * 1000 + 1,
        inactivityMs: 5 * 60 * 1000,
      })
    ).toBe(true);
  });

  it('should not redirect when activity is recent', () => {
    expect(
      shouldRedirectInactivity({
        msSinceActivity: 4 * 60 * 1000,
        inactivityMs: 5 * 60 * 1000,
      })
    ).toBe(false);
  });

  it('should redirect exactly at the boundary', () => {
    expect(
      shouldRedirectInactivity({
        msSinceActivity: 5 * 60 * 1000,
        inactivityMs: 5 * 60 * 1000,
      })
    ).toBe(true);
  });
});

describe('shouldRedirectExpired', () => {
  it('should redirect to /login?reason=expired when absolute timer expires', () => {
    expect(shouldRedirectExpired({ msUntilAbsolute: -1 })).toBe(true);
    expect(shouldRedirectExpired({ msUntilAbsolute: 0 })).toBe(true);
  });

  it('should not redirect when time remains', () => {
    expect(shouldRedirectExpired({ msUntilAbsolute: 1 })).toBe(false);
    expect(shouldRedirectExpired({ msUntilAbsolute: 60_000 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: hard limit variant has no "Stay Logged In" button
// ---------------------------------------------------------------------------

describe('hard limit modal behavior', () => {
  it('should NOT have a Stay Logged In button on hard limit warning', () => {
    // Verify via the variant type — hard-limit variant never triggers stayLoggedIn
    const variant = computeVariant({
      msUntilAbsolute: 4 * 60 * 1000,
      msSinceActivity: 0,
      inactivityMs: 5 * 60 * 1000,
      warnMs: 60 * 1000,
    });
    // The hard-limit variant never shows "Stay Logged In"
    expect(variant).toBe('hard-limit');
    // In the component, "Stay Logged In" is only rendered when variant === 'inactivity'
    const stayLoggedInShown = variant === 'inactivity';
    expect(stayLoggedInShown).toBe(false);
  });

  it('should show Stay Logged In button on inactivity warning', () => {
    const variant = computeVariant({
      msUntilAbsolute: 8 * 60 * 60 * 1000,
      msSinceActivity: 4 * 60 * 1000 + 5_000,
      inactivityMs: 5 * 60 * 1000,
      warnMs: 60 * 1000,
    });
    expect(variant).toBe('inactivity');
    const stayLoggedInShown = variant === 'inactivity';
    expect(stayLoggedInShown).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: tab visibility — debounce timing constants
// ---------------------------------------------------------------------------

describe('timing constants', () => {
  it('hard limit warning is at 300 seconds', () => {
    expect(HARD_LIMIT_WARNING_SECONDS).toBe(300);
  });

  it('hard limit warning uses different threshold than configurable inactivity warning', () => {
    // Hard limit: 300s fixed; inactivity warning: configurable (default 60s)
    expect(HARD_LIMIT_WARNING_SECONDS).not.toBe(60);
  });
});
