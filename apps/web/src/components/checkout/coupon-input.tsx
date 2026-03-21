'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { applyCoupon } from '@/lib/actions/apply-coupon';
import { Loader2, X, Check } from 'lucide-react';

interface CouponInputProps {
  cartItems: Array<{
    listingId: string;
    categoryId: string;
    sellerId: string;
    priceCents: number;
    quantity: number;
  }>;
  onDiscountApplied: (discount: {
    promotionId: string;
    promotionName: string;
    discountCents: number;
    freeShipping: boolean;
    couponCode: string;
    appliedToSellerId: string;
  } | null) => void;
}

export function CouponInput({ cartItems, onDiscountApplied }: CouponInputProps) {
  const [code, setCode] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    promotionId: string;
    promotionName: string;
    discountCents: number;
    freeShipping: boolean;
    couponCode: string;
  } | null>(null);

  function handleApply() {
    if (!code.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await applyCoupon({ couponCode: code.trim(), cartItems });

      if (!result.success) {
        setError(result.error ?? 'Invalid coupon code');
        return;
      }

      if (result.discount) {
        const discount = {
          promotionId: result.discount.promotionId,
          promotionName: result.discount.promotionName,
          discountCents: result.discount.discountCents,
          freeShipping: result.discount.freeShipping,
          couponCode: code.toUpperCase().trim(),
          appliedToSellerId: result.discount.appliedToSellerId,
        };
        setAppliedDiscount(discount);
        onDiscountApplied(discount);
      }
    });
  }

  function handleRemove() {
    setAppliedDiscount(null);
    setCode('');
    setError(null);
    onDiscountApplied(null);
  }

  function formatDiscount(): string {
    if (!appliedDiscount) return '';
    if (appliedDiscount.freeShipping) return 'Free shipping';
    return `-$${(appliedDiscount.discountCents / 100).toFixed(2)}`;
  }

  if (appliedDiscount) {
    return (
      <div className="rounded-lg border bg-green-50 border-green-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700">
            <Check className="h-4 w-4" />
            <span className="font-mono font-medium">{appliedDiscount.couponCode}</span>
            <span className="text-sm">&mdash; {appliedDiscount.promotionName}</span>
            <span className="font-medium">({formatDiscount()})</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRemove} className="text-green-700 hover:text-green-900">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter coupon code"
          disabled={isPending}
          className={`font-mono uppercase ${error ? 'border-red-500' : ''}`}
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
        />
        <Button onClick={handleApply} disabled={isPending || !code.trim()}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Apply
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
