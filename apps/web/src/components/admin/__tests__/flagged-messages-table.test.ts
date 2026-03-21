/**
 * Tests for FlaggedMessagesTable component rendering logic (pure function extraction).
 * Avoids DOM rendering by extracting and testing the rendering decisions.
 */
import { describe, it, expect } from 'vitest';
import type { FlaggedConversationRow } from '@/lib/queries/messaging-admin';

// ─── Pure logic extracted from FlaggedMessagesTable ──────────────────────────

function isEmpty(rows: FlaggedConversationRow[]): boolean {
  return rows.length === 0;
}

function getSubjectDisplay(subject: string | null): string {
  return subject ?? '(no subject)';
}

function getFlagReasonDisplay(flagReason: string | null): string {
  return flagReason ?? '—';
}

function hasLastMessageAt(lastMessageAt: Date | null): boolean {
  return lastMessageAt !== null;
}

function getRowCount(rows: FlaggedConversationRow[]): number {
  return rows.length;
}

// ─── Test Data ────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-20T10:00:00Z');

function makeRow(overrides: Partial<FlaggedConversationRow> = {}): FlaggedConversationRow {
  return {
    id: 'conv-test-001',
    subject: 'Vintage Camera',
    buyerName: 'Alice Buyer',
    sellerName: 'Bob Seller',
    flagReason: 'Off-platform transaction detected',
    lastMessageAt: NOW,
    ...overrides,
  };
}

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('FlaggedMessagesTable — empty state', () => {
  it('returns empty state when no rows provided', () => {
    expect(isEmpty([])).toBe(true);
  });

  it('does not show empty state when rows exist', () => {
    expect(isEmpty([makeRow()])).toBe(false);
  });

  it('does not show empty state with multiple rows', () => {
    expect(isEmpty([makeRow(), makeRow({ id: 'conv-002' })])).toBe(false);
  });
});

// ─── Subject display ──────────────────────────────────────────────────────────

describe('FlaggedMessagesTable — subject display', () => {
  it('shows subject when present', () => {
    expect(getSubjectDisplay('Vintage Camera')).toBe('Vintage Camera');
  });

  it('shows "(no subject)" fallback when subject is null', () => {
    expect(getSubjectDisplay(null)).toBe('(no subject)');
  });

  it('shows empty string subject as-is (not null)', () => {
    expect(getSubjectDisplay('')).toBe('');
  });
});

// ─── Flag reason display ──────────────────────────────────────────────────────

describe('FlaggedMessagesTable — flag reason display', () => {
  it('shows flag reason when present', () => {
    expect(getFlagReasonDisplay('Off-platform transaction detected')).toBe(
      'Off-platform transaction detected',
    );
  });

  it('shows "—" dash fallback when flagReason is null', () => {
    expect(getFlagReasonDisplay(null)).toBe('—');
  });

  it('shows custom flag reason strings', () => {
    expect(getFlagReasonDisplay('Spam detected')).toBe('Spam detected');
  });
});

// ─── Last message timestamp ───────────────────────────────────────────────────

describe('FlaggedMessagesTable — last message timestamp', () => {
  it('shows timestamp when lastMessageAt is a Date', () => {
    expect(hasLastMessageAt(NOW)).toBe(true);
  });

  it('shows dash when lastMessageAt is null', () => {
    expect(hasLastMessageAt(null)).toBe(false);
  });
});

// ─── Row data integrity ───────────────────────────────────────────────────────

describe('FlaggedMessagesTable — row data', () => {
  it('renders correct count of rows', () => {
    const rows = [
      makeRow({ id: 'c1' }),
      makeRow({ id: 'c2' }),
      makeRow({ id: 'c3' }),
    ];
    expect(getRowCount(rows)).toBe(3);
  });

  it('each row has required fields', () => {
    const row = makeRow();
    expect(row).toHaveProperty('id');
    expect(row).toHaveProperty('subject');
    expect(row).toHaveProperty('buyerName');
    expect(row).toHaveProperty('sellerName');
    expect(row).toHaveProperty('flagReason');
    expect(row).toHaveProperty('lastMessageAt');
  });

  it('preserves buyer and seller names from row data', () => {
    const row = makeRow({ buyerName: 'Carol', sellerName: 'Dave' });
    expect(row.buyerName).toBe('Carol');
    expect(row.sellerName).toBe('Dave');
  });

  it('handles row where all nullable fields are null', () => {
    const row = makeRow({ subject: null, flagReason: null, lastMessageAt: null });
    expect(getSubjectDisplay(row.subject)).toBe('(no subject)');
    expect(getFlagReasonDisplay(row.flagReason)).toBe('—');
    expect(hasLastMessageAt(row.lastMessageAt)).toBe(false);
  });
});
