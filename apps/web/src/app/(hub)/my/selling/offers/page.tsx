import { redirect } from 'next/navigation';
import { authorize } from '@twicely/casl';
import { getSellerProfile } from '@/lib/queries/seller';
import { getSellerOffers, type OfferStatus } from '@/lib/queries/offers';
import { SellerOffersList } from '@/components/pages/offers/seller-offers-list';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Incoming Offers | Twicely',
};

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string; sort?: string }>;
}

export default async function SellerOffersPage({ searchParams }: PageProps) {
  const { ability, session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/offers');
  }

  // Must be a seller
  const sellerProfile = await getSellerProfile(session.userId);
  if (!sellerProfile) {
    redirect('/my/selling');
  }

  // CASL check for delegate support
  if (!ability.can('read', 'Offer')) {
    redirect('/my?error=account-restricted');
  }

  const params = await searchParams;
  const status = (params.status as OfferStatus | 'all') || 'all';
  const page = parseInt(params.page || '1', 10);
  const sort = (params.sort as 'newest' | 'highest') || 'newest';

  const { offers, total, perPage } = await getSellerOffers(session.userId, {
    status,
    page,
    perPage: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Incoming Offers</h1>
        <p className="text-muted-foreground">Review and respond to buyer offers</p>
      </div>

      <SellerOffersList
        offers={offers}
        total={total}
        page={page}
        perPage={perPage}
        currentStatus={status}
        currentSort={sort}
      />
    </div>
  );
}
