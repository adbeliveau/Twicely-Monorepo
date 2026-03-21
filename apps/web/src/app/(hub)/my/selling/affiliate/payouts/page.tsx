import { redirect } from 'next/navigation';
import { authorize } from '@twicely/casl';
import { getAffiliateByUserId, getAffiliatePayouts } from '@/lib/queries/affiliate';
import { AffiliatePayoutList } from '@/components/affiliate/affiliate-payout-list';

export const metadata = { title: 'Affiliate Payouts | Twicely' };

export default async function AffiliatePayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { session } = await authorize();
  if (!session) redirect('/auth/login?callbackUrl=/my/selling/affiliate/payouts');

  if (!session.isSeller) redirect('/my/selling/affiliate');

  const existingAffiliate = await getAffiliateByUserId(session.userId);
  if (!existingAffiliate) redirect('/my/selling/affiliate');

  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const pageSize = 10;

  const { rows, total } = await getAffiliatePayouts(existingAffiliate.id, {
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Affiliate Payouts</h1>
        <p className="text-muted-foreground mt-1">
          Payouts are processed monthly on the 15th.
        </p>
      </div>
      <AffiliatePayoutList payouts={rows} total={total} currentPage={currentPage} />
    </div>
  );
}
