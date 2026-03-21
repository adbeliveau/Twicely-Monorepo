import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authorize } from '@twicely/casl';
import { getCartWithItems } from '@/lib/queries/cart';
import { CartContent } from '@/components/pages/cart/cart-content';
import { Button } from '@twicely/ui/button';
import { ShoppingBag } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cart | Twicely',
};

export default async function CartPage() {
  const { ability, session } = await authorize();

  if (!session) {
    redirect('/auth/login?redirect=/cart');
  }

  if (!ability.can('read', 'Cart')) {
    redirect('/my?error=account-restricted');
  }

  const cart = await getCartWithItems(session.userId);

  if (!cart || cart.itemCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
        <p className="text-muted-foreground mb-6">
          Looks like you haven&apos;t added anything to your cart yet.
        </p>
        <Button asChild>
          <Link href="/">Start Shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        Shopping Cart ({cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'})
      </h1>
      <CartContent cart={cart} />
    </div>
  );
}
