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
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export function UserListingsTab({ userId, listings, total, page }: UserListingsTabProps) {
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{total} total listings</p>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Title</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Price</th>
              <th className="px-4 py-3 font-medium text-primary/70">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {listings.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {l.slug ? (
                    <Link href={`/i/${l.slug}`} className="font-medium text-primary hover:underline" target="_blank" rel="noreferrer">
                      {l.title ?? '(untitled)'}
                    </Link>
                  ) : (
                    <span className="font-medium text-gray-700">{l.title ?? '(untitled)'}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{l.status}</span>
                </td>
                <td className="px-4 py-3">{l.priceCents != null ? fmt(l.priceCents) : '—'}</td>
                <td className="px-4 py-3 text-gray-500">{l.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {listings.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No listings</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`/usr/${userId}?tab=listings&listPage=${page - 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">
              Previous
            </Link>
          )}
          <span className="px-3 py-1 text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/usr/${userId}?tab=listings&listPage=${page + 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
