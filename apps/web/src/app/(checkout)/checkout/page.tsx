import { redirect } from 'next/navigation';
import { authorize } from '@twicely/casl';
import { getCartWithItems } from '@/lib/queries/cart';
import { getUserAddresses } from '@/lib/queries/address';
import { getAuthOfferConfig } from '@twicely/commerce/auth-offer';
import { getNearbyMeetupLocations } from '@/lib/queries/safe-meetup-locations';
import { CheckoutFlow } from '@/components/pages/checkout/checkout-flow';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Checkout | Twicely',
};

// US geographic center: used as fallback when user coordinates are not known server-side
const US_CENTER_LAT = 39.8283;
const US_CENTER_LON = -98.5795;
const MEETUP_SEARCH_RADIUS_MILES = 500;

export default async function CheckoutPage() {
  const { ability, session } = await authorize();

  if (!session) {
    redirect('/auth/login?redirect=/checkout');
  }

  if (!ability.can('create', 'Order')) {
    redirect('/my?error=account-restricted');
  }

  const [cart, addresses, authOfferConfig] = await Promise.all([
    getCartWithItems(session.userId),
    getUserAddresses(session.userId),
    getAuthOfferConfig(),
  ]);

  if (!cart || cart.itemCount === 0) {
    redirect('/cart');
  }

  // Fetch nearby safe meetup locations when cart supports local pickup
  const nearbyMeetupLocations = cart.supportsLocalPickup
    ? await getNearbyMeetupLocations(US_CENTER_LAT, US_CENTER_LON, MEETUP_SEARCH_RADIUS_MILES)
    : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <CheckoutFlow
        cart={cart}
        addresses={addresses}
        authBuyerFeeCents={authOfferConfig.buyerFeeCents}
        authOfferThresholdCents={authOfferConfig.thresholdCents}
        nearbyMeetupLocations={nearbyMeetupLocations}
      />
    </div>
  );
}
