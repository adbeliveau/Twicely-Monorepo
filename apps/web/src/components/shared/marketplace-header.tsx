import Link from 'next/link';
import { headers } from 'next/headers';
import { Logo } from './logo';
import { SearchBar } from './search-bar';
import { NotificationBell } from './notification-bell';
import { auth } from '@twicely/auth/server';
import { getUnreadCount, getRecentNotifications } from '@/lib/queries/notifications';

const NAV_LINKS = [
  { label: 'Women', href: '/c/womens-clothing' },
  { label: 'Men', href: '/c/mens-clothing' },
  { label: 'Luxury', href: '/c/luxury' },
  { label: 'Drops', href: '/explore' },
];

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
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-200 dark:bg-gray-900/90 dark:border-gray-700">
      <div className="mx-auto max-w-[1380px] grid grid-cols-[200px_1fr_auto] items-center gap-5 px-7 py-3.5">
        {/* Logo */}
        <Logo size="sm" />

        {/* Search bar — pill style */}
        <div className="hidden md:block">
          <SearchBar />
        </div>

        {/* Nav + Auth */}
        <nav aria-label="Main navigation" className="flex items-center gap-2.5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden lg:inline-flex px-3 py-1.5 text-sm font-bold text-gray-500 rounded-lg hover:text-gray-900 hover:bg-gray-50 transition-colors dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
            >
              {link.label}
            </Link>
          ))}

          {userId ? (
            <>
              <NotificationBell notifications={notifications} unreadCount={unreadCount} />
              <Link
                href="/my"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white border border-gray-200 px-5 py-2.5 text-sm font-extrabold text-gray-900 hover:border-gray-900 transition-colors dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white border border-gray-200 px-5 py-2.5 text-[13px] font-extrabold text-gray-900 hover:border-gray-900 transition-colors dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/become-seller"
                className="hidden sm:inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-[13px] font-extrabold text-white shadow-[0_8px_24px_rgba(233,30,203,0.25)] hover:bg-brand-600 hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(233,30,203,0.35)] transition-all"
              >
                Start selling
              </Link>
            </>
          )}
        </nav>
      </div>

      {/* Mobile search bar */}
      <div className="px-4 pb-3 md:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
