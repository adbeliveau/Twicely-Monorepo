import Link from 'next/link';
import {
  Users,
  ShoppingCart,
  Headphones,
  ClipboardList,
  Flag,
  Settings,
} from 'lucide-react';

const QUICK_ACTIONS = [
  { label: 'Search Users', href: '/usr', Icon: Users },
  { label: 'View Orders', href: '/tx/orders', Icon: ShoppingCart },
  { label: 'Open Cases', href: '/hd', Icon: Headphones },
  { label: 'Audit Log', href: '/audit', Icon: ClipboardList },
  { label: 'Feature Flags', href: '/flags', Icon: Flag },
  { label: 'Settings', href: '/cfg', Icon: Settings },
] as const;

export function DashboardQuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      {QUICK_ACTIONS.map(({ label, href, Icon }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <Icon className="h-4 w-4 text-gray-500" />
          {label}
        </Link>
      ))}
    </div>
  );
}
