'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { filterHubNav, HUB_NAV } from '@/lib/hub/hub-nav';
import type { UserCapabilities } from '@/types/hub';
import { Button } from '@twicely/ui/button';
import {
  LayoutDashboard, ShoppingBag, Package, Send, Heart, Search,
  Star, UserPlus, Store, Tag, ShoppingCart, HandCoins, RotateCcw,
  Truck, Megaphone, RefreshCw, Link as LinkIcon, Download, Zap, Palette,
  LayoutTemplate, Users, DollarSign, BarChart2, FileText, Banknote,
  Crown, MessageSquare, Settings, UserCircle, MapPin, Shield, Bell,
  HelpCircle, BookOpen, Ticket, TrendingUp,
} from 'lucide-react';
import { cn } from '@twicely/utils/cn';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, ShoppingBag, Package, Send, Heart, Search,
  Star, UserPlus, Store, Tag, ShoppingCart, HandCoins, RotateCcw,
  Truck, Megaphone, RefreshCw, Link: LinkIcon, Download, Zap, Palette,
  Layout: LayoutTemplate, Users, DollarSign, BarChart2, FileText,
  Banknote, Crown, MessageSquare, Settings, UserCircle, MapPin,
  Shield, Bell, HelpCircle, BookOpen, Ticket, TrendingUp,
  Storefront: Store,
};

interface NavLinkProps {
  href: string;
  icon?: string;
  active: boolean;
  external?: boolean;
  indent?: boolean;
  badge?: number | null;
  disabled?: boolean;
  children: React.ReactNode;
}

function NavLink({ href, icon, active, external, indent, badge, disabled, children }: NavLinkProps) {
  const Icon = icon ? ICONS[icon] : null;

  if (disabled) {
    return (
      <span
        className={cn(
          'flex items-center gap-3 rounded-md text-sm',
          indent ? 'py-1.5 pl-8 pr-4' : 'px-4 py-2',
          'text-muted-foreground opacity-50 cursor-not-allowed'
        )}
        aria-disabled="true"
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span className="flex-1">{children}</span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener' : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md text-sm transition-colors',
        indent ? 'py-1.5 pl-8 pr-4' : 'px-4 py-2',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="flex-1">{children}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

interface HubSidebarProps {
  capabilities: UserCapabilities;
  unreadMessageCount?: number;
}

export function HubSidebar({ capabilities, unreadMessageCount = 0 }: HubSidebarProps) {
  const filteredNav = filterHubNav(HUB_NAV, capabilities);
  const pathname = usePathname();

  const topLevel = filteredNav.filter(s => !s.parent);
  const subGroups = filteredNav.filter(s => !!s.parent);

  return (
    <aside role="navigation" className="hidden md:flex w-64 border-r bg-background flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <Link href="/my" className="text-lg font-semibold text-[#7C3AED]">
          My Hub
        </Link>
      </div>

      {/* Navigation */}
      <nav aria-label="User hub navigation" className="flex-1 overflow-y-auto py-2">
        {topLevel.map((section) => (
          <div key={section.key} className="mb-2">
            {section.key !== 'dashboard' && section.label && (
              <p role="heading" aria-level={2} className="px-4 mb-1 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section.label}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.key}
                href={item.href}
                icon={item.icon}
                active={pathname === item.href || (item.href !== '/my' && pathname.startsWith(item.href + '/'))}
                external={item.external}
                badge={item.key === 'inbox' ? unreadMessageCount : null}
                disabled={item.disabled}
              >
                {item.label}
              </NavLink>
            ))}

            {/* Sub-groups */}
            {subGroups
              .filter(sg => sg.parent === section.key)
              .map(sg => (
                <div key={sg.key} className="mt-3 mb-2">
                  {sg.label && (
                    <p role="heading" aria-level={2} className="px-6 mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {sg.label}
                    </p>
                  )}
                  {sg.items.map((item) => (
                    <NavLink
                      key={item.key}
                      href={item.href}
                      icon={item.icon}
                      active={pathname === item.href || (item.href !== '/my' && pathname.startsWith(item.href + '/'))}
                      external={item.external}
                      indent
                      disabled={item.disabled}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ))
            }
          </div>
        ))}
      </nav>

      {/* Bottom CTAs */}
      {!capabilities.isSeller && (
        <div className="p-4 border-t">
          <Button asChild className="w-full">
            <Link href="/sell">Start Selling</Link>
          </Button>
        </div>
      )}
      {capabilities.isSeller && !capabilities.hasCrosslister && (
        <div className="p-4 border-t">
          <Button asChild variant="secondary" size="sm" className="w-full">
            <Link href="/my/selling/subscription">Try Crosslister →</Link>
          </Button>
        </div>
      )}
      {capabilities.isSeller && capabilities.sellerType === 'PERSONAL' && !capabilities.hasStore && (
        <div className="p-4 border-t">
          <Button asChild variant="secondary" size="sm" className="w-full">
            <Link href="/my/selling/subscription">Open a Store →</Link>
          </Button>
        </div>
      )}
    </aside>
  );
}
