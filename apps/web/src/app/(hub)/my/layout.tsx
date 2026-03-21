import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getUserCapabilities } from '@/lib/queries/user-capabilities';
import { getUnreadCount } from '@/lib/queries/messaging';
import { getRecentNotifications, getUnreadCount as getUnreadNotificationCount } from '@/lib/queries/notifications';
import { HubSidebar } from '@/components/hub/hub-sidebar';
import { HubTopbar } from '@/components/hub/hub-topbar';
import { HubBottomNav } from '@/components/hub/hub-bottom-nav';
import { SkipNav } from '@/components/shared/skip-nav';

export const dynamic = 'force-dynamic';

export default async function MyHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/auth/login?callbackUrl=/my');

  const [capabilities, { total: unreadMessageCount }, notifications, unreadNotificationCount] =
    await Promise.all([
      getUserCapabilities(session.user.id),
      getUnreadCount(session.user.id),
      getRecentNotifications(session.user.id),
      getUnreadNotificationCount(session.user.id),
    ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <SkipNav />
      <HubSidebar capabilities={capabilities} unreadMessageCount={unreadMessageCount} />
      <div className="flex-1 flex flex-col min-w-0">
        <HubTopbar
          user={{
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            image: session.user.image,
          }}
          capabilities={capabilities}
          notifications={notifications}
          unreadNotificationCount={unreadNotificationCount}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>
      <HubBottomNav capabilities={capabilities} />
    </div>
  );
}
