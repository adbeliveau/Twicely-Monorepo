'use client';

import { Menu } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { NotificationBell } from '@/components/shared/notification-bell';
import type { UserCapabilities } from '@/types/hub';
import type { NotificationSummary } from '@/lib/queries/notifications';

interface HubTopbarProps {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  capabilities: UserCapabilities;
  notifications: NotificationSummary[];
  unreadNotificationCount: number;
}

export function HubTopbar({ user, notifications, unreadNotificationCount }: HubTopbarProps) {
  const initial = user.name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <header className="h-14 border-b bg-background flex items-center px-4 gap-4">
      {/* Mobile hamburger */}
      <Button variant="ghost" size="icon" className="md:hidden">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        {/* Notification bell */}
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadNotificationCount}
        />

        {/* User avatar */}
        {user.image ? (
          <img
            src={user.image}
            alt={user.name}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div aria-label={user.name} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
            {initial}
          </div>
        )}

        {/* User name */}
        <span className="hidden sm:block text-sm text-muted-foreground">
          {user.name}
        </span>
      </div>
    </header>
  );
}
