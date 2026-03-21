'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import { formatPrice } from '@twicely/utils/format';
import { removeFromCart, updateCartItemQuantity } from '@/lib/actions/cart';
import type { CartItemDetail } from '@/lib/queries/cart';
import { Loader2, Minus, Plus, Trash2, AlertCircle } from 'lucide-react';

interface CartItemRowProps {
  item: CartItemDetail;
}

export function CartItemRow({ item }: CartItemRowProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > item.maxQuantity || isUpdating) return;
    setIsUpdating(true);
    await updateCartItemQuantity(item.cartItemId, newQuantity);
    setIsUpdating(false);
  };

  const handleRemove = async () => {
    if (isRemoving) return;
    setIsRemoving(true);
    await removeFromCart(item.cartItemId);
    // No need to reset state - component will be removed from DOM
  };

  const itemTotalCents = item.unitPriceCents * item.quantity;

  return (
    <div className={`p-4 flex gap-4 ${!item.isAvailable ? 'opacity-60' : ''}`}>
      {/* Product Image */}
      <Link href={`/i/${item.slug}`} className="shrink-0">
        <div className="relative h-20 w-20 rounded-md overflow-hidden bg-muted">
          {item.primaryImageUrl ? (
            <Image
              src={item.primaryImageUrl}
              alt={item.title}
              fill
              className="object-cover"
              sizes="80px"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
              No image
            </div>
          )}
        </div>
      </Link>

      {/* Product Details */}
      <div className="flex-1 min-w-0">
        <Link href={`/i/${item.slug}`} className="hover:underline">
          <h3 className="font-medium text-sm line-clamp-2">{item.title}</h3>
        </Link>

        {/* Availability Warning */}
        {!item.isAvailable && (
          <div className="flex items-center gap-1.5 mt-1 text-red-600">
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="text-xs">
              {item.unavailableReason === 'INSUFFICIENT_QUANTITY'
                ? `Only ${item.maxQuantity} available`
                : 'Item unavailable'}
            </span>
          </div>
        )}

        {/* Price and Shipping */}
        <div className="mt-1 text-sm">
          <span className="font-medium">{formatPrice(item.unitPriceCents)}</span>
          {item.shippingCents > 0 && (
            <span className="text-muted-foreground">
              {' '}+ {formatPrice(item.shippingCents)} shipping
            </span>
          )}
          {item.freeShipping && (
            <span className="text-green-600 text-xs font-medium ml-2">Free shipping</span>
          )}
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center border rounded-md">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleQuantityChange(item.quantity - 1)}
              disabled={item.quantity <= 1 || isUpdating || !item.isAvailable}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center text-sm">
              {isUpdating ? (
                <Loader2 className="h-3 w-3 animate-spin mx-auto" />
              ) : (
                item.quantity
              )}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleQuantityChange(item.quantity + 1)}
              disabled={item.quantity >= item.maxQuantity || isUpdating || !item.isAvailable}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleRemove}
            disabled={isRemoving}
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Item Total */}
      <div className="text-right shrink-0">
        <p className="font-semibold">{formatPrice(itemTotalCents)}</p>
        {item.quantity > 1 && (
          <p className="text-xs text-muted-foreground">
            {formatPrice(item.unitPriceCents)} each
          </p>
        )}
      </div>
    </div>
  );
}
