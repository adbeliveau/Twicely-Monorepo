/**
 * Tests for messaging-quick-replies.ts — static chip definitions.
 */
import { describe, it, expect } from 'vitest';
import { MESSAGING_QUICK_REPLIES } from '../messaging-quick-replies';

describe('MESSAGING_QUICK_REPLIES', () => {
  it('has exactly 5 entries', () => {
    expect(MESSAGING_QUICK_REPLIES).toHaveLength(5);
  });

  it('all entries have unique IDs', () => {
    const ids = MESSAGING_QUICK_REPLIES.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all entries have non-empty labels', () => {
    for (const reply of MESSAGING_QUICK_REPLIES) {
      expect(reply.label.length).toBeGreaterThan(0);
    }
  });

  it('all entries have non-empty texts', () => {
    for (const reply of MESSAGING_QUICK_REPLIES) {
      expect(reply.text.length).toBeGreaterThan(0);
    }
  });

  it('includes the "still-available" entry', () => {
    const entry = MESSAGING_QUICK_REPLIES.find((r) => r.id === 'still-available');
    expect(entry).toBeDefined();
    expect(entry?.label).toBe('Still available');
  });

  it('includes the "shipping-soon" entry', () => {
    const entry = MESSAGING_QUICK_REPLIES.find((r) => r.id === 'shipping-soon');
    expect(entry).toBeDefined();
  });

  it('includes the "measurements" entry', () => {
    const entry = MESSAGING_QUICK_REPLIES.find((r) => r.id === 'measurements');
    expect(entry).toBeDefined();
  });

  it('includes the "bundle" entry', () => {
    const entry = MESSAGING_QUICK_REPLIES.find((r) => r.id === 'bundle');
    expect(entry).toBeDefined();
  });

  it('includes the "best-offer" entry', () => {
    const entry = MESSAGING_QUICK_REPLIES.find((r) => r.id === 'best-offer');
    expect(entry).toBeDefined();
  });
});
