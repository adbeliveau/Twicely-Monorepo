import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getPromotionDetailAdmin, getPromoCodeDetailAdmin } from '@/lib/queries/admin-promotions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@twicely/ui/badge';
import { formatCentsToDollars } from '@twicely/finance/format';
import { PromotionActionButtons, PromoCodeActionButtons } from './promotion-actions';

export const metadata: Metadata = { title: 'Promotion Detail | Twicely Hub' };

function formatPromotionDiscount(type: string, pct: number | null, cents: number | null): string {
  if (type === 'FREE_SHIPPING') return 'Free Shipping';
  if (type === 'PERCENT_OFF' || type === 'BUNDLE_DISCOUNT') return `${pct ?? 0}% off`;
  if (type === 'AMOUNT_OFF') return `${formatCentsToDollars(cents ?? 0)} off`;
  return '—';
}

function formatCodeDiscount(discountType: string, discountValue: number, durationMonths: number): string {
  const amount = discountType === 'PERCENTAGE'
    ? `${discountValue / 100}% off`
    : `${formatCentsToDollars(discountValue)} off`;
  return `${amount} for ${durationMonths} month${durationMonths !== 1 ? 's' : ''}`;
}

export default async function PromotionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ability } = await staffAuthorize();
  const { id } = await params;

  const canReadPromotion = ability.can('read', 'Promotion') || ability.can('manage', 'Promotion');
  const canManagePromotion = ability.can('manage', 'Promotion');
  const canManagePromoCode = ability.can('manage', 'PromoCode');

  if (!canReadPromotion && !canManagePromoCode) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [promoDetail, codeDetail] = await Promise.all([
    canReadPromotion ? getPromotionDetailAdmin(id) : null,
    canManagePromoCode ? getPromoCodeDetailAdmin(id) : null,
  ]);

  if (!promoDetail && !codeDetail) notFound();

  if (promoDetail) {
    const { promotion: p, stats, recentUsage } = promoDetail;

    return (
      <div className="space-y-6">
        <Link href="/promotions" className="text-sm text-gray-500 hover:underline">← Back to Promotions</Link>
        <AdminPageHeader title={p.name} description="Seller promotion detail" />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[
            { label: 'Seller', value: <Link href={`/usr/${p.sellerId}`} className="text-primary hover:underline">{p.sellerUsername ?? p.sellerId}</Link> },
            { label: 'Type', value: p.type },
            { label: 'Scope', value: p.scope },
            { label: 'Discount', value: formatPromotionDiscount(p.type, p.discountPercent, p.discountAmountCents) },
            { label: 'Minimum Order', value: p.minimumOrderCents ? formatCentsToDollars(p.minimumOrderCents) : 'None' },
            { label: 'Coupon Code', value: p.couponCode ? <span className="font-mono">{p.couponCode}</span> : 'None' },
            { label: 'Status', value: <Badge variant={p.isActive ? 'default' : 'secondary'}>{p.isActive ? 'Active' : 'Inactive'}</Badge> },
            { label: 'Start', value: p.startsAt.toLocaleDateString() },
            { label: 'End', value: p.endsAt ? p.endsAt.toLocaleDateString() : 'No end date' },
            { label: 'Usage', value: p.maxUsesTotal ? `${p.usageCount} / ${p.maxUsesTotal}` : `${p.usageCount} / Unlimited` },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">{item.label}</p>
              <div className="mt-1 text-sm font-medium">{item.value}</div>
            </div>
          ))}
        </div>

        {canManagePromotion && (
          <PromotionActionButtons promotionId={id} isActive={p.isActive} />
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">Total Uses</p>
            <p className="mt-1 text-2xl font-semibold">{stats.totalUses}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">Total Discount Given</p>
            <p className="mt-1 text-2xl font-semibold">{formatCentsToDollars(stats.totalDiscountCents)}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-primary/5 text-left">
              <tr>
                {['Buyer', 'Order', 'Discount', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium text-primary/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {recentUsage.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{u.buyerUsername ?? u.buyerId}</td>
                  <td className="px-4 py-3 font-mono text-xs">{u.orderNumber ?? u.orderId}</td>
                  <td className="px-4 py-3">{formatCentsToDollars(u.discountCents)}</td>
                  <td className="px-4 py-3 text-gray-500">{u.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
              {recentUsage.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No usage recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const { promoCode: pc, redemptions, redemptionCount } = codeDetail!;

  return (
    <div className="space-y-6">
      <Link href="/promotions" className="text-sm text-gray-500 hover:underline">← Back to Promotions</Link>
      <AdminPageHeader title={`Code: ${pc.code}`} description="Promo code detail" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {[
          { label: 'Type', value: pc.type },
          ...(pc.type === 'AFFILIATE' && pc.affiliateId ? [{ label: 'Affiliate', value: <Link href={`/usr/affiliates/${pc.affiliateId}`} className="text-primary hover:underline">{pc.affiliateUsername ?? pc.affiliateId}</Link> }] : []),
          { label: 'Discount', value: formatCodeDiscount(pc.discountType, pc.discountValue, pc.durationMonths) },
          { label: 'Scope', value: pc.scopeProductTypes ? JSON.stringify(pc.scopeProductTypes) : 'All products' },
          { label: 'Usage', value: pc.usageLimit ? `${pc.usageCount} / ${pc.usageLimit}` : `${pc.usageCount} / Unlimited` },
          { label: 'Expires', value: pc.expiresAt ? pc.expiresAt.toLocaleDateString() : 'Never' },
          { label: 'Status', value: <Badge variant={pc.isActive ? 'default' : 'secondary'}>{pc.isActive ? 'Active' : 'Inactive'}</Badge> },
          { label: 'Total Redemptions', value: redemptionCount },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{item.label}</p>
            <div className="mt-1 text-sm font-medium">{item.value}</div>
          </div>
        ))}
      </div>

      {canManagePromoCode && (
        <PromoCodeActionButtons codeId={pc.id} isActive={pc.isActive} />
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              {['User', 'Product', 'Discount Applied', 'Date'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium text-primary/70">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {redemptions.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{r.username ?? r.userId}</td>
                <td className="px-4 py-3">{r.subscriptionProduct}</td>
                <td className="px-4 py-3">{formatCentsToDollars(r.discountAppliedCents)}</td>
                <td className="px-4 py-3 text-gray-500">{r.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {redemptions.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No redemptions recorded</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
