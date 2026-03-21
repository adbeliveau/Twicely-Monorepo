// NAV_ENTRY: { key: 'categories-catalog', label: 'Catalog Browser', href: '/categories/catalog', icon: 'Grid', roles: ['ADMIN', 'MODERATION'] }
import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminCatalogBrowser } from '@/lib/queries/admin-categories';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Catalog Browser | Twicely Hub',
  robots: { index: false, follow: false },
};

const FEE_BUCKET_OPTIONS = [
  { value: '', label: 'All Buckets' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'APPAREL_ACCESSORIES', label: 'Apparel & Accessories' },
  { value: 'HOME_GENERAL', label: 'Home & General' },
  { value: 'COLLECTIBLES_LUXURY', label: 'Collectibles & Luxury' },
];

interface Props {
  searchParams: Promise<{
    q?: string;
    active?: string;
    feeBucket?: string;
    depth?: string;
    page?: string;
  }>;
}

export default async function CatalogBrowserPage({ searchParams }: Props) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Category')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const sp = await searchParams;
  const search = sp.q ?? '';
  const feeBucket = sp.feeBucket ?? '';
  const page = Math.max(1, Number(sp.page ?? 1));
  const depthFilter = sp.depth ?? '';
  const activeFilter = sp.active ?? '';

  const filters: Parameters<typeof getAdminCatalogBrowser>[0] = {
    search: search || undefined,
    feeBucket: feeBucket || undefined,
    page,
    pageSize: 50,
  };

  if (activeFilter === 'true') filters.isActive = true;
  else if (activeFilter === 'false') filters.isActive = false;

  if (depthFilter === 'root') filters.parentId = null;

  const result = await getAdminCatalogBrowser(filters);

  function buildUrl(overrides: Record<string, string>) {
    const base: Record<string, string> = {};
    if (search) base.q = search;
    if (feeBucket) base.feeBucket = feeBucket;
    if (activeFilter) base.active = activeFilter;
    if (depthFilter) base.depth = depthFilter;
    base.page = String(page);
    const merged = { ...base, ...overrides };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v !== '')).toString();
    return `/categories/catalog${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/categories"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Categories
      </Link>

      <AdminPageHeader
        title="Catalog Browser"
        description={`${result.totalCount} categories total`}
      />

      {/* Filters */}
      <form method="GET" action="/categories/catalog" className="flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search by name..."
          className="h-9 rounded-md border px-3 text-sm w-48"
        />
        <select name="active" defaultValue={activeFilter} className="h-9 rounded-md border px-2 text-sm">
          <option value="">All Status</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
        <select name="feeBucket" defaultValue={feeBucket} className="h-9 rounded-md border px-2 text-sm">
          {FEE_BUCKET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select name="depth" defaultValue={depthFilter} className="h-9 rounded-md border px-2 text-sm">
          <option value="">All Depths</option>
          <option value="root">Root Only</option>
        </select>
        <Button type="submit" size="sm" variant="outline">Apply</Button>
        <Link href="/categories/catalog">
          <Button type="button" size="sm" variant="ghost">Clear</Button>
        </Link>
      </form>

      {/* Results table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Parent</th>
              <th className="px-4 py-3 font-medium">Fee Bucket</th>
              <th className="px-4 py-3 font-medium">Depth</th>
              <th className="px-4 py-3 font-medium">Listings</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.categories.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No categories found.
                </td>
              </tr>
            ) : (
              result.categories.map((cat) => (
                <tr key={cat.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/categories/${cat.id}`} className="text-blue-600 hover:underline font-medium">
                      {cat.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{cat.slug}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{cat.parentName ?? 'Root'}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="text-xs">{cat.feeBucket}</Badge>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{cat.depth}</td>
                  <td className="px-4 py-2">{cat.listingCount}</td>
                  <td className="px-4 py-2">
                    {cat.isActive ? (
                      <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-gray-400">Inactive</Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {result.totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">
            Page {result.page} of {result.totalPages}
          </span>
          {result.page > 1 && (
            <Link href={buildUrl({ page: String(result.page - 1) })}>
              <Button variant="outline" size="sm">Previous</Button>
            </Link>
          )}
          {result.page < result.totalPages && (
            <Link href={buildUrl({ page: String(result.page + 1) })}>
              <Button variant="outline" size="sm">Next</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
