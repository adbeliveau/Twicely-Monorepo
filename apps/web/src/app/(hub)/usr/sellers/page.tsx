// NAV_ENTRY: { label: 'Sellers', href: '/usr/sellers', icon: 'Store', roles: ['ADMIN', 'SUPPORT'] }

import type { Metadata } from 'next';
import Link from 'next/link';
import type { InferSelectModel } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminSellerList } from '@/lib/queries/admin-sellers';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { sellerProfile } from '@twicely/db/schema';
import { Check } from 'lucide-react';

type StoreTier = InferSelectModel<typeof sellerProfile>['storeTier'];
type ListerTier = InferSelectModel<typeof sellerProfile>['listerTier'];
type PerformanceBand = InferSelectModel<typeof sellerProfile>['performanceBand'];
type SellerStatus = InferSelectModel<typeof sellerProfile>['status'];

const VALID_TIERS: StoreTier[] = ['NONE', 'STARTER', 'PRO', 'POWER', 'ENTERPRISE'];
const VALID_LISTER_TIERS: ListerTier[] = ['NONE', 'FREE', 'LITE', 'PRO'];
const VALID_BANDS: PerformanceBand[] = ['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER', 'SUSPENDED'];
const VALID_STATUSES: SellerStatus[] = ['ACTIVE', 'RESTRICTED', 'SUSPENDED'];

function parseStoreTier(v?: string): StoreTier | undefined {
  return VALID_TIERS.includes(v as StoreTier) ? (v as StoreTier) : undefined;
}
function parseBand(v?: string): PerformanceBand | undefined {
  return VALID_BANDS.includes(v as PerformanceBand) ? (v as PerformanceBand) : undefined;
}
function parseStatus(v?: string): SellerStatus | undefined {
  return VALID_STATUSES.includes(v as SellerStatus) ? (v as SellerStatus) : undefined;
}

void VALID_LISTER_TIERS; // referenced via getAdminSellerList options

export const metadata: Metadata = { title: 'Sellers | Twicely Hub' };

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function BandBadge({ band }: { band: string }) {
  const colors: Record<string, string> = {
    POWER_SELLER: 'bg-purple-100 text-purple-700',
    TOP_RATED: 'bg-yellow-100 text-yellow-700',
    ESTABLISHED: 'bg-green-100 text-green-700',
    EMERGING: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors[band] ?? colors['EMERGING']}`}>
      {band.replace('_', ' ')}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'ACTIVE'
    ? 'bg-green-100 text-green-700'
    : status === 'RESTRICTED'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-red-100 text-red-700';
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name' },
  { value: 'score', label: 'Score' },
] as const;

const TIER_OPTIONS = ['NONE', 'STARTER', 'PRO', 'POWER', 'ENTERPRISE'];
const BAND_OPTIONS = ['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER'];

export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string; search?: string; sellerType?: string; storeTier?: string;
    performanceBand?: string; status?: string; sort?: string;
  }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'User')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const pageSize = 50;

  const { sellers, total } = await getAdminSellerList({
    page,
    pageSize,
    search: params.search,
    sellerType: params.sellerType === 'PERSONAL' || params.sellerType === 'BUSINESS' ? params.sellerType : undefined,
    storeTier: parseStoreTier(params.storeTier),
    performanceBand: parseBand(params.performanceBand),
    status: parseStatus(params.status),
    sort: params.sort as 'newest' | 'oldest' | 'name' | 'score' | undefined,
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Sellers"
        description={`${total} sellers total`}
        actions={
          ability.can('create', 'User') ? (
            <Link href="/usr/new" className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
              Create user
            </Link>
          ) : undefined
        }
      />

      <form className="flex flex-wrap gap-2" method="get">
        <input name="search" defaultValue={params.search} placeholder="Search name/email/username..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none" />
        <select name="sellerType" defaultValue={params.sellerType}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All types</option>
          <option value="PERSONAL">PERSONAL</option>
          <option value="BUSINESS">BUSINESS</option>
        </select>
        <select name="storeTier" defaultValue={params.storeTier}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All store tiers</option>
          {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select name="performanceBand" defaultValue={params.performanceBand}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All bands</option>
          {BAND_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select name="status" defaultValue={params.status}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="RESTRICTED">RESTRICTED</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <select name="sort" defaultValue={params.sort}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
          Filter
        </button>
        <Link href="/usr/sellers/verification" className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
          Verification queue
        </Link>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Seller</th>
              <th className="px-3 py-3 font-medium text-primary/70">Type</th>
              <th className="px-3 py-3 font-medium text-primary/70">Store Tier</th>
              <th className="px-3 py-3 font-medium text-primary/70">Band</th>
              <th className="px-3 py-3 font-medium text-primary/70">Score</th>
              <th className="px-3 py-3 font-medium text-primary/70">Status</th>
              <th className="px-3 py-3 font-medium text-primary/70">Available</th>
              <th className="px-3 py-3 font-medium text-primary/70">Stripe</th>
              <th className="px-3 py-3 font-medium text-primary/70">Verified</th>
              <th className="px-3 py-3 font-medium text-primary/70">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {sellers.map((s) => (
              <tr key={s.userId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/usr/${s.userId}`} className="font-medium text-primary hover:underline">{s.name}</Link>
                  <div className="text-xs text-gray-400">{s.email}</div>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${s.sellerType === 'BUSINESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {s.sellerType}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs">{s.storeTier}</td>
                <td className="px-3 py-3"><BandBadge band={s.performanceBand} /></td>
                <td className="px-3 py-3">{s.sellerScore}</td>
                <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-3 py-3">{s.availableCents > 0 ? fmt(s.availableCents) : '—'}</td>
                <td className="px-3 py-3">{s.stripeOnboarded ? <Check className="size-4 text-green-600" strokeWidth={2.5} /> : <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-3">{s.verifiedAt ? <Check className="size-4 text-green-600" strokeWidth={2.5} /> : <span className="text-yellow-500">Pending</span>}</td>
                <td className="px-3 py-3 text-gray-500 text-xs">{s.activatedAt?.toLocaleDateString() ?? '—'}</td>
              </tr>
            ))}
            {sellers.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No sellers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && <Link href={`/usr/sellers?page=${page - 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">Previous</Link>}
          <span className="px-3 py-1 text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && <Link href={`/usr/sellers?page=${page + 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">Next</Link>}
        </div>
      )}
    </div>
  );
}
