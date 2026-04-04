'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, MessageSquare, User } from 'lucide-react';
import { cn } from '@twicely/utils';

const navItems = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Search, label: 'Search', href: '/s' },
  { icon: Plus, label: 'Sell', href: '/my/selling/listings/new' },
  { icon: MessageSquare, label: 'Messages', href: '/my/messages' },
  { icon: User, label: 'My', href: '/my' },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') {
      return pathname === '/';
    }
    if (href === '/my/messages') {
      return pathname === '/my/messages' || pathname.startsWith('/my/messages/');
    }
    return pathname.startsWith(href);
  }

  return (
    <nav aria-label="Mobile navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-[64px] flex-col items-center justify-center gap-1 py-2',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <item.icon
                aria-hidden="true"
                className={cn('h-5 w-5', active && 'fill-current')}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
