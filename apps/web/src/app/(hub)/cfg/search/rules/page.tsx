import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSearchRules } from '@/lib/queries/admin-search-opensearch';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Search Rules | Twicely Hub' };

const RULE_TYPE_LABELS: Record<string, string> = {
  PIN: 'Pin to top',
  BURY: 'Bury to bottom',
  REWRITE: 'Query rewrite',
  REDIRECT: 'Redirect',
  BLOCK: 'Block results',
};

export default async function SearchRulesPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const rules = await getSearchRules();

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cfg" className="hover:text-blue-600">Settings</Link>
        <span>/</span>
        <Link href="/cfg/search" className="hover:text-blue-600">Search Engine</Link>
        <span>/</span>
        <span className="text-gray-900">Rules</span>
      </div>

      <AdminPageHeader
        title="Search Rules"
        description="Merchandising rules — pin, bury, rewrite, redirect, or block search results."
      />

      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Rules ({rules.length})</h3>
        </div>

        {rules.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No search rules defined yet.</p>
        ) : (
          <div className="divide-y">
            {rules.map((rule) => (
              <div key={rule.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                    {RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs ${
                    rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <span className="text-xs text-gray-400">Priority: {rule.priority}</span>
                </div>
                <p className="mt-1 font-mono text-sm text-gray-900">{rule.queryPattern}</p>
                {rule.startsAt && (
                  <p className="mt-1 text-xs text-gray-500">
                    {rule.startsAt.toLocaleDateString()} — {rule.endsAt?.toLocaleDateString() ?? 'ongoing'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
