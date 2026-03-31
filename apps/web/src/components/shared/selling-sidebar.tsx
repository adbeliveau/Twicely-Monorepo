'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@twicely/utils';
import {
  Tag,
  ShoppingCart,
  HandCoins,
  RotateCcw,
  Truck,
  Megaphone,
  RefreshCw,
  Link as LinkIcon,
  Download,
  Zap,
  Palette,
  Layout,
  Users,
  DollarSign,
  BarChart2,
  FileText,
  Banknote,
  TrendingUp,
  Crown,
  MapPin,
  type LucideIcon,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SidebarLink {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
}

interface SidebarGroup {
  label: string;
  icon?: LucideIcon;
  items: SidebarLink[];
}

// ─── Navigation (mirrors hub-nav.ts selling sections) ───────────────────────

const sellingGroups: SidebarGroup[] = [
  {
    label: 'Selling',
    items: [
      { label: 'Listings', href: '/my/selling/listings', icon: Tag },
      { label: 'Orders', href: '/my/selling/orders', icon: ShoppingCart },
      { label: 'Offers', href: '/my/selling/offers', icon: HandCoins },
      { label: 'Returns', href: '/my/selling/returns', icon: RotateCcw },
      { label: 'Shipping Profiles', href: '/my/selling/shipping', icon: Truck },
      { label: 'Promotions', href: '/my/selling/promotions', icon: Megaphone },
    ],
  },
  {
    label: 'Crosslister',
    icon: RefreshCw,
    items: [
      { label: 'Platforms', href: '/my/selling/crosslist/connect', icon: LinkIcon },
      { label: 'Import', href: '/my/selling/crosslist/import', icon: Download },
      { label: 'Automation', href: '/my/selling/crosslist/automation', icon: Zap },
    ],
  },
  {
    label: 'Store',
    items: [
      { label: 'Branding', href: '/my/selling/store', icon: Palette },
      { label: 'Page Builder', href: '/my/selling/store/editor', icon: Layout },
      { label: 'Staff', href: '/my/selling/staff', icon: Users },
    ],
  },
  {
    label: 'Finance',
    icon: DollarSign,
    items: [
      { label: 'Overview', href: '/my/selling/finances', icon: BarChart2 },
      { label: 'Transactions', href: '/my/selling/finances/transactions', icon: FileText },
      { label: 'Payouts', href: '/my/selling/finances/payouts', icon: Banknote },
      { label: 'Platform Revenue', href: '/my/selling/finances/platforms', icon: TrendingUp },
    ],
  },
  {
    label: '',
    items: [
      { label: 'Analytics', href: '/my/selling/analytics', icon: BarChart2 },
      { label: 'Subscription', href: '/my/selling/subscription', icon: Crown },
      { label: 'Affiliate', href: '/my/selling/affiliate', icon: Users },
      { label: 'Local Pickup', href: '/my/selling/settings/local', icon: MapPin },
    ],
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
    <nav className="flex flex-col gap-4">
      {sellingGroups.map((group, gi) => (
        <div key={group.label || `extras-${gi}`} className="flex flex-col gap-1">
          {group.label && (
            <div className="mb-1 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.icon && <group.icon className="h-3.5 w-3.5" />}
              <span>{group.label}</span>
            </div>
          )}
          {group.items.map((link) => {
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
        </div>
      ))}
    </nav>
  );
}
