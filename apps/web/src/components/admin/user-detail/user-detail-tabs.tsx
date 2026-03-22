'use client';

import { useSearchParams, useRouter } from 'next/navigation';

const ALL_TABS = ['overview', 'orders', 'listings', 'cases', 'finance', 'activity', 'notes'] as const;
type Tab = (typeof ALL_TABS)[number];

interface UserDetailTabsProps {
  userId: string;
  canViewFinance: boolean;
  canViewNotes: boolean;
}

const LABELS: Record<Tab, string> = {
  overview: 'Overview',
  orders: 'Orders',
  listings: 'Listings',
  cases: 'Cases',
  finance: 'Finance',
  activity: 'Activity',
  notes: 'Notes',
};

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

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="User detail tabs">
        {visible.map((tab) => (
          <button
            key={tab}
            onClick={() => goTo(tab)}
            className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
              active === tab
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            aria-current={active === tab ? 'page' : undefined}
          >
            {LABELS[tab]}
          </button>
        ))}
      </nav>
    </div>
  );
}
