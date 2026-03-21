'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { CartItemRow } from './cart-item-row';
import { formatPrice } from '@twicely/utils/format';
import type { CartWithItems } from '@/lib/queries/cart';
import { Loader2, AlertTriangle } from 'lucide-react';

interface CartContentProps {
  cart: CartWithItems;
}

export function CartContent({ cart }: CartContentProps) {
  const router = useRouter();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const hasUnavailableItems = cart.groups.some((group) =>
    group.items.some((item) => !item.isAvailable)
  );

  const handleCheckout = () => {
    if (hasUnavailableItems) return;
    setIsCheckingOut(true);
    router.push('/checkout');
  };

  const totalCents = cart.subtotalCents + cart.shippingCents;

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Cart Items */}
      <div className="lg:col-span-2 space-y-6">
        {hasUnavailableItems && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Some items are unavailable</p>
              <p className="text-sm text-yellow-700">
                Please remove unavailable items before checking out.
              </p>
            </div>
          </div>
        )}

        {cart.groups.map((group) => (
          <div key={group.sellerId} className="rounded-lg border bg-white">
            <div className="border-b px-4 py-3">
              <p className="font-medium text-sm text-muted-foreground">
                Sold by{' '}
                {group.sellerSlug ? (
                  <Link
                    href={`/st/${group.sellerSlug}`}
                    className="text-foreground hover:underline"
                  >
                    {group.sellerName}
                  </Link>
                ) : (
                  <span className="text-foreground">{group.sellerName}</span>
                )}
              </p>
            </div>
            <div className="divide-y">
              {group.items.map((item) => (
                <CartItemRow key={item.cartItemId} item={item} />
              ))}
            </div>
            <div className="border-t px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seller subtotal</span>
                <span className="font-medium">
                  {formatPrice(group.groupSubtotalCents)}
                  {group.combinedShippingCents > 0 && (
                    <span className="text-muted-foreground font-normal">
                      {' '}+ {formatPrice(group.combinedShippingCents)} shipping
                    </span>
                  )}
                </span>
              </div>
              {group.shippingSavingsCents > 0 && (
                <div className="flex justify-between text-green-600 text-xs">
                  <span>Combined shipping discount</span>
                  <span>-{formatPrice(group.shippingSavingsCents)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Order Summary */}
      <div className="lg:col-span-1">
        <div className="rounded-lg border bg-white p-6 sticky top-4">
          <h2 className="font-semibold mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(cart.subtotalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>
                {cart.shippingCents === 0 ? 'Free' : formatPrice(cart.shippingCents)}
              </span>
            </div>
            {cart.totalShippingSavingsCents > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Combined shipping discount</span>
                <span>-{formatPrice(cart.totalShippingSavingsCents)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t font-semibold text-base">
              <span>Total</span>
              <span>{formatPrice(totalCents)}</span>
            </div>
          </div>
          <Button
            className="w-full mt-6"
            size="lg"
            onClick={handleCheckout}
            disabled={isCheckingOut || hasUnavailableItems}
          >
            {isCheckingOut && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Proceed to Checkout
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Tax calculated at checkout
          </p>
        </div>
      </div>
    </div>
  );
}
