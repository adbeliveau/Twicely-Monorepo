import { Badge } from '@twicely/ui/badge';
import { formatCentsToDollars } from '@twicely/finance/format';
import type { CommissionRow } from '@/lib/queries/affiliate';

interface AffiliateCommissionTableProps {
  commissions: CommissionRow[];
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  PAYABLE: 'default',
  PAID: 'outline',
  REVERSED: 'destructive',
};

const PRODUCT_LABELS: Record<string, string> = {
  store: 'Store',
  lister: 'Crosslister',
  automation: 'Automation',
  finance: 'Finance',
};

export function AffiliateCommissionTable({ commissions }: AffiliateCommissionTableProps) {
  if (commissions.length === 0) {
    return (
      <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
        No commissions yet. When referred users subscribe, commissions will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4">Product</th>
              <th className="pb-2 pr-4 text-right">Revenue</th>
              <th className="pb-2 pr-4 text-right">Rate</th>
              <th className="pb-2 pr-4 text-right">Commission</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-2 pr-4">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="py-2 pr-4">{PRODUCT_LABELS[c.subscriptionProduct] ?? c.subscriptionProduct}</td>
                <td className="py-2 pr-4 text-right">{formatCentsToDollars(c.netRevenueCents)}</td>
                <td className="py-2 pr-4 text-right">{c.commissionRateBps / 100}%</td>
                <td className="py-2 pr-4 text-right">{formatCentsToDollars(c.commissionCents)}</td>
                <td className="py-2">
                  <Badge variant={STATUS_VARIANT[c.status] ?? 'secondary'}>{c.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
