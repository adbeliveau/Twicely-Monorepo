import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAllPromoCodes, getPromoCodeRedemptionCount } from '@/lib/queries/promo-codes';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CreatePlatformPromoDialog } from '@/components/hub/create-platform-promo-dialog';
import { Badge } from '@twicely/ui/badge';
import { formatCentsToDollars } from '@twicely/finance/format';

export const metadata: Metadata = { title: 'Promo Codes | Twicely Hub' };

function formatDiscount(discountType: string, discountValue: number): string {
  if (discountType === 'PERCENTAGE') return `${discountValue / 100}% off`;
  return `${formatCentsToDollars(discountValue)} off`;
}

export default async function PromoCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'PromoCode')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const pageSize = 50;
  const { rows, total } = await getAllPromoCodes({
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  // Total redemption count across displayed codes (for summary display)
  const redemptionCounts = await Promise.all(rows.map((pc) => getPromoCodeRedemptionCount(pc.id)));
  const totalRedemptions = redemptionCounts.reduce((sum, c) => sum + c, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <AdminPageHeader
          title="Promo Codes"
          description={`${total} code${total !== 1 ? 's' : ''} · ${totalRedemptions} redemptions this page`}
        />
        <CreatePlatformPromoDialog />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Code</th>
              <th className="px-4 py-3 font-medium text-primary/70">Type</th>
              <th className="px-4 py-3 font-medium text-primary/70">Discount</th>
              <th className="px-4 py-3 font-medium text-primary/70">Duration</th>
              <th className="px-4 py-3 font-medium text-primary/70">Uses</th>
              <th className="px-4 py-3 font-medium text-primary/70">Redemptions</th>
              <th className="px-4 py-3 font-medium text-primary/70">Expires</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((pc, i) => (
              <tr key={pc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-medium">{pc.code}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{pc.type}</td>
                <td className="px-4 py-3">{formatDiscount(pc.discountType, pc.discountValue)}</td>
                <td className="px-4 py-3">{pc.durationMonths} mo</td>
                <td className="px-4 py-3">
                  {pc.usageLimit ? `${pc.usageCount}/${pc.usageLimit}` : pc.usageCount}
                </td>
                <td className="px-4 py-3 text-gray-700">{redemptionCounts[i] ?? 0}</td>
                <td className="px-4 py-3 text-gray-500">
                  {pc.expiresAt ? pc.expiresAt.toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={pc.isActive ? 'default' : 'secondary'}>
                    {pc.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No promo codes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
