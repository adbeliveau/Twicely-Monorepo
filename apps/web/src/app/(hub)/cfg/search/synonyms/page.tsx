import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSearchSynonyms } from '@/lib/queries/admin-search-opensearch';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Search Synonyms | Twicely Hub' };

export default async function SearchSynonymsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('manage', 'Setting');
  const synonyms = await getSearchSynonyms();

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cfg" className="hover:text-blue-600">Settings</Link>
        <span>/</span>
        <Link href="/cfg/search" className="hover:text-blue-600">Search Engine</Link>
        <span>/</span>
        <span className="text-gray-900">Synonyms</span>
      </div>

      <AdminPageHeader
        title="Search Synonyms"
        description="Synonym sets for search expansion — e.g., sneakers = trainers = kicks."
      />

      {/* Synonym List */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold">Synonym Sets ({synonyms.length})</h3>
          {canEdit && (
            <span className="text-xs text-gray-500">
              Create and apply synonyms via server actions
            </span>
          )}
        </div>

        {synonyms.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No synonym sets defined yet.</p>
        ) : (
          <div className="divide-y">
            {synonyms.map((syn) => (
              <div key={syn.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium">{syn.name}</span>
                  <span className={`ml-2 rounded px-2 py-0.5 text-xs ${
                    syn.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {syn.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <p className="mt-1 text-sm text-gray-600">{syn.terms.join(' = ')}</p>
                </div>
                <span className="text-xs text-gray-400">v{syn.version}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <h3 className="font-semibold text-yellow-900">Apply to OpenSearch</h3>
        <p className="mt-1 text-sm text-yellow-800">
          After creating or updating synonyms, use the &quot;Apply Synonyms&quot; action to push
          them to the active OpenSearch index. This requires a brief index close/open cycle.
        </p>
      </div>
    </div>
  );
}
