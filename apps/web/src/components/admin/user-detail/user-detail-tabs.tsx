'use client';

import { useSearchParams, useRouter } from 'next/navigation';

const ALL_TABS = ['overview', 'orders', 'listings', 'cases', 'finance', 'activity', 'notes'] as const;
type Tab = (typeof ALL_TABS)[number];

interface UserDetailTabsProps {
  userId: string;
  canViewFinance: boolean;
  canViewNotes: boolean;
}

export function UserDetailTabs({ userId, canViewFinance, canViewNotes }: UserDetailTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const active = (searchParams.get('tab') ?? 'overview') as Tab;

  function goTo(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`/usr/${userId}?${params.toString()}`);
  }

  const visible: Tab[] = ALL_TABS.filter((t) => {
    if (t === 'finance' && !canViewFinance) return false;
    if (t === 'notes' && !canViewNotes) return false;
    return true;
  });

  const LABELS: Record<Tab, string> = {
    overview: 'Overview',
    orders: 'Orders',
    listings: 'Listings',
    cases: 'Cases',
    finance: 'Finance',
    activity: 'Activity',
    notes: 'Notes',
  };

  return (
    <nav className="flex gap-1 border-b border-gray-200" aria-label="User detail tabs">
      {visible.map((tab) => (
        <button
          key={tab}
          onClick={() => goTo(tab)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            active === tab
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          aria-current={active === tab ? 'page' : undefined}
        >
          {LABELS[tab]}
        </button>
      ))}
    </nav>
  );
}
