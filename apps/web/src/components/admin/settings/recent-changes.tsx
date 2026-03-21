import type { SettingsOverview } from '@/lib/queries/admin-settings';

function truncate(val: unknown, maxLen: number = 40): string {
  const s = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

interface Props {
  changes: SettingsOverview['recentChanges'];
}

export function RecentChanges({ changes }: Props) {
  if (changes.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Recent Changes</h3>
        <p className="text-sm text-gray-400">No setting changes recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Recent Changes</h3>
        <p className="text-xs text-gray-400">Last 10 platform setting changes</p>
      </div>
      <div className="divide-y divide-gray-100">
        {changes.map((change) => (
          <div key={change.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <code className="text-xs font-mono text-gray-800">{change.settingKey}</code>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">
                    {truncate(change.previousValue)}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-700">
                    {truncate(change.newValue)}
                  </span>
                </div>
                {change.reason && (
                  <p className="mt-0.5 text-xs text-gray-400 italic">{change.reason}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-gray-400">
                {new Date(change.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
