'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  CreditCard,
  DollarSign,
  Shield,
  Headphones,
  BookOpen,
  Tag,
  AlertTriangle,
  RotateCcw,
  BarChart2,
  Crown,
  FolderOpen,
  Bell,
  Flag,
  Settings,
  UserCog,
  ClipboardList,
  Activity,
  Archive,
  Coins,
  ShieldCheck,
  Truck,
  Puzzle,
  Server,
  Plug,
  Database,
  GitBranch,
  Sliders,
  SlidersHorizontal,
  Terminal,
  MessageSquareWarning,
  ShoppingCart,
  Banknote,
  Star,
  MapPin,
  Receipt,
  Ticket,
  Scale,
  Stethoscope,
  FileText,
  Gavel,
  Layers,
  Clock,
  ShoppingBag,
  RefreshCw,
  Search,
  BarChart,
  ListFilter,
  Replace,
  Filter,
  Globe,
  Languages,
  Calculator,
  ChevronDown,
  ChevronRight,
  Store,
  TrendingUp,
  EyeOff,
  Grid,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import { ADMIN_NAV, filterAdminNav, type AdminNavItem } from '@/lib/hub/admin-nav';
import type { PlatformRole } from '@twicely/casl/types';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Users, UserPlus, CreditCard, DollarSign, Shield,
  Headphones, BookOpen, Tag, AlertTriangle, RotateCcw, BarChart2, Crown,
  FolderOpen, Bell, Flag, Settings, UserCog, ClipboardList, Activity,
  Archive, Coins, ShieldCheck, Truck, Puzzle, Server, Plug, Database,
  GitBranch, Sliders, SlidersHorizontal, Terminal, MessageSquareWarning,
  ShoppingCart, Banknote, Star, MapPin, Receipt, Ticket, Scale,
  Stethoscope, FileText, Gavel, Layers,
  Clock, ShoppingBag, RefreshCw, Search,
  BarChart, ListFilter, Replace, Filter,
  Globe, Languages, Calculator,
  Store, TrendingUp, EyeOff, Grid, Lock,
};

interface AdminSidebarProps {
  roles: PlatformRole[];
}

function NavIcon({ name }: { name: string }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
}

function NavItem({ item, isActive }: { item: AdminNavItem; isActive: boolean }) {
  if (item.disabled) {
    return (
      <span
        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
        aria-disabled="true"
      >
        <NavIcon name={item.icon} />
        <span>{item.label}</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={[
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-white'
          : 'text-gray-600 hover:bg-primary/10 hover:text-primary',
      ].join(' ')}
      aria-current={isActive ? 'page' : undefined}
    >
      <NavIcon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

function CollapsibleNavItem({ item, pathname }: { item: AdminNavItem; pathname: string }) {
  const childActive = item.children?.some(
    (c) => pathname === c.href || (c.href !== '/d' && pathname.startsWith(c.href + '/'))
  );
  const [open, setOpen] = useState(childActive ?? false);

  const listId = `admin-nav-${item.key}`;

  if (item.disabled) {
    return (
      <li>
        <span
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
          aria-disabled="true"
        >
          <NavIcon name={item.icon} />
          <span className="flex-1 text-left">{item.label}</span>
        </span>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={listId}
        className={[
          'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          childActive ? 'text-primary font-semibold' : 'text-gray-600 hover:bg-primary/10 hover:text-primary',
        ].join(' ')}
      >
        <NavIcon name={item.icon} />
        <span className="flex-1 text-left">{item.label}</span>
        {open ? <ChevronDown aria-hidden="true" className="h-3 w-3" /> : <ChevronRight aria-hidden="true" className="h-3 w-3" />}
      </button>
      {open && item.children && (
        <ul id={listId} className="ml-6 mt-1 space-y-0.5" role="list">
          {item.children.map((child) => {
            const isChildActive = pathname === child.href || pathname.startsWith(child.href + '/');
            return (
              <li key={child.key}>
                <NavItem item={child} isActive={isChildActive} />
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function AdminSidebar({ roles }: AdminSidebarProps) {
  const pathname = usePathname();
  const navItems = filterAdminNav(ADMIN_NAV, roles);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        <span className="text-lg font-bold text-primary">Twicely Hub</span>
      </div>
      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1" role="list">
          {navItems.map((item) => {
            if (item.children?.length) {
              return <CollapsibleNavItem key={item.key} item={item} pathname={pathname} />;
            }
            const isActive =
              pathname === item.href ||
              (item.href !== '/d' && pathname.startsWith(item.href + '/'));
            return (
              <li key={item.key}>
                <NavItem item={item} isActive={isActive} />
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
