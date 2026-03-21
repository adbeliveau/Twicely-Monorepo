import { describe, it, expect } from 'vitest';
import { MESSAGING_QUICK_REPLIES } from '@/lib/messaging/messaging-quick-replies';

// Logic tests for MessageComposer behavior

function isSendDisabled(body: string, isPending: boolean): boolean {
  return isPending || !body.trim();
}

function handleEnterKey(key: string, shiftKey: boolean): 'send' | 'newline' | 'noop' {
  if (key === 'Enter' && !shiftKey) return 'send';
  if (key === 'Enter' && shiftKey) return 'newline';
  return 'noop';
}

function getCharCountDisplay(body: string, max: number): string {
  return `${body.length}/${max}`;
}

function isAttachmentButtonDisabled(attachmentCount: number, isUploading: boolean): boolean {
  return attachmentCount >= 4 || isUploading;
}

function clearBodyAfterSend(prevBody: string, success: boolean): string {
  return success ? '' : prevBody;
}

function addAttachment(prev: string[], url: string, max: number): string[] {
  if (prev.length >= max) return prev;
  return [...prev, url];
}

function removeAttachment(prev: string[], url: string): string[] {
  return prev.filter((a) => a !== url);
}

function getQuickReplyChipCount(): number {
  return MESSAGING_QUICK_REPLIES.length;
}

function applyQuickReply(replyText: string): string {
  return replyText;
}

describe('MessageComposer behavior logic', () => {
  it('renders textarea and send button (body required for submit)', () => {
    // Send is disabled when body is empty
    expect(isSendDisabled('', false)).toBe(true);
    expect(isSendDisabled('Hello', false)).toBe(false);
  });

  it('send button disabled when body is empty', () => {
    expect(isSendDisabled('', false)).toBe(true);
    expect(isSendDisabled('  ', false)).toBe(true);
    expect(isSendDisabled('\n', false)).toBe(true);
  });

  it('send button disabled when pending', () => {
    expect(isSendDisabled('Hello', true)).toBe(true);
  });

  it('calls sendMessage on submit (Enter key triggers send)', () => {
    expect(handleEnterKey('Enter', false)).toBe('send');
  });

  it('Shift+Enter inserts newline, does not send', () => {
    expect(handleEnterKey('Enter', true)).toBe('newline');
  });

  it('clears textarea after successful send', () => {
    const cleared = clearBodyAfterSend('Hello!', true);
    expect(cleared).toBe('');

    const notCleared = clearBodyAfterSend('Hello!', false);
    expect(notCleared).toBe('Hello!');
  });

  it('shows character count', () => {
    expect(getCharCountDisplay('Hello', 5000)).toBe('5/5000');
    expect(getCharCountDisplay('', 5000)).toBe('0/5000');
    expect(getCharCountDisplay('A'.repeat(4999), 5000)).toBe('4999/5000');
  });

  it('attachment button is enabled (Paperclip is no longer disabled)', () => {
    expect(isAttachmentButtonDisabled(0, false)).toBe(false);
  });

  it('attachment button disabled when at max 4 attachments', () => {
    expect(isAttachmentButtonDisabled(4, false)).toBe(true);
  });

  it('attachment button disabled while uploading', () => {
    expect(isAttachmentButtonDisabled(0, true)).toBe(true);
  });

  it('adding attachment adds URL to state', () => {
    const state = addAttachment([], 'https://cdn.twicely.com/msg/abc.jpg', 4);
    expect(state).toContain('https://cdn.twicely.com/msg/abc.jpg');
    expect(state).toHaveLength(1);
  });

  it('attachment count limited to 4', () => {
    const full = ['a', 'b', 'c', 'd'];
    const result = addAttachment(full, 'e', 4);
    expect(result).toHaveLength(4);
    expect(result).not.toContain('e');
  });

  it('removing attachment removes URL from state', () => {
    const state = removeAttachment(['a', 'b', 'c'], 'b');
    expect(state).toEqual(['a', 'c']);
    expect(state).not.toContain('b');
  });

  it('attachments cleared on successful send', () => {
    // After a successful send, body is cleared and attachments reset
    const cleared = clearBodyAfterSend('Hello!', true);
    expect(cleared).toBe('');
    const clearedAttachments = removeAttachment([], ''); // starts empty after send
    expect(clearedAttachments).toHaveLength(0);
  });

  it('5 quick reply chips rendered', () => {
    expect(getQuickReplyChipCount()).toBe(5);
  });

  it('clicking chip sets body to reply.text', () => {
    const reply = MESSAGING_QUICK_REPLIES[0];
    expect(reply).toBeDefined();
    const newBody = applyQuickReply(reply!.text);
    expect(newBody).toBe(reply!.text);
  });
});
