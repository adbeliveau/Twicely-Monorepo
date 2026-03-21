'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import { addToCart } from '@/lib/actions/cart';
import { ShoppingCart, Check, Loader2 } from 'lucide-react';
import { authClient } from '@twicely/auth/client';

interface ListingAuthActionsProps {
  listingId: string;
  availableQuantity: number;
  sellerId: string;
  slug: string;
}

export function ListingAuthActions({
  listingId,
  availableQuantity,
  sellerId,
  slug,
}: ListingAuthActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<{
    isLoading: boolean;
    userId: string | null;
  }>({ isLoading: true, userId: null });

  useEffect(() => {
    async function checkAuth() {
      try {
        const session = await authClient.getSession();
        setAuthState({
          isLoading: false,
          userId: session.data?.user?.id ?? null,
        });
      } catch {
        setAuthState({ isLoading: false, userId: null });
      }
    }
    checkAuth();
  }, []);

  // Show skeleton/loading state during auth check to prevent flash
  if (authState.isLoading) {
    return (
      <Button disabled className="w-full" size="lg">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading...
      </Button>
    );
  }

  const currentUserId = authState.userId;

  // User is the seller
  if (currentUserId === sellerId) {
    return (
      <Button disabled className="w-full" size="lg">
        This is your listing
      </Button>
    );
  }

  // Not logged in
  if (!currentUserId) {
    return (
      <Button asChild className="w-full" size="lg">
        <Link href={`/auth/login?redirect=/i/${slug}`}>
          <ShoppingCart className="mr-2 h-5 w-5" />
          Add to Cart
        </Link>
      </Button>
    );
  }

  // Out of stock
  if (availableQuantity <= 0) {
    return (
      <Button disabled className="w-full" size="lg">
        Out of Stock
      </Button>
    );
  }

  // Already added - show success state
  if (isAdded) {
    return (
      <div className="flex flex-col gap-2">
        <Button disabled className="w-full bg-green-600 hover:bg-green-600" size="lg">
          <Check className="mr-2 h-5 w-5" />
          Added to Cart
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/cart">View Cart</Link>
        </Button>
      </div>
    );
  }

  async function handleAddToCart() {
    setIsLoading(true);
    setError(null);

    const result = await addToCart(listingId, 1);

    setIsLoading(false);

    if (!result.success) {
      setError(result.error ?? 'Failed to add to cart');
      return;
    }

    setIsAdded(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleAddToCart}
        disabled={isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Adding...
          </>
        ) : (
          <>
            <ShoppingCart className="mr-2 h-5 w-5" />
            Add to Cart
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}
