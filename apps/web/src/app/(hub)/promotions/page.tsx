// NAV_ENTRY: I17 should add { key: 'promotions', label: 'Promotions', href: '/promotions', icon: 'Ticket', roles: ['ADMIN', 'FINANCE', 'MODERATION'] } to admin-nav.ts
import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  getAllSellerPromotions,
  getAllPromoCodesAdmin,
  getPromotionsOverviewStats,
} from '@/lib/queries/admin-promotions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CreatePlatformPromoDialog } from '@/components/hub/create-platform-promo-dialog';
import { Badge } from '@twicely/ui/badge';
import { formatCentsToDollars } from '@twicely/finance/format';

export const metadata: Metadata = { title: 'Promotions | Twicely Hub' };

const MAIN_TABS = [
  { label: 'Seller Promotions', value: 'sellers' },
  { label: 'Platform Promo Codes', value: 'platform' },
  { label: 'Affiliate Promo Codes', value: 'affiliate' },
] as const;

const STATUS_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Ended', value: 'ended' },
] as const;

function formatDiscount(discountType: string, discountValue: number): string {
  if (discountType === 'PERCENTAGE') return `${discountValue / 100}% off`;
  return `${formatCentsToDollars(discountValue)} off`;
}

function formatPromotionDiscount(type: string, discountPercent: number | null, discountAmountCents: number | null): string {
  if (type === 'FREE_SHIPPING') return 'Free Shipping';
  if (type === 'PERCENT_OFF' || type === 'BUNDLE_DISCOUNT') return `${discountPercent ?? 0}% off`;
  if (type === 'AMOUNT_OFF') return `${formatCentsToDollars(discountAmountCents ?? 0)} off`;
  return '—';
}

const PAGE_SIZE = 50;

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; page?: string; search?: string }>;
}) {
  const { ability } = await staffAuthorize();

  const canReadPromotion = ability.can('read', 'Promotion') || ability.can('manage', 'Promotion');
  const canManagePromoCode = ability.can('manage', 'PromoCode');

  if (!canReadPromotion && !canManagePromoCode) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const activeTab = params.tab ?? 'sellers';
  const activeStatus = (params.status ?? 'all') as 'active' | 'scheduled' | 'ended' | 'all';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const search = params.search;

  const [stats, sellerData, platformData, affiliateData] = await Promise.all([
    getPromotionsOverviewStats(),
    canReadPromotion
      ? getAllSellerPromotions({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, status: activeStatus, search })
      : { rows: [], total: 0 },
    canManagePromoCode
      ? getAllPromoCodesAdmin({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, type: 'PLATFORM' })
      : { rows: [], total: 0 },
    canManagePromoCode
      ? getAllPromoCodesAdmin({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, type: 'AFFILIATE' })
      : { rows: [], total: 0 },
  ]);

  const totalPages = activeTab === 'sellers'
    ? Math.ceil(sellerData.total / PAGE_SIZE)
    : activeTab === 'platform'
    ? Math.ceil(platformData.total / PAGE_SIZE)
    : Math.ceil(affiliateData.total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Promotions"
        description="Manage seller promotions and platform promo codes"
      />

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active Seller Promotions', value: stats.activeSellerPromotions },
          { label: 'Active Promo Codes', value: stats.activePromoCodes },
          { label: 'Total Redemptions', value: stats.totalRedemptions },
          { label: 'Total Discount Given', value: formatCentsToDollars(stats.totalDiscountCents) },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {MAIN_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/promotions?tab=${tab.value}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {activeTab === 'sellers' && canReadPromotion && (
        <div className="space-y-4">
          <div className="flex gap-1 border-b border-gray-100">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={`/promotions?tab=sellers&status=${tab.value}`}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeStatus === tab.value
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
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
                  {['Name', 'Seller', 'Type', 'Scope', 'Discount', 'Uses', 'Code', 'Status', 'Created'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-primary/70">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sellerData.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><Link href={`/promotions/${row.id}`} className="font-medium text-primary hover:text-primary/80">{row.name}</Link></td>
                    <td className="px-4 py-3 text-gray-600">{row.sellerUsername ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{row.type}</td>
                    <td className="px-4 py-3 text-xs">{row.scope}</td>
                    <td className="px-4 py-3">{formatPromotionDiscount(row.type, row.discountPercent, row.discountAmountCents)}</td>
                    <td className="px-4 py-3">{row.maxUsesTotal ? `${row.usageCount}/${row.maxUsesTotal}` : row.usageCount}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.couponCode ?? '—'}</td>
                    <td className="px-4 py-3"><Badge variant={row.isActive ? 'default' : 'secondary'}>{row.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="px-4 py-3 text-gray-500">{row.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))}
                {sellerData.rows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No promotions found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'platform' && canManagePromoCode && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <CreatePlatformPromoDialog />
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-primary/5 text-left">
                <tr>
                  {['Code', 'Discount', 'Duration', 'Scope', 'Uses', 'Expires', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-primary/70">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {platformData.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium"><Link href={`/promotions/${row.id}?tab=promo`} className="text-primary hover:text-primary/80">{row.code}</Link></td>
                    <td className="px-4 py-3">{formatDiscount(row.discountType, row.discountValue)}</td>
                    <td className="px-4 py-3">{row.durationMonths} mo</td>
                    <td className="px-4 py-3 text-xs">{row.scopeProductTypes ? JSON.stringify(row.scopeProductTypes) : 'All'}</td>
                    <td className="px-4 py-3">{row.usageLimit ? `${row.usageCount}/${row.usageLimit}` : row.usageCount}</td>
                    <td className="px-4 py-3 text-gray-500">{row.expiresAt ? row.expiresAt.toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3"><Badge variant={row.isActive ? 'default' : 'secondary'}>{row.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  </tr>
                ))}
                {platformData.rows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No platform promo codes found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'affiliate' && canManagePromoCode && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-primary/5 text-left">
              <tr>
                {['Code', 'Affiliate', 'Discount', 'Duration', 'Uses', 'Expires', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium text-primary/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {affiliateData.rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium"><Link href={`/promotions/${row.id}?tab=promo`} className="text-primary hover:text-primary/80">{row.code}</Link></td>
                  <td className="px-4 py-3 text-gray-600">{row.affiliateUsername ?? '—'}</td>
                  <td className="px-4 py-3">{formatDiscount(row.discountType, row.discountValue)}</td>
                  <td className="px-4 py-3">{row.durationMonths} mo</td>
                  <td className="px-4 py-3">{row.usageLimit ? `${row.usageCount}/${row.usageLimit}` : row.usageCount}</td>
                  <td className="px-4 py-3 text-gray-500">{row.expiresAt ? row.expiresAt.toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3"><Badge variant={row.isActive ? 'default' : 'secondary'}>{row.isActive ? 'Active' : 'Inactive'}</Badge></td>
                </tr>
              ))}
              {affiliateData.rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No affiliate promo codes found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`/promotions?tab=${activeTab}&page=${page - 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">
              Previous
            </Link>
          )}
          <span className="px-3 py-1 text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/promotions?tab=${activeTab}&page=${page + 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
