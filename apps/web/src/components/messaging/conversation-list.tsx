'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@twicely/ui/avatar';
import { Badge } from '@twicely/ui/badge';
import { formatDate } from '@twicely/utils/format';
import { cn } from '@twicely/utils/cn';
import type { ConversationSummary } from '@/lib/queries/messaging';

interface ConversationListProps {
  conversations: ConversationSummary[];
  currentUserId: string;
}

export function ConversationList({ conversations, currentUserId: _currentUserId }: ConversationListProps) {
  if (conversations.length === 0) {
    return null;
  }

  return (
    <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
      {conversations.map((conv) => {
        const isUnread = conv.unreadCount > 0;
        const initials = conv.otherPartyName
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        // Last message preview line
        let previewLine: React.ReactNode;
        if (conv.lastMessagePreview !== null) {
          previewLine = (
            <p className="text-xs text-gray-500 truncate">
              {conv.lastMessageSenderIsMe
                ? `You: ${conv.lastMessagePreview}`
                : conv.lastMessagePreview}
            </p>
          );
        } else if (conv.listingTitle) {
          previewLine = (
            <p className="text-xs text-gray-400 truncate">{conv.listingTitle}</p>
          );
        } else {
          previewLine = null;
        }

        return (
          <Link
            key={conv.id}
            href={`/my/messages/${conv.id}`}
            className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors"
          >
            {/* Avatar */}
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={conv.otherPartyImage ?? undefined} alt={conv.otherPartyName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={cn('text-sm truncate', isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700')}>
                  {conv.otherPartyName}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {conv.lastMessageAt && (
                    <span className="text-xs text-gray-400">
                      {formatDate(conv.lastMessageAt, 'relative')}
                    </span>
                  )}
                  {isUnread && (
                    <span className="h-2 w-2 rounded-full bg-blue-500" aria-label="Unread" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {previewLine}
                  {conv.status === 'READ_ONLY' && (
                    <Badge variant="secondary" className="mt-1 text-xs">Closed</Badge>
                  )}
                  {conv.status === 'ARCHIVED' && (
                    <Badge variant="outline" className="mt-1 text-xs">Archived</Badge>
                  )}
                </div>

                {/* Listing thumbnail */}
                {conv.listingImageUrl && (
                  <div className="shrink-0">
                    <Image
                      src={conv.listingImageUrl}
                      alt={conv.listingTitle ?? 'Listing'}
                      width={40}
                      height={40}
                      className="rounded object-cover h-10 w-10"
                    />
                  </div>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
