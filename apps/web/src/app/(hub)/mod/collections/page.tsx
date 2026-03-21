import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminCollections } from '@/lib/queries/admin-curated-collections';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CollectionDeleteButton } from '@/components/admin/collections/collection-delete-button';

export const metadata: Metadata = { title: 'Collections | Twicely Hub' };

type FilterValue = 'all' | 'published' | 'draft' | 'seasonal';

const FILTER_TABS: { label: string; value: FilterValue }[] = [
  { label: 'All', value: 'all' },
  { label: 'Published', value: 'published' },
  { label: 'Draft', value: 'draft' },
  { label: 'Seasonal', value: 'seasonal' },
];

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'CuratedCollection')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const rawFilter = params.filter ?? 'all';
  const filter: FilterValue = ['all', 'published', 'draft', 'seasonal'].includes(rawFilter)
    ? (rawFilter as FilterValue)
    : 'all';

  const { collections, total } = await getAdminCollections(page, 50, filter);
  const now = new Date();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Curated Collections"
        description={`${total} collection${total !== 1 ? 's' : ''} total`}
        actions={
          <Link
            href="/mod/collections/new"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Create Collection
          </Link>
        }
      />

      <div className="flex gap-2">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/mod/collections?filter=${tab.value}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              filter === tab.value
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Title</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Items</th>
              <th className="px-4 py-3 font-medium text-primary/70">Date Range</th>
              <th className="px-4 py-3 font-medium text-primary/70">Sort</th>
              <th className="px-4 py-3 font-medium text-primary/70">Created</th>
              <th className="px-4 py-3 font-medium text-primary/70">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {collections.map((col) => {
              const isSeasonal = col.startDate !== null && col.endDate !== null;
              const isSeasonalActive =
                isSeasonal && col.startDate! <= now && col.endDate! > now;
              return (
                <tr key={col.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                    {col.title}
                  </td>
                  <td className="px-4 py-3">
                    {col.isPublished ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{col.itemCount}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {isSeasonal ? (
                      <span className="flex items-center gap-1">
                        {formatDate(col.startDate)} – {formatDate(col.endDate)}
                        {isSeasonalActive && (
                          <span className="ml-1 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Active
                          </span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{col.sortOrder}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(col.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/mod/collections/${col.id}`}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      >
                        Edit
                      </Link>
                      <CollectionDeleteButton collectionId={col.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {collections.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No curated collections yet. Create one to feature listings on the Explore page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
