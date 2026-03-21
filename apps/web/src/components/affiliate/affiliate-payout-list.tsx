import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { formatCentsToDollars } from '@twicely/finance/format';

interface PayoutRow {
  id: string;
  amountCents: number;
  method: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  completedAt: Date | null;
}

interface AffiliatePayoutListProps {
  payouts: PayoutRow[];
  total: number;
  currentPage: number;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  PROCESSING: 'secondary',
  COMPLETED: 'default',
  FAILED: 'destructive',
};

function formatDate(date: Date | null): string {
  if (!date) return '--';
  return new Date(date).toLocaleDateString();
}

function formatPeriod(start: Date, end: Date): string {
  return `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`;
}

export function AffiliatePayoutList({ payouts, total, currentPage }: AffiliatePayoutListProps) {
  const pageSize = 10;
  const totalPages = Math.ceil(total / pageSize);

  if (payouts.length === 0 && currentPage === 1) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        No payouts yet. Payouts are processed monthly on the 15th.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4">Period</th>
              <th className="pb-2 pr-4 text-right">Amount</th>
              <th className="pb-2 pr-4">Method</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="py-2 pr-4">{formatDate(p.createdAt)}</td>
                <td className="py-2 pr-4">{formatPeriod(p.periodStart, p.periodEnd)}</td>
                <td className="py-2 pr-4 text-right">{formatCentsToDollars(p.amountCents)}</td>
                <td className="py-2 pr-4 capitalize">{p.method.replace('_', ' ')}</td>
                <td className="py-2">
                  <Badge variant={STATUS_VARIANT[p.status] ?? 'secondary'}>{p.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/my/selling/affiliate/payouts?page=${currentPage - 1}`}>Previous</a>
              </Button>
            )}
            {currentPage < totalPages && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/my/selling/affiliate/payouts?page=${currentPage + 1}`}>Next</a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
