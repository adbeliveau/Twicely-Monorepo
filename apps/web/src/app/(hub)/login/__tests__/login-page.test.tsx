/**
 * Tests for HubLoginPage reason query param logic (G10.7).
 *
 * The vitest environment is node (no jsdom / @testing-library).
 * We test the pure message-selection logic extracted from the page.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure function mirrored from login/page.tsx
// ---------------------------------------------------------------------------

function resolveSessionMessage(reason: string | undefined): string | null {
  if (reason === 'inactivity') {
    return 'Your session expired due to inactivity. Please sign in again.';
  }
  if (reason === 'expired') {
    return 'Your session has expired. Please sign in again.';
  }
  return null;
}

function resolveHasError(error: string | undefined): boolean {
  return error === '1';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HubLoginPage - resolveSessionMessage', () => {
  it('should show inactivity message when reason=inactivity', () => {
    const msg = resolveSessionMessage('inactivity');
    expect(msg).toBe(
      'Your session expired due to inactivity. Please sign in again.'
    );
  });

  it('should show expired message when reason=expired', () => {
    const msg = resolveSessionMessage('expired');
    expect(msg).toBe('Your session has expired. Please sign in again.');
  });

  it('should show no message when no query params', () => {
    expect(resolveSessionMessage(undefined)).toBeNull();
  });

  it('should show no message for unknown reason values', () => {
    expect(resolveSessionMessage('unknown_value')).toBeNull();
    expect(resolveSessionMessage('admin')).toBeNull();
    expect(resolveSessionMessage('')).toBeNull();
  });

  it('inactivity message differs from expired message', () => {
    const inactivityMsg = resolveSessionMessage('inactivity');
    const expiredMsg = resolveSessionMessage('expired');
    expect(inactivityMsg).not.toBe(expiredMsg);
    expect(inactivityMsg).not.toBeNull();
    expect(expiredMsg).not.toBeNull();
  });
});

describe('HubLoginPage - resolveHasError', () => {
  it('should show invalid credentials message when error=1', () => {
    expect(resolveHasError('1')).toBe(true);
  });

  it('should not show error for other values', () => {
    expect(resolveHasError(undefined)).toBe(false);
    expect(resolveHasError('0')).toBe(false);
    expect(resolveHasError('2')).toBe(false);
    expect(resolveHasError('')).toBe(false);
  });
});

describe('HubLoginPage - combined params', () => {
  it('session message and error message are independent', () => {
    const sessionMsg = resolveSessionMessage('inactivity');
    const hasError = resolveHasError('1');
    // Both can coexist on the page
    expect(sessionMsg).not.toBeNull();
    expect(hasError).toBe(true);
  });

  it('no messages when no params', () => {
    const sessionMsg = resolveSessionMessage(undefined);
    const hasError = resolveHasError(undefined);
    expect(sessionMsg).toBeNull();
    expect(hasError).toBe(false);
  });
});
