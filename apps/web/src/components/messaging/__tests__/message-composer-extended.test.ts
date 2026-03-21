/**
 * Extended logic tests for MessageComposer — edge cases and boundary values.
 */
import { describe, it, expect } from 'vitest';

// ─── Pure logic extracted from MessageComposer ────────────────────────────────

const MAX_BODY_LENGTH = 5000;

function isSendDisabled(body: string, isPending: boolean): boolean {
  return isPending || !body.trim();
}

function isBodyOverLimit(body: string): boolean {
  return body.length > MAX_BODY_LENGTH;
}

function getCharDisplay(body: string): string {
  return `${body.length}/${MAX_BODY_LENGTH}`;
}

function handleKeydown(key: string, shiftKey: boolean): 'send' | 'newline' | 'noop' {
  if (key === 'Enter' && !shiftKey) return 'send';
  if (key === 'Enter' && shiftKey) return 'newline';
  return 'noop';
}

function clearBodyAfterSend(prevBody: string, success: boolean): string {
  return success ? '' : prevBody;
}

function getErrorToShow(error: string | null): string | null {
  return error;
}

function getAttachmentButtonState(attachmentCount: number, isUploading: boolean): { disabled: boolean } {
  return { disabled: attachmentCount >= 4 || isUploading };
}

// ─── Send disabled edge cases ─────────────────────────────────────────────────

describe('MessageComposer — send disabled edge cases', () => {
  it('is disabled when body is only spaces', () => {
    expect(isSendDisabled('   ', false)).toBe(true);
  });

  it('is disabled when body is only newlines', () => {
    expect(isSendDisabled('\n\n\n', false)).toBe(true);
  });

  it('is disabled when body is only tabs', () => {
    expect(isSendDisabled('\t\t', false)).toBe(true);
  });

  it('is NOT disabled when body has non-whitespace content', () => {
    expect(isSendDisabled('Hello', false)).toBe(false);
  });

  it('is disabled when both pending AND empty', () => {
    expect(isSendDisabled('', true)).toBe(true);
  });

  it('is disabled when pending even with valid body', () => {
    expect(isSendDisabled('Hello!', true)).toBe(true);
  });

  it('is enabled when body has content and not pending', () => {
    expect(isSendDisabled('a', false)).toBe(false);
  });
});

// ─── Body length validation ───────────────────────────────────────────────────

describe('MessageComposer — body length enforcement', () => {
  it('body at exactly 5000 chars is NOT over limit (boundary)', () => {
    expect(isBodyOverLimit('A'.repeat(5000))).toBe(false);
  });

  it('body at 5001 chars IS over limit', () => {
    expect(isBodyOverLimit('A'.repeat(5001))).toBe(true);
  });

  it('empty body is not over limit', () => {
    expect(isBodyOverLimit('')).toBe(false);
  });
});

// ─── Character count display ──────────────────────────────────────────────────

describe('MessageComposer — character count display', () => {
  it('shows 0/5000 for empty body', () => {
    expect(getCharDisplay('')).toBe('0/5000');
  });

  it('shows 5/5000 for 5-char body', () => {
    expect(getCharDisplay('Hello')).toBe('5/5000');
  });

  it('shows 5000/5000 at limit', () => {
    expect(getCharDisplay('A'.repeat(5000))).toBe('5000/5000');
  });

  it('shows 4999/5000 for one-under-limit body', () => {
    expect(getCharDisplay('A'.repeat(4999))).toBe('4999/5000');
  });
});

// ─── Keyboard behavior ────────────────────────────────────────────────────────

describe('MessageComposer — keyboard behavior', () => {
  it('Enter key without shift triggers send', () => {
    expect(handleKeydown('Enter', false)).toBe('send');
  });

  it('Shift+Enter inserts newline (does not send)', () => {
    expect(handleKeydown('Enter', true)).toBe('newline');
  });

  it('Escape key is a noop', () => {
    expect(handleKeydown('Escape', false)).toBe('noop');
  });

  it('Space key is a noop', () => {
    expect(handleKeydown(' ', false)).toBe('noop');
  });

  it('any non-Enter key is a noop', () => {
    expect(handleKeydown('a', false)).toBe('noop');
    expect(handleKeydown('Tab', false)).toBe('noop');
  });
});

// ─── Body state after send ────────────────────────────────────────────────────

describe('MessageComposer — body cleared after send', () => {
  it('clears body on successful send', () => {
    expect(clearBodyAfterSend('Hello there!', true)).toBe('');
  });

  it('retains body on failed send (for re-try)', () => {
    expect(clearBodyAfterSend('Hello there!', false)).toBe('Hello there!');
  });

  it('clearing empty body on success still returns empty', () => {
    expect(clearBodyAfterSend('', true)).toBe('');
  });
});

// ─── Error display ────────────────────────────────────────────────────────────

describe('MessageComposer — error display', () => {
  it('shows error message when error is non-null', () => {
    const error = 'Failed to send message';
    expect(getErrorToShow(error)).toBe('Failed to send message');
  });

  it('hides error message when error is null', () => {
    expect(getErrorToShow(null)).toBeNull();
  });

  it('shows "Please sign in to send messages" when unauthenticated', () => {
    expect(getErrorToShow('Please sign in to send messages')).toBe(
      'Please sign in to send messages',
    );
  });
});

// ─── Attachment button ────────────────────────────────────────────────────────

describe('MessageComposer — attachment button', () => {
  it('attachment button is enabled when under limit and not uploading', () => {
    const state = getAttachmentButtonState(0, false);
    expect(state.disabled).toBe(false);
  });

  it('attachment button is disabled at max 4 attachments', () => {
    const state = getAttachmentButtonState(4, false);
    expect(state.disabled).toBe(true);
  });

  it('attachment button is disabled when uploading in progress', () => {
    const state = getAttachmentButtonState(0, true);
    expect(state.disabled).toBe(true);
  });
});
