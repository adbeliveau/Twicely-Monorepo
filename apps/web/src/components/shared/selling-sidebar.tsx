'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@twicely/utils';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Banknote,
  CreditCard,
} from 'lucide-react';

const sidebarLinks = [
  {
    label: 'Overview',
    href: '/my/selling',
    icon: LayoutDashboard,
    disabled: false,
  },
  {
    label: 'Listings',
    href: '/my/selling/listings',
    icon: Package,
    disabled: false,
  },
  {
    label: 'Orders',
    href: '/my/selling/orders',
    icon: ShoppingCart,
    disabled: false,
  },
  {
    label: 'Finances',
    href: '/my/selling/finances',
    icon: Banknote,
    disabled: false,
  },
  {
    label: 'Payment Setup',
    href: '/my/selling/onboarding',
    icon: CreditCard,
    disabled: false,
  },
  {
    label: 'Analytics',
    href: '/my/selling/analytics',
    icon: BarChart3,
    disabled: true,
  },
];

export function SellingSidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/my/selling') {
      return pathname === '/my/selling';
    }
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex flex-col gap-1">
      {sidebarLinks.map((link) => {
        const active = isActive(link.href);
        const Icon = link.icon;

        if (link.disabled) {
          return (
            <div
              key={link.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground opacity-50 cursor-not-allowed"
            >
              <Icon className="h-4 w-4" />
              <span>{link.label}</span>
              <span className="ml-auto text-xs">Soon</span>
            </div>
          );
        }

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
