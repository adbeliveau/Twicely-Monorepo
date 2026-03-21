'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, ShoppingCart, Tag, Plus, MessageSquare, User } from 'lucide-react';
import { cn } from '@twicely/utils/cn';
import type { UserCapabilities } from '@/types/hub';

interface NavItemProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}

function NavItem({ href, icon: Icon, label, active }: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-1 py-2',
        active ? 'text-[#7C3AED]' : 'text-muted-foreground'
      )}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
      <span className="text-xs">{label}</span>
    </Link>
  );
}

export function HubBottomNav({ capabilities }: { capabilities: UserCapabilities }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  // Canonical §10: Different nav for sellers vs non-sellers
  const items = capabilities.isSeller
    ? [
        { href: '/my', icon: LayoutDashboard, label: 'Dashboard' },
        { href: '/my/selling/orders', icon: ShoppingCart, label: 'Orders' },
        { href: '/my/selling/listings', icon: Tag, label: 'Listings' },
        { href: '/my/messages', icon: MessageSquare, label: 'Messages' },
        { href: '/my/settings', icon: User, label: 'Profile' },
      ]
    : [
        { href: '/my', icon: LayoutDashboard, label: 'Dashboard' },
        { href: '/my/buying/orders', icon: Package, label: 'Purchases' },
        { href: '/sell', icon: Plus, label: 'Sell' },
        { href: '/my/messages', icon: MessageSquare, label: 'Messages' },
        { href: '/my/settings', icon: User, label: 'Profile' },
      ];

  return (
    <nav aria-label="Hub mobile navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex">
        {items.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={isActive(item.href)}
          />
        ))}
      </div>
    </nav>
  );
}
