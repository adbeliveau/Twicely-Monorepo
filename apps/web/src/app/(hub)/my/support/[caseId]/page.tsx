import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl/authorize';
import { getCaseDetail } from '@/lib/queries/helpdesk-cases';
import { formatDate } from '@twicely/utils/format';
import { ArrowLeft, MessageCircle, Lock, Info } from 'lucide-react';
import { CaseReplyForm } from '@/components/helpdesk/case-reply-form';
import { CsatForm } from '@/components/helpdesk/csat-form';
import { ReopenCaseButton } from '@/components/helpdesk/reopen-case-button';

export const metadata: Metadata = { title: 'Support Case | Twicely' };

type Props = { params: Promise<{ caseId: string }> };

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Received',
  OPEN: 'In Progress',
  PENDING_USER: 'Awaiting Your Reply',
  PENDING_INTERNAL: 'In Progress',
  ON_HOLD: 'On Hold',
  ESCALATED: 'Under Review',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  OPEN: 'bg-green-100 text-green-800',
  PENDING_USER: 'bg-amber-100 text-amber-800',
  PENDING_INTERNAL: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-gray-100 text-gray-700',
  ESCALATED: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-slate-100 text-slate-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

const EVENT_LABELS: Record<string, string> = {
  created: 'Case created',
  user_replied: 'You sent a reply',
  status_changed: 'Status updated',
  reopened: 'Case reopened',
  csat_submitted: 'Rating submitted',
};

export default async function SupportCaseDetailPage({ params }: Props) {
  const { caseId } = await params;

  const { session } = await authorize();
  if (!session) redirect('/auth/login');

  const caseDetail = await getCaseDetail(caseId, session.userId);
  if (!caseDetail) notFound();

  const isResolved = caseDetail.status === 'RESOLVED';
  const isClosed = caseDetail.status === 'CLOSED';
  const canReply = !isClosed && caseDetail.status !== 'ON_HOLD';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/my/support"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Support Cases
      </Link>

      {/* Case header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm font-semibold text-gray-500">
                {caseDetail.caseNumber}
              </span>
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[caseDetail.status] ?? 'bg-gray-100 text-gray-700'}`}
              >
                {STATUS_LABELS[caseDetail.status] ?? caseDetail.status}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 break-words">
              {caseDetail.subject}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Opened {formatDate(caseDetail.createdAt)} &middot; Last updated{' '}
              {formatDate(caseDetail.lastActivityAt)}
            </p>
          </div>

          {isResolved && (
            <ReopenCaseButton
              caseId={caseDetail.id}
              resolvedAt={caseDetail.resolvedAt}
            />
          )}
        </div>
      </div>

      {/* CSAT prompt for resolved cases */}
      {isResolved && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="text-sm font-semibold text-green-800 mb-1">
            How was your experience?
          </h2>
          <p className="text-sm text-green-700 mb-4">
            Your case has been resolved. Please take a moment to rate your support experience.
          </p>
          <CsatForm caseId={caseDetail.id} />
        </div>
      )}

      {/* Message timeline */}
      <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
        <div className="px-6 py-4 bg-gray-50 rounded-t-lg">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Conversation
          </h2>
        </div>

        <div className="divide-y divide-gray-100">
          {caseDetail.messages.length === 0 && caseDetail.events.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-gray-400">
              No messages yet.
            </div>
          )}

          {/* Merge messages + events and sort chronologically */}
          {buildTimeline(caseDetail.messages, caseDetail.events).map((item) => {
            if (item.kind === 'message') {
              const isInbound = item.direction === 'INBOUND';
              return (
                <div
                  key={`msg-${item.id}`}
                  className={`px-6 py-4 ${isInbound ? 'bg-white' : 'bg-blue-50'}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-700">
                      {isInbound ? 'You' : (item.senderName ?? 'Support Team')}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(item.createdAt, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                    {item.body}
                  </p>
                </div>
              );
            }

            // Event row
            return (
              <div
                key={`evt-${item.id}`}
                className="px-6 py-2 bg-gray-50 flex items-center gap-2"
              >
                <Info className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-500">
                  {EVENT_LABELS[item.eventType] ?? item.eventType}
                  {' — '}
                  {formatDate(item.createdAt, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            );
          })}
        </div>

        {/* Reply form */}
        {canReply ? (
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
            <p className="text-xs font-medium text-gray-600 mb-3">Reply to this case</p>
            <CaseReplyForm caseId={caseDetail.id} />
          </div>
        ) : isClosed ? (
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex items-center gap-2 text-sm text-gray-500">
            <Lock className="h-4 w-4" />
            This case is closed. To get further help,{' '}
            <Link href="/h/contact" className="text-blue-600 hover:underline">
              open a new case
            </Link>
            .
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Merge messages + events into a single sorted timeline
type MessageItem = {
  kind: 'message';
  id: string;
  direction: string;
  senderName: string | null;
  body: string;
  createdAt: Date;
};

type EventItem = {
  kind: 'event';
  id: string;
  eventType: string;
  createdAt: Date;
};

type TimelineItem = MessageItem | EventItem;

function buildTimeline(
  messages: Array<{ id: string; direction: string; senderName: string | null; body: string; createdAt: Date }>,
  events: Array<{ id: string; eventType: string; createdAt: Date }>
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...messages.map((m) => ({
      kind: 'message' as const,
      id: m.id,
      direction: m.direction,
      senderName: m.senderName,
      body: m.body,
      createdAt: m.createdAt,
    })),
    ...events.map((e) => ({
      kind: 'event' as const,
      id: e.id,
      eventType: e.eventType,
      createdAt: e.createdAt,
    })),
  ];

  return items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
