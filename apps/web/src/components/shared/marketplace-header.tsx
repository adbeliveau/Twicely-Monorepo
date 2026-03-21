import Link from 'next/link';
import { headers } from 'next/headers';
import { Logo } from './logo';
import { SearchBar } from './search-bar';
import { Button } from '@twicely/ui/button';
import { NotificationBell } from './notification-bell';
import { auth } from '@twicely/auth/server';
import { getUnreadCount, getRecentNotifications } from '@/lib/queries/notifications';

export async function MarketplaceHeader() {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  let notifications: Awaited<ReturnType<typeof getRecentNotifications>> = [];
  let unreadCount = 0;

  if (userId) {
    [notifications, unreadCount] = await Promise.all([
      getRecentNotifications(userId, 10),
      getUnreadCount(userId),
    ]);
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-4 px-4 md:h-16 md:px-6">
        {/* Logo */}
        <div className="flex-shrink-0">
          <Logo />
        </div>

        {/* Search bar - hidden on mobile, shown on md+ */}
        <div className="hidden flex-1 md:block md:max-w-xl md:px-4">
          <SearchBar />
        </div>

        {/* Nav links - desktop */}
        <nav aria-label="Main navigation" className="ml-auto flex items-center gap-2">
          <Button variant="ghost" asChild className="hidden md:inline-flex">
            <Link href="/my/selling/listings/new">Sell</Link>
          </Button>
          {userId ? (
            <>
              <NotificationBell notifications={notifications} unreadCount={unreadCount} />
              <Button variant="ghost" asChild>
                <Link href="/my">Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/auth/login">Log In</Link>
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>

      {/* Mobile search bar - below header on mobile only */}
      <div className="container px-4 pb-3 md:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
