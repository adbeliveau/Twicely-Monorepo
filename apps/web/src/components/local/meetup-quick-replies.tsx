'use client';

import { LOCAL_MEETUP_QUICK_REPLIES } from '@/lib/messaging/local-quick-replies';
import { Button } from '@twicely/ui/button';

interface MeetupQuickRepliesProps {
  /** Called when a quick-reply is selected; receives the reply text so the
   *  caller can populate the message compose field. */
  onSelect: (text: string) => void;
}

/**
 * Horizontal row of quick-reply buttons for local meetup conversations.
 * Renders above the message compose area when a conversation is linked
 * to a local order. Clicking a button populates the compose field with
 * the associated text; the user can edit before sending.
 */
export function MeetupQuickReplies({ onSelect }: MeetupQuickRepliesProps) {
  return (
    <div className="flex flex-wrap gap-2 py-2">
      {LOCAL_MEETUP_QUICK_REPLIES.map((reply) => (
        <Button
          key={reply.id}
          variant="outline"
          size="sm"
          onClick={() => onSelect(reply.text)}
          type="button"
        >
          {reply.label}
        </Button>
      ))}
    </div>
  );
}
