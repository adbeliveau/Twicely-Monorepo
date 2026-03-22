import Link from 'next/link';

interface ListingRow {
  id: string;
  title: string | null;
  status: string;
  priceCents: number | null;
  slug: string | null;
  createdAt: Date;
}

interface UserListingsTabProps {
  userId: string;
  listings: ListingRow[];
  total: number;
  page: number;
}

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusBadgeClass(status: string): string {
  if (status === 'ACTIVE') return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
  if (status === 'SOLD') return 'bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400';
  if (status === 'DRAFT') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
}

export function UserListingsTab({ userId, listings, total, page }: UserListingsTabProps) {
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {listings.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">No listings found</div>
      ) : (
        <>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Listing</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {listings.map((l) => (
                <tr key={l.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="ml-4">
                        {l.slug ? (
                          <Link href={`/i/${l.slug}`} className="text-sm font-medium text-brand-600 dark:text-brand-400" target="_blank">
                            {l.title ?? '(untitled)'}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{l.title ?? '(untitled)'}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {l.priceCents != null ? fmt(l.priceCents) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(l.status)}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(l.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">{total} total listings</p>
              <div className="flex gap-2 text-sm">
                {page > 1 && (
                  <Link href={`/usr/${userId}?tab=listings&listPage=${page - 1}`}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                    Previous
                  </Link>
                )}
                <span className="px-3 py-1.5 text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
                {page < totalPages && (
                  <Link href={`/usr/${userId}?tab=listings&listPage=${page + 1}`}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
