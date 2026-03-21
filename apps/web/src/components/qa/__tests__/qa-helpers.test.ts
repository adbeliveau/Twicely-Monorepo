import { describe, it, expect } from 'vitest';
import {
  shouldShowAskForm,
  shouldShowSellerActions,
  getQuestionCountLabel,
  isSubmitDisabled,
} from '../qa-helpers';

// ─── shouldShowAskForm ────────────────────────────────────────────────────────

describe('shouldShowAskForm', () => {
  it('returns true when userId is present and listing is not own', () => {
    expect(shouldShowAskForm('user-test-001', false)).toBe(true);
  });

  it('returns false when userId is null (guest user)', () => {
    expect(shouldShowAskForm(null, false)).toBe(false);
  });

  it('returns false when isOwnListing is true', () => {
    expect(shouldShowAskForm('user-test-001', true)).toBe(false);
  });

  it('returns false when userId is null and isOwnListing is true', () => {
    // Both conditions fail — still false
    expect(shouldShowAskForm(null, true)).toBe(false);
  });

  it('returns true for a non-null userId — only null blocks the form', () => {
    expect(shouldShowAskForm('any-user', false)).toBe(true);
  });

  it('returns false only for null, not for other falsy userId values', () => {
    // The type is string | null, so empty string is a valid non-null string.
    // '' !== null is true, so an empty-string userId still passes the null check.
    expect(shouldShowAskForm('', false)).toBe(true);
  });
});

// ─── shouldShowSellerActions ──────────────────────────────────────────────────

describe('shouldShowSellerActions', () => {
  it('returns true when isOwnListing is true', () => {
    expect(shouldShowSellerActions(true)).toBe(true);
  });

  it('returns false when isOwnListing is false', () => {
    expect(shouldShowSellerActions(false)).toBe(false);
  });

  it('mirrors the isOwnListing boolean exactly', () => {
    const values = [true, false];
    for (const v of values) {
      expect(shouldShowSellerActions(v)).toBe(v);
    }
  });
});

// ─── getQuestionCountLabel ────────────────────────────────────────────────────

describe('getQuestionCountLabel', () => {
  it('returns correct format for positive count', () => {
    expect(getQuestionCountLabel(5)).toBe('Questions & Answers (5)');
  });

  it('returns correct format for count of 1', () => {
    expect(getQuestionCountLabel(1)).toBe('Questions & Answers (1)');
  });

  it('returns correct format for count of zero', () => {
    expect(getQuestionCountLabel(0)).toBe('Questions & Answers (0)');
  });

  it('returns correct format for large count', () => {
    expect(getQuestionCountLabel(100)).toBe('Questions & Answers (100)');
  });

  it('includes the ampersand in "Questions & Answers"', () => {
    const label = getQuestionCountLabel(3);
    expect(label).toContain('&');
    expect(label).toMatch(/^Questions & Answers \(\d+\)$/);
  });
});

// ─── isSubmitDisabled ─────────────────────────────────────────────────────────

describe('isSubmitDisabled', () => {
  const MAX = 500;

  it('returns true when text is empty', () => {
    expect(isSubmitDisabled('', MAX, false)).toBe(true);
  });

  it('returns true when text is only whitespace', () => {
    expect(isSubmitDisabled('   ', MAX, false)).toBe(true);
    expect(isSubmitDisabled('\t\n', MAX, false)).toBe(true);
  });

  it('returns true when text exceeds maxLength after trim', () => {
    const longText = 'A'.repeat(MAX + 1);
    expect(isSubmitDisabled(longText, MAX, false)).toBe(true);
  });

  it('returns true when isSubmitting is true', () => {
    expect(isSubmitDisabled('Valid question here?', MAX, true)).toBe(true);
  });

  it('returns false when text is valid and not submitting', () => {
    expect(isSubmitDisabled('Is this available?', MAX, false)).toBe(false);
  });

  it('returns false when text is exactly at maxLength', () => {
    const exactText = 'A'.repeat(MAX);
    expect(isSubmitDisabled(exactText, MAX, false)).toBe(false);
  });

  it('returns true when text is one char over maxLength', () => {
    const overText = 'A'.repeat(MAX + 1);
    expect(isSubmitDisabled(overText, MAX, false)).toBe(true);
  });

  it('trims before checking length — padded text within limit is allowed', () => {
    // 'A' * 498 + 2 spaces — trimmed is 498 chars which is <= 500
    const paddedText = 'A'.repeat(498) + '  ';
    expect(isSubmitDisabled(paddedText, MAX, false)).toBe(false);
  });

  it('trims before checking empty — whitespace-only is disabled', () => {
    // '   '.trim() === '' has length 0
    expect(isSubmitDisabled('   ', MAX, false)).toBe(true);
  });

  it('works with different maxLength values', () => {
    // answerQuestion uses MAX_LENGTH = 1000
    expect(isSubmitDisabled('Short answer.', 1000, false)).toBe(false);
    expect(isSubmitDisabled('A'.repeat(1001), 1000, false)).toBe(true);
    expect(isSubmitDisabled('A'.repeat(1000), 1000, false)).toBe(false);
  });

  it('returns true when both text empty and isSubmitting', () => {
    expect(isSubmitDisabled('', MAX, true)).toBe(true);
  });

  it('returns true when text exceeds maxLength AND isSubmitting', () => {
    expect(isSubmitDisabled('A'.repeat(MAX + 10), MAX, true)).toBe(true);
  });
});
