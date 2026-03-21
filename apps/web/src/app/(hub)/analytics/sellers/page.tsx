import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSellerAnalyticsTable, type SellerAnalyticsParams } from '@/lib/queries/admin-analytics';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = {
  title: 'Seller Analytics | Twicely Hub',
  robots: { index: false, follow: false },
};

const VALID_SORT_BY = ['gmv', 'orders', 'rating', 'cancelRate', 'returnRate', 'createdAt'] as const;
type SortBy = typeof VALID_SORT_BY[number];

const VALID_BANDS = ['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER'] as const;
type ValidBand = typeof VALID_BANDS[number];
const VALID_TIERS = ['NONE', 'STARTER', 'PRO', 'POWER', 'ENTERPRISE'] as const;
type ValidTier = typeof VALID_TIERS[number];

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export default async function SellerAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Analytics')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;

  const page = Math.max(1, Number(params['page'] ?? '1'));
  const pageSize = Math.min(100, Math.max(1, Number(params['pageSize'] ?? '25')));
  const rawSortBy = String(params['sortBy'] ?? 'gmv');
  const sortBy: SortBy = VALID_SORT_BY.includes(rawSortBy as SortBy) ? (rawSortBy as SortBy) : 'gmv';
  const sortDir = params['sortDir'] === 'asc' ? 'asc' : 'desc';
  const rawBand = String(params['band'] ?? '');
  const bandFilter: SellerAnalyticsParams['bandFilter'] = (VALID_BANDS as ReadonlyArray<string>).includes(rawBand)
    ? (rawBand as ValidBand)
    : undefined;
  const rawTier = String(params['tier'] ?? '');
  const tierFilter: SellerAnalyticsParams['tierFilter'] = (VALID_TIERS as ReadonlyArray<string>).includes(rawTier)
    ? (rawTier as ValidTier)
    : undefined;
  const search = typeof params['search'] === 'string' ? params['search'] : undefined;

  const { sellers, total } = await getSellerAnalyticsTable({
    page,
    pageSize,
    sortBy,
    sortDir,
    bandFilter,
    tierFilter,
    search,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function buildUrl(overrides: Record<string, string>): string {
    const base: Record<string, string> = {};
    if (page > 1) base['page'] = String(page);
    if (pageSize !== 25) base['pageSize'] = String(pageSize);
    if (sortBy !== 'gmv') base['sortBy'] = sortBy;
    if (sortDir !== 'desc') base['sortDir'] = sortDir;
    if (bandFilter) base['band'] = bandFilter;
    if (tierFilter) base['tier'] = tierFilter;
    if (search) base['search'] = search;
    const merged = { ...base, ...overrides };
    const qs = new URLSearchParams(merged).toString();
    return `/analytics/sellers${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Seller Performance Analytics"
        description="GMV, cancel rate, return rate, and ratings by seller"
        actions={
          <Link href="/analytics" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Analytics
          </Link>
        }
      />

      {/* Filters */}
      <form method="GET" action="/analytics/sellers" className="flex flex-wrap gap-3">
        <select
          name="band"
          defaultValue={bandFilter ?? ''}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="">All Bands</option>
          {VALID_BANDS.map((b) => (
            <option key={b} value={b}>{b.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          name="tier"
          defaultValue={tierFilter ?? ''}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="">All StoreTiers</option>
          {VALID_TIERS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          type="text"
          name="search"
          defaultValue={search ?? ''}
          placeholder="Search store name or username..."
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <input type="hidden" name="sortBy" value={sortBy} />
        <input type="hidden" name="sortDir" value={sortDir} />
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Apply
        </button>
      </form>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-4 py-3 font-medium">Store / User</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">StoreTier</th>
                <th className="px-4 py-3 font-medium">Band</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Cancel %</th>
                <th className="px-4 py-3 font-medium">Return %</th>
                <th className="px-4 py-3 font-medium">Avg Rating</th>
                <th className="px-4 py-3 font-medium">Reviews</th>
                <th className="px-4 py-3 font-medium">GMV</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((seller) => (
                <tr
                  key={seller.userId}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3">
                    {seller.storeSlug ? (
                      <Link
                        href={`/st/${seller.storeSlug}`}
                        className="font-medium text-gray-900 hover:underline"
                      >
                        {seller.storeName ?? seller.storeSlug}
                      </Link>
                    ) : (
                      <span className="text-gray-600">{seller.storeName ?? '—'}</span>
                    )}
                    {seller.username && (
                      <p className="text-xs text-gray-400">@{seller.username}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{seller.sellerType}</td>
                  <td className="px-4 py-3 text-gray-600">{seller.storeTier}</td>
                  <td className="px-4 py-3">
                    <span className="rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                      {seller.performanceBand.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{seller.status}</td>
                  <td className="px-4 py-3 text-gray-600">{seller.totalOrders}</td>
                  <td className="px-4 py-3 text-gray-600">{formatPct(seller.cancelRate)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatPct(seller.returnRate)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {seller.averageRating != null ? seller.averageRating.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{seller.totalReviews}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatCents(seller.gmvCents)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {seller.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {sellers.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-sm text-gray-400">
                    No sellers match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} — {total.toLocaleString()} sellers
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
