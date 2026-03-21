import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import type { ReferralRow } from '@/lib/queries/affiliate';

interface AffiliateReferralListProps {
  referrals: ReferralRow[];
  total: number;
  currentPage: number;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CLICKED: 'outline',
  SIGNED_UP: 'secondary',
  TRIALING: 'secondary',
  CONVERTED: 'default',
  CHURNED: 'destructive',
};

function formatDate(date: Date | null): string {
  if (!date) return '--';
  return new Date(date).toLocaleDateString();
}

export function AffiliateReferralList({ referrals, total, currentPage }: AffiliateReferralListProps) {
  const pageSize = 10;
  const totalPages = Math.ceil(total / pageSize);

  if (referrals.length === 0 && currentPage === 1) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        No referrals yet. Share your referral link to start tracking clicks and signups.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">User</th>
              <th className="pb-2 pr-4">Clicked</th>
              <th className="pb-2 pr-4">Signed Up</th>
              <th className="pb-2">Converted</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>{r.status}</Badge>
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {r.referredUsername ?? 'Anonymous user'}
                </td>
                <td className="py-2 pr-4">{formatDate(r.clickedAt)}</td>
                <td className="py-2 pr-4">{formatDate(r.signedUpAt)}</td>
                <td className="py-2">{formatDate(r.convertedAt)}</td>
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
                <a href={`/my/selling/affiliate/referrals?page=${currentPage - 1}`}>Previous</a>
              </Button>
            )}
            {currentPage < totalPages && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/my/selling/affiliate/referrals?page=${currentPage + 1}`}>Next</a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
