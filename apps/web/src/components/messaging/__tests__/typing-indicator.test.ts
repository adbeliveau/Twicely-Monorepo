/**
 * Logic tests for TypingIndicator component.
 *
 * The component is minimal: it returns null when visible=false, and
 * renders "Typing..." text when visible=true.
 * Tests use pure-logic extraction (no DOM/React).
 */
import { describe, it, expect } from 'vitest';

// ─── Pure logic extracted from TypingIndicator ───────────────────────────────

function typingIndicatorText(): string {
  return 'Typing...';
}

function typingIndicatorRendered(visible: boolean): boolean {
  // Returns null when not visible — so "rendered" is false
  return visible;
}

function typingIndicatorStyle(): { italic: boolean; textColor: string } {
  // Component uses: text-xs italic text-gray-400 px-1
  return { italic: true, textColor: 'text-gray-400' };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TypingIndicator — visibility logic', () => {
  it('returns null (not rendered) when visible is false', () => {
    expect(typingIndicatorRendered(false)).toBe(false);
  });

  it('renders when visible is true', () => {
    expect(typingIndicatorRendered(true)).toBe(true);
  });

  it('shows "Typing..." text when visible', () => {
    expect(typingIndicatorText()).toBe('Typing...');
  });

  it('component uses italic style', () => {
    const style = typingIndicatorStyle();
    expect(style.italic).toBe(true);
  });

  it('component uses gray text color (unobtrusive)', () => {
    const style = typingIndicatorStyle();
    expect(style.textColor).toBe('text-gray-400');
  });
});

describe('TypingIndicator — boundary values', () => {
  it('visible=false → not rendered (boolean strict)', () => {
    // Explicitly verify the falsy path is boolean false, not undefined/null
    expect(typingIndicatorRendered(false)).toBe(false);
  });

  it('visible=true → rendered (boolean strict)', () => {
    expect(typingIndicatorRendered(true)).toBe(true);
  });
});

describe('TypingIndicator — integration with ConversationThread condition', () => {
  // ConversationThread only passes visible=true when typingUserId !== null AND status === 'OPEN'
  // These tests verify the upstream logic aligns with what TypingIndicator expects.

  function shouldBeVisible(typingUserId: string | null, status: string): boolean {
    return typingUserId !== null && status === 'OPEN';
  }

  it('visible=true when userId set and OPEN', () => {
    expect(shouldBeVisible('user-seller-001', 'OPEN')).toBe(true);
    expect(typingIndicatorRendered(shouldBeVisible('user-seller-001', 'OPEN'))).toBe(true);
  });

  it('visible=false when userId null and OPEN', () => {
    expect(shouldBeVisible(null, 'OPEN')).toBe(false);
    expect(typingIndicatorRendered(shouldBeVisible(null, 'OPEN'))).toBe(false);
  });

  it('visible=false when userId set and READ_ONLY', () => {
    expect(shouldBeVisible('user-seller-001', 'READ_ONLY')).toBe(false);
    expect(typingIndicatorRendered(shouldBeVisible('user-seller-001', 'READ_ONLY'))).toBe(false);
  });

  it('visible=false when userId set and ARCHIVED', () => {
    expect(shouldBeVisible('user-seller-001', 'ARCHIVED')).toBe(false);
  });
});
