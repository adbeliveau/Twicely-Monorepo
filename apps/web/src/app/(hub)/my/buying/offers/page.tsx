import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getBuyerOffers, type OfferStatus } from '@/lib/queries/offers';
import { BuyerOffersList } from '@/components/pages/offers/buyer-offers-list';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My Offers | Twicely',
};

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function BuyerOffersPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  const params = await searchParams;
  const status = (params.status as OfferStatus | 'all') || 'all';
  const page = parseInt(params.page || '1', 10);

  const { offers, total, perPage } = await getBuyerOffers(session.user.id, {
    status,
    page,
    perPage: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Offers</h1>
        <p className="text-muted-foreground">Track your offers on items</p>
      </div>

      <BuyerOffersList
        offers={offers}
        total={total}
        page={page}
        perPage={perPage}
        currentStatus={status}
      />
    </div>
  );
}
