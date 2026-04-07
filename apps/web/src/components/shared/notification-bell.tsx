'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@twicely/ui/dropdown-menu';
import { markAsRead, markAllAsRead } from '@/lib/actions/notifications';
import { cn } from '@twicely/utils';
import type { NotificationSummary } from '@/lib/queries/notifications';

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

interface NotificationBellProps {
  notifications: NotificationSummary[];
  unreadCount: number;
}

export function NotificationBell({ notifications, unreadCount }: NotificationBellProps) {
  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild suppressHydrationWarning>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-label={`${unreadCount > 99 ? '99+' : unreadCount} unread notifications`}
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="min-h-[44px] min-w-[44px] text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <>
            {notifications.map((notif) => (
              <DropdownMenuItem
                key={notif.id}
                className={cn(
                  'flex flex-col items-start gap-1 cursor-pointer',
                  !notif.isRead && 'bg-muted/50'
                )}
                onClick={() => !notif.isRead && handleMarkAsRead(notif.id)}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="font-medium text-sm line-clamp-1">
                    {notif.subject ?? notif.templateKey}
                  </span>
                  {!notif.isRead && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground line-clamp-2">
                  {notif.body}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(new Date(notif.createdAt))}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="justify-center">
              <Link href="/my/settings/notifications" className="text-sm">
                Manage notifications
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
