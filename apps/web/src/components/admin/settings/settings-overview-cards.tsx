import type { SettingsOverview } from '@/lib/queries/admin-settings';

const TAB_LABELS: Record<string, string> = {
  general: 'General', environment: 'Environment', integrations: 'Integrations',
  fees: 'Fees & Pricing', commerce: 'Commerce', fulfillment: 'Fulfillment',
  trust: 'Trust & Quality', discovery: 'Discovery', comms: 'Communications',
  payments: 'Payments', privacy: 'Privacy',
};

function StatCard({ title, value, subtitle }: { title: string; value: number | string; subtitle?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}

function CategoryCard({
  category, count, lastUpdatedAt,
}: {
  category: string;
  count: number;
  lastUpdatedAt: Date | null;
}) {
  const label = TAB_LABELS[category] ?? category;
  const updated = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleDateString() : 'Never';
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">Last updated: {updated}</p>
      </div>
      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
        {count}
      </span>
    </div>
  );
}

interface Props {
  overview: SettingsOverview;
}

export function SettingsOverviewCards({ overview }: Props) {
  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard title="Total Settings" value={overview.totalSettings} subtitle="Across all categories" />
        <StatCard title="Customized" value={overview.customizedSettings} subtitle="Have change history" />
        <StatCard title="Categories" value={overview.categoryBreakdown.length} subtitle="Setting groups" />
      </div>

      {/* Category breakdown */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Settings by Category</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {overview.categoryBreakdown.map((cat) => (
            <CategoryCard
              key={cat.category}
              category={cat.category}
              count={cat.count}
              lastUpdatedAt={cat.lastUpdatedAt}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
