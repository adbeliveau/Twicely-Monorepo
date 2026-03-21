import { describe, it, expect } from 'vitest';
import {
  LOCAL_MEETUP_QUICK_REPLIES,
  type LocalQuickReplyId,
} from '../local-quick-replies';

describe('LOCAL_MEETUP_QUICK_REPLIES', () => {
  it('contains exactly 4 quick replies', () => {
    expect(LOCAL_MEETUP_QUICK_REPLIES).toHaveLength(4);
  });

  it('each reply has id, label, and text fields', () => {
    for (const reply of LOCAL_MEETUP_QUICK_REPLIES) {
      expect(reply.id).toBeTruthy();
      expect(reply.label).toBeTruthy();
      expect(reply.text).toBeTruthy();
    }
  });

  it('has the expected reply IDs', () => {
    const ids = LOCAL_MEETUP_QUICK_REPLIES.map((r) => r.id);
    expect(ids).toContain('on-my-way');
    expect(ids).toContain('im-here');
    expect(ids).toContain('running-late');
    expect(ids).toContain('need-reschedule');
  });

  it('LocalQuickReplyId type covers all four IDs', () => {
    // Type-level test: valid IDs should be assignable
    const id1: LocalQuickReplyId = 'on-my-way';
    const id2: LocalQuickReplyId = 'im-here';
    const id3: LocalQuickReplyId = 'running-late';
    const id4: LocalQuickReplyId = 'need-reschedule';
    expect([id1, id2, id3, id4]).toHaveLength(4);
  });
});
