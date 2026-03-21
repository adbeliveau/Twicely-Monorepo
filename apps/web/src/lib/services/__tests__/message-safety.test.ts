/**
 * Tests for message-safety.ts — pure function, no mocking required.
 * Covers: checkMessageSafety (off-platform detection)
 */
import { describe, it, expect } from 'vitest';
import { checkMessageSafety } from '../message-safety';

// ─── Clean messages ───────────────────────────────────────────────────────────

describe('checkMessageSafety — clean messages', () => {
  it('returns not-flagged for a normal, safe message', () => {
    const result = checkMessageSafety('Is this jacket still available?');

    expect(result.isFlagged).toBe(false);
    expect(result.flagReason).toBeNull();
  });

  it('returns not-flagged for an empty string', () => {
    const result = checkMessageSafety('');

    expect(result.isFlagged).toBe(false);
    expect(result.flagReason).toBeNull();
  });

  it('does not flag "payroll" which contains a keyword substring', () => {
    // "paypal" uses includes() by design — "payroll" does NOT contain "paypal"
    const result = checkMessageSafety('I get my payroll every two weeks');

    expect(result.isFlagged).toBe(false);
  });

  it('does not flag a URL that is not an email address', () => {
    // Must contain @ to match the email pattern
    const result = checkMessageSafety('Check out twicely.co for more listings');

    expect(result.isFlagged).toBe(false);
  });
});

// ─── Phone number detection ───────────────────────────────────────────────────

describe('checkMessageSafety — phone number detection', () => {
  it('flags a phone number in dashed format (555-123-4567)', () => {
    const result = checkMessageSafety('Call me at 555-123-4567 to discuss');

    expect(result.isFlagged).toBe(true);
    expect(result.flagReason).toBe('Off-platform transaction detected');
  });

  it('flags a phone number with spaces (555 123 4567)', () => {
    // The pattern uses \b which requires a word boundary before the digits.
    // Parenthesized format (555) 123-4567 does NOT match due to the leading paren.
    const result = checkMessageSafety('Reach me at 555 123 4567');

    expect(result.isFlagged).toBe(true);
    expect(result.flagReason).toBe('Off-platform transaction detected');
  });

  it('does NOT flag parenthesized format (555) 123-4567 — pattern boundary limitation', () => {
    // The \b word boundary before \d{3} fails when preceded by ")" — documented limitation.
    const result = checkMessageSafety('Reach me at (555) 123-4567');

    expect(result.isFlagged).toBe(false);
  });

  it('flags a phone number with dots (555.123.4567)', () => {
    const result = checkMessageSafety('Text me at 555.123.4567');

    expect(result.isFlagged).toBe(true);
    expect(result.flagReason).toBe('Off-platform transaction detected');
  });

  it('flags a plain 10-digit number with no separators', () => {
    const result = checkMessageSafety('My number is 5551234567');

    expect(result.isFlagged).toBe(true);
  });
});

// ─── Email detection ──────────────────────────────────────────────────────────

describe('checkMessageSafety — email address detection', () => {
  it('flags a standard email address', () => {
    const result = checkMessageSafety('Email me at user@example.com');

    expect(result.isFlagged).toBe(true);
    expect(result.flagReason).toBe('Off-platform transaction detected');
  });

  it('flags an email with subdomain', () => {
    const result = checkMessageSafety('Reach me at buyer@mail.domain.org');

    expect(result.isFlagged).toBe(true);
  });
});

// ─── Payment keyword detection ────────────────────────────────────────────────

describe('checkMessageSafety — payment keyword detection', () => {
  it('flags "venmo" mention', () => {
    const result = checkMessageSafety('Can you send payment via Venmo?');

    expect(result.isFlagged).toBe(true);
    expect(result.flagReason).toBe('Off-platform transaction detected');
  });

  it('flags "cashapp" mention', () => {
    const result = checkMessageSafety('Send it through CashApp please');

    expect(result.isFlagged).toBe(true);
  });

  it('flags "cash app" (two words) mention', () => {
    const result = checkMessageSafety('Do you accept Cash App?');

    expect(result.isFlagged).toBe(true);
  });

  it('flags "paypal" mention', () => {
    const result = checkMessageSafety('I can pay via PayPal');

    expect(result.isFlagged).toBe(true);
  });

  it('flags "zelle" mention', () => {
    const result = checkMessageSafety('Zelle works for me');

    expect(result.isFlagged).toBe(true);
  });

  it('flags "wire transfer" mention', () => {
    const result = checkMessageSafety('I can do a wire transfer');

    expect(result.isFlagged).toBe(true);
  });

  it('flags "western union" mention', () => {
    const result = checkMessageSafety('Western Union is fine');

    expect(result.isFlagged).toBe(true);
  });

  it('flags "bitcoin" mention', () => {
    const result = checkMessageSafety('I only accept Bitcoin');

    expect(result.isFlagged).toBe(true);
  });

  it('flags "btc" mention', () => {
    const result = checkMessageSafety('Pay me in BTC');

    expect(result.isFlagged).toBe(true);
  });

  it('flags "crypto" mention', () => {
    const result = checkMessageSafety('Do you accept crypto?');

    expect(result.isFlagged).toBe(true);
  });

  it('flags "money order" mention', () => {
    const result = checkMessageSafety('I can send a money order');

    expect(result.isFlagged).toBe(true);
  });
});

// ─── Case insensitivity ───────────────────────────────────────────────────────

describe('checkMessageSafety — case insensitive detection', () => {
  it('flags keyword in ALL CAPS (VENMO)', () => {
    const result = checkMessageSafety('Send money via VENMO');

    expect(result.isFlagged).toBe(true);
  });

  it('flags keyword in mixed case (PayPal)', () => {
    const result = checkMessageSafety('PayPal is easiest for me');

    expect(result.isFlagged).toBe(true);
  });

  it('flags keyword in title case (Zelle)', () => {
    const result = checkMessageSafety('Use Zelle to pay');

    expect(result.isFlagged).toBe(true);
  });
});

// ─── Return shape ─────────────────────────────────────────────────────────────

describe('checkMessageSafety — return shape', () => {
  it('always returns an object with isFlagged and flagReason', () => {
    const result = checkMessageSafety('Hello there');

    expect(result).toHaveProperty('isFlagged');
    expect(result).toHaveProperty('flagReason');
  });

  it('flagReason is always the same string for all flag types', () => {
    const phoneResult = checkMessageSafety('Call 555-123-4567');
    const emailResult = checkMessageSafety('Email user@example.com');
    const keywordResult = checkMessageSafety('Pay via venmo');

    expect(phoneResult.flagReason).toBe('Off-platform transaction detected');
    expect(emailResult.flagReason).toBe('Off-platform transaction detected');
    expect(keywordResult.flagReason).toBe('Off-platform transaction detected');
  });
});
