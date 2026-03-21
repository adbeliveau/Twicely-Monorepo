import { redirect } from 'next/navigation';
import { authorize } from '@twicely/casl';
import { getAffiliateByUserId, getAffiliateReferrals } from '@/lib/queries/affiliate';
import { AffiliateReferralList } from '@/components/affiliate/affiliate-referral-list';

export const metadata = { title: 'Referred Users | Twicely' };

export default async function AffiliateReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { session } = await authorize();
  if (!session) redirect('/auth/login?callbackUrl=/my/selling/affiliate/referrals');

  if (!session.isSeller) redirect('/my/selling/affiliate');

  const existingAffiliate = await getAffiliateByUserId(session.userId);
  if (!existingAffiliate) redirect('/my/selling/affiliate');

  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const pageSize = 10;

  const { rows, total } = await getAffiliateReferrals(existingAffiliate.id, {
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Referred Users</h1>
        <p className="text-muted-foreground mt-1">
          Track clicks, signups, and conversions from your referral link.
        </p>
      </div>
      <AffiliateReferralList referrals={rows} total={total} currentPage={currentPage} />
    </div>
  );
}
