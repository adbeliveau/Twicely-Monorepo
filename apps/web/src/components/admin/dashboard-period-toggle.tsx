'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface DashboardPeriodToggleProps {
  currentPeriod: '7d' | '30d';
}

export function DashboardPeriodToggle({ currentPeriod }: DashboardPeriodToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setPeriod(period: '7d' | '30d') {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', period);
    router.push(`/d?${params.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-md border border-gray-200 bg-white text-sm">
      <button
        type="button"
        onClick={() => setPeriod('7d')}
        className={`rounded-l-md px-3 py-1.5 text-sm font-medium transition-colors ${
          currentPeriod === '7d'
            ? 'bg-primary text-white'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        7 days
      </button>
      <button
        type="button"
        onClick={() => setPeriod('30d')}
        className={`rounded-r-md px-3 py-1.5 text-sm font-medium transition-colors ${
          currentPeriod === '30d'
            ? 'bg-primary text-white'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        30 days
      </button>
    </div>
  );
}
