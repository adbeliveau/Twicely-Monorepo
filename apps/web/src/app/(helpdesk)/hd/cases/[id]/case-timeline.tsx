'use client';

/**
 * CaseTimeline — renders merged message + event timeline for the case workspace.
 * Split from case-workspace.tsx to stay under 300 lines.
 */

import { MessageBubble, Timeline, DateDivider } from '@/components/helpdesk/message-bubble';
import type { MessageType } from '@/components/helpdesk/message-bubble';

// ─── Types (shared with case-workspace) ─────────────────────────────────────

export type OptimisticMsg = {
  kind: 'message';
  id: string;
  createdAt: Date;
  direction: string;
  senderName: string | null;
  body: string;
  isOptimistic: true;
};

export type ServerTimelineItem =
  | { kind: 'message'; id: string; createdAt: Date; direction: string; senderName: string | null; body: string }
  | { kind: 'event'; id: string; createdAt: Date; eventType: string };

export type TimelineItem = ServerTimelineItem | OptimisticMsg;

// ─── Helpers ────────────────────────────────────────────────────────────────

export function isSameDay(a: Date | string, b: Date | string) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function directionToType(dir: string): MessageType {
  if (dir === 'INBOUND') return 'INBOUND';
  if (dir === 'INTERNAL') return 'INTERNAL';
  return 'OUTBOUND';
}

// ─── Component ──────────────────────────────────────────────────────────────

interface CaseTimelineProps {
  timeline: TimelineItem[];
}

export function CaseTimeline({ timeline }: CaseTimelineProps) {
  return (
    <Timeline className="flex-1">
      {timeline.map((item, index) => {
        const prev = index > 0 ? timeline[index - 1] : null;
        const showDate = !prev || !isSameDay(prev.createdAt, item.createdAt);
        if (item.kind === 'event') {
          return (
            <div key={`e-${item.id}`}>
              {showDate && <DateDivider date={item.createdAt} />}
              <div className="flex justify-center py-1">
                <span
                  className="rounded-full px-3 py-1 text-xs"
                  style={{ background: 'rgb(var(--hd-bg-card))', color: 'rgb(var(--hd-text-muted))' }}
                >
                  {item.eventType.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          );
        }
        const isOpt = 'isOptimistic' in item && item.isOptimistic;
        const authorName = item.senderName ?? (item.direction === 'INBOUND' ? 'User' : 'Agent');
        return (
          <div key={`m-${item.id}`} className={isOpt ? 'opacity-70' : undefined}>
            {showDate && <DateDivider date={item.createdAt} />}
            <MessageBubble
              type={directionToType(item.direction)}
              author={{ id: item.id, name: authorName }}
              body={item.body}
              createdAt={item.createdAt}
            />
            {isOpt && (
              <div className="flex justify-end px-4 pb-1">
                <span
                  className="text-[10px] animate-pulse"
                  style={{ color: 'rgb(var(--hd-text-dim))' }}
                >
                  Sending...
                </span>
              </div>
            )}
          </div>
        );
      })}
    </Timeline>
  );
}
