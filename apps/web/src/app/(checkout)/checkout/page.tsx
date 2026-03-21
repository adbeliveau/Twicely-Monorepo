import { redirect } from 'next/navigation';
import { authorize } from '@twicely/casl';
import { getCartWithItems } from '@/lib/queries/cart';
import { getUserAddresses } from '@/lib/queries/address';
import { getAuthOfferConfig } from '@twicely/commerce/auth-offer';
import { CheckoutFlow } from '@/components/pages/checkout/checkout-flow';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Checkout | Twicely',
};

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <CheckoutFlow
        cart={cart}
        addresses={addresses}
        authBuyerFeeCents={authOfferConfig.buyerFeeCents}
        authOfferThresholdCents={authOfferConfig.thresholdCents}
      />
    </div>
  );
}
